#!/bin/sh
# Regenerate the data from the analysis repository. This is the ONLY step that
# needs anything outside this repository, and it is needed only when the
# analysis outputs change. Everything else, including ./build.sh and the tests,
# runs from a plain clone.
#
#   ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh tables
#   ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh detail
#   ANALYSIS_REPO=~/perturbseq-harmonization ./refresh.sh all
#
#   tables  the 11 files under src/data/, about 3.2 MB. Committed.
#   detail  all 1,137 per-drug files under src/detail/, about 444 MB. Only the
#           20 drugs in dev-drugs.txt are committed; the rest are ignored by
#           Git and exist to be built and deployed.
set -e
cd "$(dirname "$0")"

: "${ANALYSIS_REPO:?set ANALYSIS_REPO to the analysis repository root}"
export ANALYSIS_REPO
A=$(cd "$ANALYSIS_REPO" && pwd)
PY="${PYTHON:-$A/tf-env/bin/python}"
[ -x "$PY" ] || { echo "no python at $PY (override with PYTHON=...)" >&2; exit 1; }
[ -f "$A/tahoe_response/src/panel.py" ] || { echo "$A is not the analysis repository" >&2; exit 1; }

tables() {
  echo "tables from $A"
  for f in loaders/*.arrow.py loaders/*.json.py; do
    n=$(basename "$f" .py)
    # Loaders write to stdout. A failure must not leave a truncated file behind,
    # which is how a half-written table once reached the browser as a parse error.
    if (cd loaders && "$PY" "$(basename "$f")") > "src/data/.$n.tmp"; then
      mv "src/data/.$n.tmp" "src/data/$n"
      printf '  %-28s %s\n' "$n" "$(du -h "src/data/$n" | cut -f1)"
    else
      rm -f "src/data/.$n.tmp"
      echo "  FAILED: $n" >&2; exit 1
    fi
  done
}

detail() {
  echo "detail from $A"
  "$PY" loaders/build_detail.py
}

case "${1:-all}" in
  tables) tables ;;
  detail) detail ;;
  all)    tables; detail ;;
  *)      echo "usage: ./refresh.sh tables | detail | all" >&2; exit 1 ;;
esac
