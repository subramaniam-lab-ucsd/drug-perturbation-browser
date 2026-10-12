---
title: About the data
---

<div class="shell">

```js
const manifest = FileAttachment("data/manifest.json").json();
const familiesJ = FileAttachment("data/families.json").json();
const celllinesT = FileAttachment("data/celllines.arrow").arrow();
const drugsT = FileAttachment("data/drugs.arrow").arrow();
const driversT = FileAttachment("data/drivers.arrow").arrow();
```

```js
import {rows} from "./components/util.js";
const S = manifest.sources, families = familiesJ;
const lines = rows(celllinesT), drugs = rows(drugsT), drivers = rows(driversT);
```

<div class="page-head">
  <h1>About the data</h1>
  <p class="lede">What the browser contains, how each quantity was derived, and the
  inferences it does not support.</p>
</div>

## The dataset

Tahoe-100M: single-cell RNA sequencing of human cancer cell lines, each treated
with one small molecule at one of three concentrations, pooled many lines to a
plate.

```js
display(htl.html`<div class="cards">
  <div class="card"><div class="k">Drugs</div><div class="v">${drugs.length}</div>
    <div class="n">small molecules, most with an annotated mechanism</div></div>
  <div class="card"><div class="k">Cell lines</div><div class="v">${lines.length}</div>
    <div class="n">${new Set(lines.map((l) => l.organ)).size} tissues of origin</div></div>
  <div class="card"><div class="k">Concentrations</div><div class="v">3</div>
    <div class="n">0.05, 0.5 and 5 µM</div></div>
  <div class="card"><div class="k">Measurements</div>
    <div class="v">${S.n_conditions_fitted.toLocaleString()}</div>
    <div class="n">of ${S.n_conditions_total.toLocaleString()} attempted; the rest had
    too few cells to fit</div></div>
</div>`)
```

## How differential expression is measured

For one drug in one cell line at one concentration:

- The cells are pooled into a single expression profile per well.
- That well is compared against **every untreated DMSO control well of the same
  cell line**, with the plate accounted for, so a plate effect is not read as a drug
  effect.
- A gene counts as changed when it clears a 5% false-discovery rate. "Genes
  changed" everywhere on this site is that count.
- The direction and size of each gene's change is its log2 fold change: +1 means
  twice as much, −1 means half as much.

Nothing on this site compares a well against a DMSO control well from a different
cell line, and nothing is compared across plates.

## How transcription factor activity is inferred

Counting genes says how much happened, not what. For that, each gene's change is
mapped onto the transcription factors known to control it, using CollecTRI
regulons, giving one score per factor per measurement. A positive score means the
factor's target genes went up together, which is what a factor being switched on
looks like in RNA.

```js
display(htl.html`<p class="caption">${S.n_regulators} transcription factors are
  scored. Those with a well-understood readout are grouped into
  ${families.length} pathways:</p>
  <div class="fam-grid">${families.map((f) => htl.html`<div class="fam">
    <h4>${f.name}</h4><p>${f.note}</p>
    <p class="fam-m">${f.members.slice(0, 10).join(", ")}${f.members.length > 10
      ? `, and ${f.members.length - 10} more` : ""}</p></div>`)}</div>`)
```

Factors outside these groups are still scored and still appear in results, under
"other".

## Genotype annotation

```js
display(htl.html`<p>Each line carries an annotation of the cancer driver genes
  mutated in it: ${new Set(drivers.map((d) => d.gene)).size} genes across
  ${new Set(drivers.map((d) => d.cell_line)).size} lines. This is what lets you ask
  for, say, the KRAS-mutant lines, and what the results page uses to mark the lines
  carrying a drug's own target.</p>`)
```

## What this cannot tell you

- **Not potency.** Genes changed is a count of what moved, not an IC50. A drug
  can kill cells while changing few genes, and change thousands without killing
  anything.
- **Not mechanism, by itself.** A pathway score moving tells you that pathway's
  output changed. It does not establish that the drug acted through it.
- **Not a clean causal claim from a genotype split.** When mutant lines respond
  more strongly, the mutation is one of many things those lines differ in, tissue
  of origin included.
- **No growth, viability or protein measurement.** RNA only.

## Provenance

```js
display(htl.html`<div class="scrollx"><table class="prov">
  <tbody>
    <tr><th>Differential expression</th><td><code>${S.de_h5}</code></td></tr>
    <tr><th>Transcription-factor activity</th><td><code>${S.tf_h5}</code></td></tr>
    <tr><th>Cell line annotation</th><td><code>${S.line_meta}</code></td></tr>
    <tr><th>Drug annotation</th><td><code>${S.drug_meta}</code></td></tr>
    <tr><th>Sample annotation</th><td><code>${S.sample_meta}</code></td></tr>
    <tr><th>Genes changed</th><td>${S.deg_measure}</td></tr>
    <tr><th>Pathway score</th><td>${S.tf_measure}</td></tr>
    <tr><th>Built</th><td>${manifest.built_at.replace("T", " ")} ·
      <code>${manifest.git_sha_short}</code>${manifest.git_dirty ? " (uncommitted changes)" : ""}</td></tr>
  </tbody>
</table></div>`)
```

</div>
