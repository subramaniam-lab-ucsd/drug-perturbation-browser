"""One row per cell line: tissue, drivers, and how much it responds overall."""
import pandas as pd
from _common import P, emit_arrow

c = P.all_doses()
lm, one, NAME, ORGAN = P.lines()
g = (c[c.dose == 0.5].groupby("cell_line", observed=True)
     .agg(compounds=("drug", "nunique"), median_deg=("n_deg", "median")).reset_index())
g["cell_line"] = g.cell_line.astype(str)
g["name"] = g.cell_line.map(NAME).fillna(g.cell_line)
g["organ"] = g.cell_line.map(ORGAN).fillna("unknown")
sub = lm[lm.Cell_ID_Cellosaur.isin(set(g.cell_line))]
drv = (sub.assign(d=sub.Driver_Gene_Symbol.astype(str))
          .groupby("Cell_ID_Cellosaur").d.apply(lambda s: ", ".join(sorted(set(s)))))
g["drivers"] = g.cell_line.map(drv).fillna("")
g["n_drivers"] = g.cell_line.map(sub.groupby("Cell_ID_Cellosaur").size()).fillna(0)
# the five lines that respond most across the whole library
g["responds_broadly"] = g.cell_line.isin(P.noisy_lines(P.load_at_dose(0.5)))
emit_arrow(g.sort_values("median_deg", ascending=False))
