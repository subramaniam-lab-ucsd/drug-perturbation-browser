#!/usr/bin/env python
"""Per-compound detail, staged as Arrow IPC for lazy fetch by the results page.

Framework builds one file per data loader, and 758 loaders would be absurd, so
these are written straight into src/detail/ and fetched on demand. They are
never bundled into a page, so the per-page budget is unaffected.

Arrow IPC rather than parquet: reading parquet in the browser pulls a 5 MB wasm
decoder, which costs more than every detail file put together. Columns the page
does not read are dropped and every string column is dictionary-encoded, which
is what keeps uncompressed IPC close to the parquet size.
"""
import pathlib
import shutil
import sys

import pyarrow as pa
import pyarrow.parquet as pq

# Already Arrow IPC when src/profiles.py writes them, so these are copied rather
# than converted: response vectors over a fixed gene panel and over all 469
# transcription factors, which is what lets the browser correlate any selection.
COPY = ["profiles/gene", "profiles/tf"]

HERE = pathlib.Path(__file__).resolve().parent
# The calibration directory lives in the analysis repository, which this one
# does not contain. _common.py resolves it from ANALYSIS_REPO and errors with a
# usable message if it is wrong or unset.
sys.path.insert(0, str(HERE))
from _common import C                                        # noqa: E402
CALIB = C.CALIB
DST = HERE.parent / "src" / "detail"

# Only genes. Regulator activity is served whole from the 1 MB summary the
# regulators loader emits, so staging the per-compound regulator files would be
# 145 MB that no page ever fetches.
KEEP = {"genes": ["gene", "cell_line", "dose", "direction", "log2fc"]}
DICT = {"gene", "cell_line", "direction"}
# Compared for exact equality in the browser, so full precision. float32 turns
# 0.05 into 0.05000000074505806 and the dose filter then matches nothing.
EXACT = {"dose"}


def convert(kind: str) -> tuple[int, int]:
    src, out = CALIB / kind, DST / kind
    if not src.is_dir():
        raise SystemExit(f"missing {src}")
    out.mkdir(parents=True, exist_ok=True)
    n = total = 0
    for p in sorted(src.glob("*.parquet")):
        t = pq.read_table(p)
        missing = [c for c in KEEP[kind] if c not in t.column_names]
        if missing:
            raise SystemExit(f"{p.name}: missing columns {missing}")
        t = t.select(KEEP[kind]).replace_schema_metadata(None)
        cols = []
        for name in t.column_names:
            col = t[name]
            if name in DICT:
                col = col.cast(pa.string()).dictionary_encode()
            elif name in EXACT:
                col = col.cast(pa.float64())   # 0.05 is not a float32
            elif pa.types.is_floating(col.type):
                col = col.cast(pa.float32())
            cols.append(col)
        t = pa.table(cols, names=t.column_names).combine_chunks()
        dest = out / f"{p.stem}.arrow"
        with pa.ipc.new_file(dest, t.schema) as w:
            w.write_table(t)
        n += 1
        total += dest.stat().st_size
    return n, total


def copy(rel: str) -> tuple[int, int]:
    src, out = CALIB / rel, DST / rel
    if not src.is_dir():
        raise SystemExit(f"missing {src}: run tahoe_response.src.profiles")
    out.mkdir(parents=True, exist_ok=True)
    n = total = 0
    for p in sorted(src.glob("*.arrow")):
        shutil.copy2(p, out / p.name)
        n += 1
        total += p.stat().st_size
    return n, total


if __name__ == "__main__":
    if DST.exists():
        shutil.rmtree(DST)
    grand = 0
    for kind in KEEP:
        n, total = convert(kind)
        grand += total
        print(f"{kind}: {n} files, {total / 1e6:.1f} MB, "
              f"{total / max(n, 1) / 1e3:.0f} KB each", file=sys.stderr)
    for rel in COPY:
        n, total = copy(rel)
        grand += total
        print(f"{rel}: {n} files, {total / 1e6:.1f} MB, "
              f"{total / max(n, 1) / 1e3:.0f} KB each", file=sys.stderr)
    shutil.copy2(CALIB / "profiles" / "gene_panel.csv", DST / "profiles")
    print(f"src/detail: {grand / 1e6:.1f} MB", file=sys.stderr)
