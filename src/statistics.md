---
title: Browse
---

<div class="shell">

```js
const conditionsT = FileAttachment("data/conditions.arrow").arrow();
const drugsT = FileAttachment("data/drugs.arrow").arrow();
const celllinesT = FileAttachment("data/celllines.arrow").arrow();
const regulatorsT = FileAttachment("data/regulators.arrow").arrow();
const familiesJ = FileAttachment("data/families.json").json();
```

```js
import * as Plot from "npm:@observablehq/plot";
import {rows, pubchemHref} from "./components/util.js";
import {extLink} from "./components/icons.js";
import {ALL, encode, pointerTip, doseKey} from "./components/query.js";
import {BLUE, ORANGE, GREY} from "./components/palette.js";

const cond = rows(conditionsT), drugs = rows(drugsT);
const lines = rows(celllinesT), regs = rows(regulatorsT), families = familiesJ;
const byLine = new Map(lines.map((l) => [l.cell_line, l]));
const cidOf = new Map(drugs.map((d) => [d.drug, d.pubchem_cid]));
const resultHref = (drug, dose) =>
  "./results?" + encode({dose: String(dose), drugKey: `drug:${drug}`, lineKey: ALL});
```

<div class="page-head">
  <h1>Panel-wide summary</h1>
  <p class="lede">Every drug-by-cell-line contrast in Tahoe-100M, at one concentration
  at a time. Select a drug to open its full result.</p>
</div>

```js
const dose = view(Inputs.radio([0.05, 0.5, 5], {label: "Concentration (µM)", value: 0.5}));
```

```js
const atDose = cond.filter((c) => doseKey(c.dose) === doseKey(dose));
const perDrug = d3.rollups(atDose, (v) => ({
    median: Math.round(d3.median(v, (c) => c.n_deg)), max: d3.max(v, (c) => c.n_deg),
    lines: v.length, responded: v.filter((c) => c.n_deg > 0).length}),
  (c) => c.drug).map(([drug, s]) => ({drug, ...s,
    moa: drugs.find((d) => d.drug === drug)?.moa ?? ""}));
const perLine = d3.rollups(atDose, (v) => d3.median(v, (c) => c.n_deg), (c) => c.cell_line)
  .map(([cell_line, median]) => ({cell_line, median: Math.round(median),
    name: byLine.get(cell_line)?.name ?? cell_line,
    organ: byLine.get(cell_line)?.organ ?? "?",
    broad: !!byLine.get(cell_line)?.responds_broadly}))
  .sort((a, b) => b.median - a.median);
```

```js
display(htl.html`<div class="cards">
  <div class="card"><div class="k">Contrasts</div>
    <div class="v">${atDose.length.toLocaleString()}</div>
    <div class="n">one drug against untreated DMSO controls, in one cell line, at ${dose} µM</div></div>
  <div class="card"><div class="k">Responsive</div>
    <div class="v">${Math.round(100 * atDose.filter((c) => c.n_deg > 0).length / atDose.length)}%</div>
    <div class="n">at least one differentially expressed gene</div></div>
  <div class="card"><div class="k">Median response</div>
    <div class="v">${Math.round(d3.median(atDose, (c) => c.n_deg)).toLocaleString()}</div>
    <div class="n">differentially expressed genes, median contrast</div></div>
  <div class="card"><div class="k">Maximal response</div>
    <div class="v">${d3.max(atDose, (c) => c.n_deg).toLocaleString()}</div>
    <div class="n">differentially expressed genes, ${(() => {const t = d3.greatest(atDose, (c) => c.n_deg);
      return `${t.drug} in ${byLine.get(t.cell_line)?.name ?? t.cell_line}`;})()}</div></div>
</div>`)
```

## Transcriptional potency by drug

```js
display((() => {
  const top = perDrug.slice().sort((a, b) => b.median - a.median).slice(0, 25);
  return htl.html`<p class="caption">Count of differentially expressed genes per drug.
    The bar is the median across cell lines, the point the single most responsive line.
    The 25 most potent of ${perDrug.length} drugs.</p>
    ${Plot.plot({
      height: 520, marginLeft: 176, marginRight: 30, style: {fontSize: "11.5px"},
      x: {type: "symlog", constant: 10, label: "genes changed (BH q < 0.05)",
          labelAnchor: "center", grid: true,
          ticks: [0, 10, 100, 1000, 10000], tickFormat: (v) => v.toLocaleString()},
      y: {domain: top.map((d) => d.drug), label: null},
      marks: [
        Plot.barX(top, {y: "drug", x: "median", fill: BLUE, rx: 3,
                        insetTop: 1.5, insetBottom: 1.5}),
        Plot.dot(top, {y: "drug", x: "max", fill: ORANGE, r: 3.5, stroke: "var(--surface)"}),
        pointerTip(top, {mode: "y", x: "max", y: "drug",
          title: (d) => `${d.drug}${d.moa ? `\n${d.moa}` : ""}\n`
            + `${d.median.toLocaleString()} genes in a typical line\n`
            + `${d.max.toLocaleString()} genes at its strongest\n`
            + `changed something in ${d.responded} of ${d.lines} lines`}),
        Plot.ruleX([0])
      ]})}`;
})())
```

```js
display(htl.html`<div class="scrollx">${Inputs.table(
  perDrug.slice().sort((a, b) => b.median - a.median).map((d) => ({
    drug: d.drug, mechanism: d.moa,
    "median DE genes": d.median, "maximal DE genes": d.max,
    "responsive lines": `${d.responded} / ${d.lines}`})),
  {rows: 16, layout: "auto", format: {
    drug: (x) => htl.html`<a class="xref" href=${resultHref(x, dose)}>${x}</a>${
      extLink(pubchemHref(cidOf.get(x)), `${x} on PubChem`)}`}})}</div>`)
```

## Intrinsic responsiveness by cell line

```js
display(htl.html`<p class="caption">Median differentially expressed gene count per
  cell line, taken across every drug. Lines that respond to nearly any perturbation are
  marked: a large response in them carries little information about the drug.</p>
  ${Plot.plot({
    height: Math.max(560, perLine.length * 17 + 70), marginLeft: 112, marginRight: 30,
    style: {fontSize: "11.5px"},
    x: {type: "symlog", constant: 10, label: "genes changed in a typical drug",
        labelAnchor: "center",
        grid: true, ticks: [0, 10, 100, 1000], tickFormat: (v) => v.toLocaleString()},
    y: {domain: perLine.map((d) => d.name), label: null},
    color: {domain: ["responds to almost everything", "the rest"], range: [ORANGE, GREY],
            legend: true},
    marks: [
      Plot.barX(perLine, {y: "name", x: "median", rx: 3, insetTop: 1.5, insetBottom: 1.5,
        fill: (d) => d.broad ? "responds to almost everything" : "the rest"}),
      pointerTip(perLine, {mode: "y", x: "median", y: "name",
        title: (d) => `${d.name}\n${d.organ}\n${d.median.toLocaleString()} genes in a typical drug`
          + (d.broad ? "\nresponds to almost every drug" : "")}),
      Plot.ruleX([0])
    ]})}`)
```

## Transcription factor activity across the panel

```js
display((() => {
  const at = regs.filter((r) => doseKey(r.dose) === doseKey(dose));
  const nDrugs = new Set(at.map((r) => r.drug)).size;
  // "Share of drugs where at least one factor moved" saturates at 100% for
  // every family, and the share averaged over factors is a fraction nobody can
  // picture. A count of factors is concrete: in a typical drug, N of this
  // family's M were switched on or off.
  const fam = d3.rollups(at, (v) => {
      const perDrug = d3.rollup(v, (w) => w.filter((r) => Math.abs(r.z) > 2).length,
                                (r) => r.drug);
      return {moved: d3.sum(perDrug.values()) / nDrugs,
              regulators: new Set(v.map((r) => r.regulator)).size,
              top: d3.greatest(v, (r) => Math.abs(r.z))};
    }, (r) => r.family).map(([family, s]) => ({family, ...s}))
    .sort((a, b) => b.moved - a.moved);
  const note = new Map(families.map((f) => [f.name, f.note]));
  return htl.html`<p class="caption">Number of each pathway's transcription factors
    whose inferred activity is confidently altered by a typical drug at
    ${dose} µM.</p>
    ${Plot.plot({
      height: Math.max(220, fam.length * 26 + 56), marginLeft: 186, marginRight: 30,
      style: {fontSize: "11.5px"},
      x: {label: "transcription factors with |ULM t| > 2, in a typical drug",
        labelAnchor: "center",
        grid: true},
      y: {domain: fam.map((d) => d.family), label: null},
      marks: [
        Plot.barX(fam, {y: "family", x: "moved", fill: BLUE, rx: 3,
                        insetTop: 2, insetBottom: 2}),
        pointerTip(fam, {mode: "y", x: "moved", y: "family",
          title: (d) => `${d.family}\n${note.get(d.family) ?? ""}\n`
            + `${d.moved.toFixed(1)} of its ${d.regulators} factors move in a typical drug\n`
            + `moved furthest by ${d.top.drug} (${d.top.regulator})`}),
        Plot.ruleX([0])
      ]})}`;
})())
```

```js
display((() => {
  const at = regs.filter((r) => doseKey(r.dose) === doseKey(dose));
  const t = d3.rollups(at, (v) => ({
      family: v[0].family,
      up: d3.greatest(v, (r) => r.z), down: d3.least(v, (r) => r.z),
      moved: d3.mean(v, (r) => Math.abs(r.z) > 2)}),
    (r) => r.regulator).map(([regulator, s]) => ({
      "transcription factor": regulator, pathway: s.family,
      "altered in": `${(100 * s.moved).toFixed(0)}% of drugs`,
      "most induced by": s.up.drug, "most repressed by": s.down.drug}))
    .sort((a, b) => parseFloat(b["altered in"]) - parseFloat(a["altered in"]));
  return htl.html`<div class="scrollx">${Inputs.table(t, {rows: 16, layout: "auto", format: {
    "most induced by": (x) => htl.html`<a class="xref" href=${resultHref(x, dose)}>${x}</a>`,
    "most repressed by": (x) => htl.html`<a class="xref" href=${resultHref(x, dose)}>${x}</a>`
  }})}</div>`;
})())
```

</div>
