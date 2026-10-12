"""One row per compound, with its mechanism, target and response summary."""
import pandas as pd
from _common import P, emit_arrow

c = P.all_doses()
dm = P.drugs()
g = (c[c.dose == 0.5].groupby("drug", observed=True)
     .agg(lines=("cell_line", "nunique"), median_deg=("n_deg", "median"),
          max_deg=("n_deg", "max")).reset_index())
g["moa"] = g.drug.map(dm["moa-fine"]).fillna("unannotated")
g["targets"] = g.drug.map(dm.targets).fillna("")
g["approved"] = g.drug.map(dm["human-approved"]).fillna("").astype(str)
emit_arrow(g.sort_values("drug"))
