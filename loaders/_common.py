"""Shared loader setup.

Loaders import from tahoe_response.src so the app and the analysis cannot
disagree. Nothing here computes a statistic.

Data comes from exactly two analysis objects, both 2026-09-04, via
src/sources.py: deseq2_well_vs_dmso.h5ad and tf_activity_collectri.h5ad, plus
the metadata in data/tahoe-metadata/.

These loaders are NOT run by ./build.sh. The site is built from the static
Arrow and JSON under src/data/, and these are what produced it. ./refresh.sh
re-runs them when the analysis outputs change, which needs the analysis
repository: set ANALYSIS_REPO to its root.
"""
import os, sys, pathlib

import pandas as pd

_env = os.environ.get("ANALYSIS_REPO")
if _env:
    REPO = pathlib.Path(_env).expanduser().resolve()
else:
    # Original location, tahoe_response/viz/src/data/ inside the analysis repo.
    REPO = pathlib.Path(__file__).resolve().parents[4]
if not (REPO / "tahoe_response" / "src" / "panel.py").is_file():
    raise SystemExit(
        f"ANALYSIS_REPO does not look like the analysis repository: {REPO}\n"
        "Expected tahoe_response/src/panel.py under it. These loaders read the "
        "calibration tables; the site itself builds from src/data/ without them."
    )
sys.path.insert(0, str(REPO))

from tahoe_response.src import config as C, panel as P   # noqa: E402

DOSES = [0.05, 0.5, 5.0]


# Columns that are compared for exact equality in the browser and must keep
# full precision. 0.05 has no float32 representation, so downcasting it gave
# 0.05000000074505806 and every `dose === 0.05` test failed, silently returning
# an empty page rather than an error.
EXACT = {"dose"}


def to_browser(df):
    """Narrow types for the browser.

    int64 reaches JavaScript as BigInt, which Plot cannot scale. Repeated strings
    become categories so Arrow dictionary-encodes them, which is worth about a
    megabyte on the largest table. Columns in EXACT are left alone.
    """
    df = df.copy()
    for c in df.columns:
        if c in EXACT:
            # float64 for exactness, categorical so Arrow dictionary-encodes it.
            # Three distinct doses over 155,000 rows: plain float64 cost 0.85 MB
            # across the two largest tables, the dictionary costs nothing.
            df[c] = pd.Categorical(df[c].astype("float64"))
            continue
        k = df[c].dtype.kind
        if k in "iu":
            df[c] = df[c].astype("int32")
        elif k == "b":
            df[c] = df[c].astype("int32")
        elif k in "OU" or str(df[c].dtype) == "category":
            v = df[c].astype(str)
            df[c] = v.astype("category") if v.nunique() <= max(1, len(v) // 2) else v
        elif k == "f":
            df[c] = df[c].astype("float32")
    return df


def emit_arrow(df):
    """Arrow IPC, not parquet: .arrow() uses the apache-arrow JS already on the
    page, while .parquet() pulls a 5 MB wasm decoder for the same bytes."""
    import io, sys as _s
    import pyarrow as pa, pyarrow.ipc as ipc
    t = pa.Table.from_pandas(to_browser(df), preserve_index=False)
    buf = io.BytesIO()
    with ipc.new_file(buf, t.schema) as w:
        w.write_table(t)
    _s.stdout.buffer.write(buf.getvalue())


def _clean(o):
    """NaN and Infinity are not valid JSON and break JSON.parse in the browser."""
    import math
    if isinstance(o, float):
        return None if (math.isnan(o) or math.isinf(o)) else o
    if isinstance(o, dict):
        return {k: _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    return o


def emit_json(obj):
    import json, sys as _s
    json.dump(_clean(obj), _s.stdout, default=str, allow_nan=False)
