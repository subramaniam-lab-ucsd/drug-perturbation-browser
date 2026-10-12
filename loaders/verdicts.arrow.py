"""One verdict per drug, from the closed vocabulary in analysis/verdicts.py."""
import pandas as pd
from _common import C, emit_arrow
f = C.CALIB / "verdicts.parquet"
if not f.exists():
    raise SystemExit("calibration/verdicts.parquet missing: run "
                     "tahoe_response.src.analysis.verdicts")
emit_arrow(pd.read_parquet(f))
