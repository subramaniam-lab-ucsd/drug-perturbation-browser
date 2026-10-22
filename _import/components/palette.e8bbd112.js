// Okabe-Ito, matching the matplotlib figures in results/figures so the two read
// as one analysis. Validated with the dataviz palette checker:
//   categorical set [blue, orange, green, purple] passes all six checks in both
//   light and dark. Pink (#CC79A7) was dropped: it fails the normal-vision floor
//   against purple (dE 13.2 < 15).
export const BLUE = "#0072B2";     // the within-gene control, and series 1
export const ORANGE = "#D55E00";   // the carrier / the highlighted class
export const GREEN = "#009E73";
export const PURPLE = "#8C64B4";
export const GREY = "#B8B4AF";     // recessive only. Never an identity hue.

// fixed order, never cycled. A 5th category folds into "other".
export const CATEGORICAL = [BLUE, ORANGE, GREEN, PURPLE];
export const OTHER = GREY;

// sequential, one hue light to dark, for magnitude (the heatmap)
export const SEQUENTIAL = "blues";

// roles used across the genotype views, so colour means the same thing everywhere
export const ROLE = {
  carrier: ORANGE,          // carries the genotype under test
  otherVariant: BLUE,       // mutant in the target gene, different change
  wildType: GREY,           // no mutation in the target gene
  confirmed: ORANGE,        // q < 0.05
  notConfirmed: GREY
};

export const ROLE_LABEL = {
  carrier: "carries the genotype",
  otherVariant: "target gene mutant, different change",
  wildType: "target gene wild type"
};
