"""Median regulator activity per compound and dose, with its pathway family."""
import pandas as pd
from _common import C, emit_arrow
t = pd.read_parquet(C.CALIB / "regulators_summary.parquet")
emit_arrow(t[["drug", "dose", "regulator", "family", "z", "lines"]])
