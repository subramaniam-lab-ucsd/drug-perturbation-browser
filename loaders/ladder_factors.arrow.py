"""Per-factor evidence behind each contrast, ranked by effect size.

Never ranked by p: at these group sizes the exact test floors and dozens of
factors tie at the same value, so p cannot order them.

`shift` is renamed to `delta_z` on the way out. `DataFrame.shift` is a pandas
method, so `t.shift` silently returns the method rather than the column.
"""
import pandas as pd
from _common import C, emit_arrow
f = C.CALIB / "ladder_factors.parquet"
if not f.exists():
    raise SystemExit("calibration/ladder_factors.parquet missing: run "
                     "tahoe_response.src.analysis.genotype_ladder")
t = pd.read_parquet(f).rename(columns={"shift": "delta_z"})
t = t.reindex(t.delta_z.abs().sort_values(ascending=False).index)
emit_arrow(t.groupby(["drug", "genotype", "dose", "contrast"], observed=True)
            .head(12).reset_index(drop=True))
