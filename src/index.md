---
title: Drug Perturbation Browser
---

<div class="shell home">

```js
const drugsT = FileAttachment("data/drugs.arrow").arrow();
const celllinesT = FileAttachment("data/celllines.arrow").arrow();
const driversT = FileAttachment("data/drivers.arrow").arrow();
const conditionsT = FileAttachment("data/conditions.arrow").arrow();
const verdictsT = FileAttachment("data/verdicts.arrow").arrow();
```

```js
import {rows} from "./components/util.js";
import {encode, DOSES} from "./components/query.js";
import {multiBox} from "./components/multibox.js";
import {organIcon} from "./components/icons.js";

const drugs = rows(drugsT), lines = rows(celllinesT);
const drivers = rows(driversT), cond = rows(conditionsT), verdicts = rows(verdictsT);

const moas = Array.from(d3.rollup(drugs.filter((d) => d.moa), (v) => v.length, (d) => d.moa))
  .sort((a, b) => b[1] - a[1]);
const organs = Array.from(d3.rollup(lines, (v) => v.length, (l) => l.organ))
  .sort((a, b) => b[1] - a[1]);
const linesWithGene = d3.rollup(drivers, (v) => Array.from(new Set(v.map((d) => d.cell_line))),
                                (d) => d.gene);
const linesWithGenotype = d3.rollup(drivers.filter((d) => d.protein_change),
  (v) => Array.from(new Set(v.map((d) => d.cell_line))), (d) => `${d.gene} ${d.protein_change}`);
const genes = Array.from(linesWithGene).filter(([, v]) => v.length >= 3)
  .sort((a, b) => b[1].length - a[1].length);
const genotypes = Array.from(linesWithGenotype).filter(([, v]) => v.length >= 3)
  .sort((a, b) => b[1].length - a[1].length);
const nameOf = new Map(lines.map((l) => [l.cell_line, l.name]));
```

<div class="home-head">
  <div class="logo-lockup">
    <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7.5" fill="var(--color-brand-600)"/><rect x="7" y="19" width="4" height="7" rx="2" fill="#fff" opacity=".55"/><rect x="14" y="13" width="4" height="13" rx="2" fill="#fff" opacity=".8"/><rect x="21" y="6" width="4" height="20" rx="2" fill="var(--color-accent-500)"/></svg>
    <span class="brand-text">Drug Perturbation <span>Browser</span></span>
  </div>
</div>

```js
// Groups are shortcuts into the same flat list: picking "KRAS mutant" adds the
// lines, not a filter the rest of the app would have to carry.
const expandLine = (v) =>
  v.startsWith("gene:") ? linesWithGene.get(v.slice(5))
  : v.startsWith("genotype:") ? linesWithGenotype.get(v.slice(7))
  : v.startsWith("organ:") ? lines.filter((l) => l.organ === v.slice(6)).map((l) => l.cell_line)
  : null;
const expandDrug = (v) =>
  v.startsWith("moa:") ? drugs.filter((d) => d.moa === v.slice(4)).map((d) => d.drug) : null;

const drugBox = multiBox([
  ["By mechanism", moas.map(([m, n]) => [`moa:${m}`, m, `${n} drugs`])],
  ["By drug", drugs.slice().sort((a, b) => a.drug.localeCompare(b.drug))
     .map((d) => [d.drug, d.drug, d.moa ?? ""])]
], {expand: expandDrug, emptyLabel: `All ${drugs.length} drugs`,
    placeholder: "Search drugs or mechanisms…", ariaLabel: "Drugs"});
const drugSel = Generators.input(drugBox);

const lineBox = multiBox([
  ["By genotype", genotypes.map(([a, v]) => [`genotype:${a}`, a, `${v.length} lines`])],
  ["By mutated gene", genes.map(([g, v]) => [`gene:${g}`, `${g} mutant`, `${v.length} lines`])],
  ["By tissue", organs.map(([o, n]) =>
     [`organ:${o}`, htl.html`<span class="organ">${organIcon(o)}${o}</span>`, `${n} lines`])],
  ["By cell line", lines.slice().sort((a, b) => a.name.localeCompare(b.name))
     .map((l) => [l.cell_line, l.name, l.organ])]
], {expand: expandLine, emptyLabel: `All ${lines.length} cell lines`,
    placeholder: "Search cell lines, genotypes, genes or tissues…", ariaLabel: "Cell lines"});
const lineSel = Generators.input(lineBox);

// One concentration at a time. Pooling doses takes a median over a ten-fold
// spread, which is a number no single condition resembles.
const doseBox = htl.html`<div class="seg" role="radiogroup" aria-label="Concentration">
  ${DOSES.map((d) => htl.html`<button type="button" class="seg-b" data-v=${d}>${d} µM</button>`)}
</div>`;
{
  let v = "0.5";
  const paint = () => doseBox.querySelectorAll(".seg-b")
    .forEach((b) => b.classList.toggle("is-on", b.dataset.v === v));
  doseBox.querySelectorAll(".seg-b").forEach((b) => b.onclick = () => {
    v = b.dataset.v; paint();
    doseBox.dispatchEvent(new Event("input", {bubbles: true}));
  });
  Object.defineProperty(doseBox, "value", {get: () => v});
  paint();
}
const doseSel = Generators.input(doseBox);
```

<div class="query">

```js
display(htl.html`<div class="q-grid">
  <div class="q-field"><span class="q-label">Drugs</span>${drugBox}</div>
  <div class="q-field"><span class="q-label">Cell lines</span>${lineBox}</div>
  <div class="q-field q-dose"><span class="q-label">Concentration</span>${doseBox}</div>
</div>`)
```

```js
const nDrugs = drugSel.length || drugs.length;
const nLines = lineSel.length || lines.length;
const href = "./results?" + encode({drugs: drugSel, lines: lineSel,
                                    doses: [Number(doseSel)]});
```

```js
display(htl.html`<div class="q-actions">
  <a class="go" href=${href}>Show results</a>
  <span class="q-count">${nDrugs.toLocaleString()} drug${nDrugs === 1 ? "" : "s"} ×
    ${nLines} cell line${nLines === 1 ? "" : "s"} at ${doseSel} µM</span>
</div>`)
```

</div>

```js
// Starting points taken from the data: the drug whose effect is tied to one
// genotype, and the three with the largest transcriptional response.
const examples = (() => {
  const out = [];
  const hit = verdicts.find((v) => v.verdict === "specific_genotype");
  if (hit) out.push({drug: hit.drug, note: `needs ${hit.genotype.replace(":", " ")}`,
                     lines: (linesWithGenotype.get(hit.genotype.replace(":", " ")) ?? [])});
  for (const d of drugs.slice().sort((a, b) => b.median_deg - a.median_deg).slice(0, 3))
    out.push({drug: d.drug,
              note: `${Math.round(d.median_deg).toLocaleString()} DE genes, median line`,
              lines: []});
  return out;
})();
display(htl.html`<div class="examples">
  <span class="examples-k">Start with</span>
  ${examples.map((e) => htl.html`<a class="chip"
     href=${"./results?" + encode({drugs: [e.drug], lines: e.lines, doses: [0.5]})}>
     ${e.drug}<span>${e.note}</span></a>`)}
</div>`)
```

<div class="home-links">
  <a class="tile" href="./statistics">
    <span class="tile-k">Datasets</span><span class="tile-t">Tahoe-100M</span>
    <span class="tile-n">52,374 drug-by-cell-line contrasts across 376 small molecules,
    48 human cancer cell lines and three concentrations. Transcriptional potency by
    drug, intrinsic responsiveness by cell line, and transcription factor activity
    across the panel.</span></a>
  <a class="tile" href="./about">
    <span class="tile-k">About</span><span class="tile-t">Methods and provenance</span>
    <span class="tile-n">How each contrast was derived: DESeq2 against untreated DMSO
    controls, CollecTRI regulon activity, DepMap genotype annotation, and the
    inferences the data does not support.</span></a>
</div>

</div>
