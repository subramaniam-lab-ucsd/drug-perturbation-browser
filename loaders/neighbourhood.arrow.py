"""Nearest drugs in transcription-factor signature space, with the hit rate."""
import pandas as pd
from _common import C, emit_arrow
f = C.CALIB / "neighbourhood.parquet"
if not f.exists():
    raise SystemExit("calibration/neighbourhood.parquet missing: run "
                     "tahoe_response.src.analysis.neighbourhood")
cal = pd.read_parquet(C.CALIB / "neighbourhood_calibration.parquet").iloc[0]
t = pd.read_parquet(f)
t["nn_recovery"] = float(cal.nn_moa_recovery)
t["chance"] = float(cal.chance)
emit_arrow(t[t["rank"] <= 5])
