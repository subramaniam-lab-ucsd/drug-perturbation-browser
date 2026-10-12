"""Every fitted condition: drug x cell line x dose, with its DE gene counts.

`n_deg` is genes at BH-adjusted p < 0.05 from the DESeq2 fit (~plate +
condition), not a hand-set threshold. `n_up` and `n_down` split that same set
by the sign of the Wald statistic, counted over the whole significant set
rather than the truncated per-drug detail.
"""
import pandas as pd
from _common import C, P, emit_arrow

c = P.all_doses()
f = C.CALIB / "direction.parquet"
if not f.exists():
    raise SystemExit("calibration/direction.parquet missing: run tahoe_response.src.genes")
d = pd.read_parquet(f)
c = c.merge(d, on="condition_id", how="left")
# A condition with no significant gene has no row in direction.parquet.
c[["n_up", "n_down"]] = c[["n_up", "n_down"]].fillna(0).astype(int)
bad = c[(c.n_up + c.n_down != c.n_deg) & (c.n_deg > 0)]
if len(bad):
    raise SystemExit(f"{len(bad)} conditions where n_up + n_down != n_deg")
emit_arrow(c[["drug", "cell_line", "dose", "n_deg", "n_up", "n_down"]])
