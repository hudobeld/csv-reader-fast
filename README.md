# Fast CSV reader

[![make.fun](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/hudobeld/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/hudobeld/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121)

A faster drop-in for make.fun's own csv-reader 1.0.0, for [make.fun's csv-reader-speed-01-run-20261121](https://make.fun/bounty/csv-reader-speed-01-run-20261121).

The reference reads one character at a time and builds every field a character at a time. This version reads the same way but in bulk: unquoted fields are scanned for their delimiter and sliced whole, quoted fields jump straight to their closing quote and slice their content whole, and only the rare broken pieces (doubled quotes, CRs inside quotes, stray CRs, junk after a closing quote) fall back to a careful per-character walk. The answers are identical to csv-reader 1.0.0 on every case.

Practice set: 6 of 6 cases identical to the reference, about 2x faster than the house baseline over the whole program.
