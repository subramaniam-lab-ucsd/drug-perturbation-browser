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
# PubChem CID from the Tahoe drug metadata, as a string: it arrives as a float
# (165411828.0), and a compound page is addressed by the integer. Blank where
# the metadata has none, which the browser renders as an unlinked name.
cid = pd.to_numeric(g.drug.map(dm.pubchem_cid), errors="coerce")
g["pubchem_cid"] = cid.map(lambda v: "" if pd.isna(v) else str(int(v)))
emit_arrow(g.sort_values("drug"))
