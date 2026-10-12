"""Oncogenic alterations per cell line, as DepMap annotates them.

Everything the site says about a cell line's genotype comes from here: the gene,
the protein change, whether both copies carry it, and whether DepMap calls the
gene an oncogene or a tumour suppressor. The protein change is what makes the difference
between "KRAS mutant" and "KRAS p.G12C", which is the distinction the
specificity analysis turns on.

Driver_Mech_InferDM (GoF/LoF) is carried through but is blank for 29% of rows,
so it is shown where present and never used to filter.
"""
from _common import P, emit_arrow

lm, one, NAME, ORGAN = P.lines()
pl = P.load_at_dose(0.5)
sub = lm[lm.Cell_ID_Cellosaur.isin(set(pl.cell_line))].copy()

sub["cell_line"] = sub.Cell_ID_Cellosaur
sub["name"] = sub.cell_name
sub["depmap"] = sub.Cell_ID_DepMap.astype(str)
sub["gene"] = sub.Driver_Gene_Symbol.astype(str)
sub["variant"] = sub.Driver_VarType.fillna("").astype(str)
sub["protein_change"] = sub.aa.where(sub.aa.str.startswith("p."), "").astype(str)
sub["zygosity"] = sub.Driver_VarZyg.fillna("").astype(str)
sub["mechanism"] = sub.Driver_Mech_InferDM.fillna("").astype(str)
sub["role"] = sub.Driver_GeneType_DM.fillna("").astype(str)

emit_arrow(sub[["cell_line", "name", "Organ", "depmap", "gene", "variant",
                "protein_change", "zygosity", "mechanism", "role"]]
           .rename(columns={"Organ": "organ"})
           .sort_values(["name", "role", "gene"]))
