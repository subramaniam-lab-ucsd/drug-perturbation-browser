"""Genotype ladder results: three axes, three rungs, all doses."""
import pandas as pd
from _common import C, emit_arrow
f = C.CALIB / "ladder.parquet"
if not f.exists():
    raise SystemExit("calibration/ladder.parquet missing: run "
                     "tahoe_response.src.analysis.genotype_ladder")
emit_arrow(pd.read_parquet(f))
