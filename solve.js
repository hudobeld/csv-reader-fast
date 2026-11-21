// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader).
//
// Same answer as readCsv for every input {text, header}: {columns, rows, errors}.
// The reference reads one character at a time and builds every field a character
// at a time; this version reads the same way but in bulk: unquoted fields are
// scanned for their delimiter and sliced whole, quoted fields jump straight to
// their closing quote with indexOf and slice their content whole, and only the
// rare broken pieces (doubled quotes, CRs inside quotes, stray CRs, junk after
// a closing quote) fall back to a careful per-character walk. Nothing is cached
// from one case to the next; run is pure.

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const n = text.length;
  let pos = 0;
  let line = 1;
  if (n > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and its index in rows (null: header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended (0 comma, 1 line break, 2 end
  // of text), and how many characters the unquoted scan appended to it.
  let fVal = '';
  let fEnd = 2;
  let fAdded = 0;

  // Reads unquoted characters onto `init` up to the next comma or line break.
  // A CR not followed by LF is dropped (error stray_cr) and the field goes on.
  function scanUnquoted(init) {
    let value = init;
    let added = 0;
    let start = pos;
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 44) {
        if (pos > start) { value += text.slice(start, pos); added += pos - start; }
        pos += 1;
        fVal = value; fEnd = 0; fAdded = added;
        return;
      }
      if (c === 10) {
        if (pos > start) { value += text.slice(start, pos); added += pos - start; }
        pos += 1;
        line += 1;
        fVal = value; fEnd = 1; fAdded = added;
        return;
      }
      if (c === 13) {
        if (text.charCodeAt(pos + 1) === 10) {
          if (pos > start) { value += text.slice(start, pos); added += pos - start; }
          pos += 2;
          line += 1;
          fVal = value; fEnd = 1; fAdded = added;
          return;
        }
        if (pos > start) { value += text.slice(start, pos); added += pos - start; }
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        pos += 1;
        start = pos;
        continue;
      }
      pos += 1;
    }
    if (pos > start) { value += text.slice(start, pos); added += pos - start; }
    fVal = value; fEnd = 2; fAdded = added;
  }

  // Reads a quoted field whose opening quote is at pos.
  function scanQuoted() {
    const open = pos;
    const openLine = line;
    pos += 1;
    // The closing quote is the first quote that is not doubled.
    let idx = text.indexOf('"', pos);
    let close = -1;
    while (idx !== -1) {
      if (text.charCodeAt(idx + 1) === 34) { idx = text.indexOf('"', idx + 2); continue; }
      close = idx;
      break;
    }
    if (close === -1) {
      // The quote never closes: it is a literal character, and the text after
      // it is read again as unquoted.
      pos = open + 1;
      line = openLine;
      errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
      scanUnquoted('"');
      return;
    }
    let value;
    if (text.indexOf('"', pos) === close && (text.indexOf('\r', pos) === -1 || text.indexOf('\r', pos) >= close)) {
      // Clean content: no doubled quotes, no CRs. Slice it whole; only LF
      // inside it moves the line.
      value = text.slice(pos, close);
      let i = text.indexOf('\n', pos);
      while (i !== -1 && i < close) { line += 1; i = text.indexOf('\n', i + 1); }
    } else {
      // Broken content: "" is one quote, each CRLF or lone CR is one LF.
      const parts = [];
      let p = pos;
      while (p < close) {
        const c = text.charCodeAt(p);
        if (c === 34) { parts.push('"'); p += 2; continue; }
        if (c === 13) { parts.push('\n'); line += 1; p += text.charCodeAt(p + 1) === 10 ? 2 : 1; continue; }
        if (c === 10) { parts.push('\n'); line += 1; p += 1; continue; }
        let q = p + 1;
        while (q < close) {
          const d = text.charCodeAt(q);
          if (d === 34 || d === 13 || d === 10) break;
          q += 1;
        }
        parts.push(text.slice(p, q));
        p = q;
      }
      value = parts.join('');
    }
    pos = close + 1;
    if (pos >= n) { fVal = value; fEnd = 2; fAdded = 0; return; }
    const c = text.charCodeAt(pos);
    if (c === 44) { pos += 1; fVal = value; fEnd = 0; fAdded = 0; return; }
    if (c === 10) { pos += 1; line += 1; fVal = value; fEnd = 1; fAdded = 0; return; }
    if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; fVal = value; fEnd = 1; fAdded = 0; return; }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    scanUnquoted(value);
    if (fAdded > 0) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < n) {
      const c = text.charCodeAt(pos);
      if (c === 10) { pos += 1; line += 1; }
      else if (c === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let lastQuoted = false;
    do {
      if (text.charCodeAt(pos) === 34) { scanQuoted(); lastQuoted = true; }
      else { scanUnquoted(''); lastQuoted = false; }
      fields.push(fVal);
    } while (fEnd === 0);

    // A line that held only stray CRs is left with no characters: no record
    // (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !lastQuoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
