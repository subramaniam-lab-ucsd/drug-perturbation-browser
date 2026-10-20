---
title: Results
---

<div class="shell">

```js
const conditionsT = FileAttachment("data/conditions.arrow").arrow();
const drugsT = FileAttachment("data/drugs.arrow").arrow();
const celllinesT = FileAttachment("data/celllines.arrow").arrow();
const driversT = FileAttachment("data/drivers.arrow").arrow();
const regulatorsT = FileAttachment("data/regulators.arrow").arrow();
const ladderT = FileAttachment("data/ladder.arrow").arrow();
const verdictsT = FileAttachment("data/verdicts.arrow").arrow();
const factorsT = FileAttachment("data/ladder_factors.arrow").arrow();
const neighboursT = FileAttachment("data/neighbourhood.arrow").arrow();
const familiesJ = FileAttachment("data/families.json").json();
const manifest = FileAttachment("data/manifest.json").json();
```

```js
import * as Plot from "npm:@observablehq/plot";
import {tableFromIPC} from "npm:apache-arrow";
import {rows} from "./components/util.js";
import {decode, encode, pointerTip, pearson, doseKey, doseSetOf} from "./components/query.js";
import {BLUE, ORANGE, GREY} from "./components/palette.js";
import {organIcon, pencil, caret} from "./components/icons.js";
import {tabs, showTab} from "./components/tabs.js";
import {comboBox} from "./components/combobox.js";

// htl.html`` with no content returns null, and display(null) prints the word
// "null" into the panel. Everything conditional returns nothing() instead.
const nothing = () => document.createComment("");

// Every panel says what the number means in one plain sentence, and hides the
// method behind this. A <details> rather than a modal: no focus trap to get
// wrong, it prints, and it is keyboard-accessible for free.
const method = (body) => htl.html`<details class="method">
  <summary><span class="i" aria-hidden="true">i</span>How this is computed</summary>
  <div class="method-body">${body}</div></details>`;

const cond = rows(conditionsT), drugs = rows(drugsT);
const lines = rows(celllinesT), drivers = rows(driversT);
const regSummary = rows(regulatorsT), families = familiesJ;
const ladder = rows(ladderT), verdicts = rows(verdictsT);
const factors = rows(factorsT), neighbours = rows(neighboursT);
const verdictOf = new Map(verdicts.map((v) => [v.drug, v]));

const byDrug = new Map(drugs.map((d) => [d.drug, d]));
const byLine = new Map(lines.map((l) => [l.cell_line, l]));
const mutsOf = d3.group(drivers, (d) => d.cell_line);

const Q = decode(location.search, {drugMeta: drugs, lineMeta: lines});
const drugSet = new Set(Q.drugs.map((d) => d.drug));
const lineSet = new Set(Q.lines.map((l) => l.cell_line));
const doseSet = doseSetOf(Q.doses);
const sel = cond.filter((c) => doseSet.has(doseKey(c.dose)) && drugSet.has(c.drug) && lineSet.has(c.cell_line));
const selDrugs = Array.from(new Set(sel.map((c) => c.drug))).sort(d3.ascending);
const one = selDrugs.length === 1 ? selDrugs[0] : null;
const multiDose = Q.doses.length > 1;
const nameOf = (c) => byLine.get(c)?.name ?? c;
const organOf = (c) => byLine.get(c)?.organ ?? "unknown";

// Framework's `width` is the width of `main`, which is full-bleed here, so it
// reports the viewport and not the panel a chart actually sits in. Derive the
// real boxes once: .shell caps at 80rem with 24px gutters, .panel adds 22px
// each side, and .two-up.even splits what is left in two with a 20px gap.
const SHELL = Math.min(width, 1280) - 48;
const PANEL = SHELL - 44;
const HALF = Math.floor((PANEL - 20) / 2);
```

```js
// "47 cell lines" is the only place the page says what the query actually
// covers, and a reader who wants the names had to go back to the form to see
// them. Make the count itself open a list of what it stands for.
//
// A native <details> rather than a hand-rolled menu: keyboard, focus and
// screen-reader behaviour come for free, and it degrades to an open list with
// no JS. The body is positioned over the page rather than inline so that
// opening it does not push every panel down. Each entry narrows the query to
// that one drug or cell line, which is the thing a reader reaches for next.
//
// One shape for any number: below two entries there is nothing to reveal and
// the summary stays plain text, and past a couple of dozen the list gets a
// filter, so 1 drug × 1 line and 379 drugs × 48 lines are the same control.
const FILTER_FROM = 18;
function peek(summary, items, {title, kind}) {
  if (items.length < 2) return summary;
  // Appended rather than interpolated: htl wraps each element of an array in a
  // <span>, which would make the spans the flex items and the pills their
  // contents, and put a layer between the filter and what it hides.
  const list = htl.html`<div class="peek-list"></div>`;
  list.append(...items.map((it) => htl.html`<a class="peek-item" href=${it.href}
    data-k=${(it.name + " " + (it.note ?? "")).toLowerCase()} title=${it.hint ?? ""}
    >${it.icon ?? ""}<span class="peek-n">${it.name}</span>${
      it.note ? htl.html`<span class="peek-s">${it.note}</span>` : ""}</a>`));
  const filter = items.length >= FILTER_FROM
    ? htl.html`<input class="peek-f" type="search" placeholder=${`Filter ${kind}…`}
        oninput=${(e) => {
          const q = e.currentTarget.value.trim().toLowerCase();
          let n = 0;
          for (const el of list.children) {
            const hit = !q || el.dataset.k.includes(q);
            el.hidden = !hit;
            if (hit) n++;
          }
          none.hidden = n > 0;
        }}>`
    : "";
  const none = htl.html`<div class="peek-none" hidden>Nothing matches.</div>`;
  return htl.html`<details class="peek">
    <summary>${summary}${caret({size: 12})}</summary>
    <div class="peek-body">
      <div class="peek-h">${title}<span>narrow the query to one</span></div>
      ${filter}${list}${none}
    </div>
  </details>`;
}

// Keep the dose and the other half of the query; replace only this axis.
const narrowTo = (part) => "?" + encode({
  drugs: Q.drugKeys, lines: Q.lineKeys, doses: Q.allDoses ? [] : Q.doses, ...part});
```

```js
// Once, not per render: the block has no reactive inputs, so it is not re-run.
document.addEventListener("click", (e) => {
  for (const d of document.querySelectorAll("details.peek[open]"))
    if (!d.contains(e.target)) d.open = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  for (const d of document.querySelectorAll("details.peek[open]")) d.open = false;
});
```

```js
display((() => {
  // Drugs and cell lines that the query actually returned measurements for, so
  // the list and the count beside it cannot disagree.
  // "unclear" is the placeholder in drugs.arrow for an unannotated mechanism;
  // as a note beside 300 names it reads as a column of noise.
  const moa = (d) => { const m = byDrug.get(d)?.moa; return !m || m === "unclear" ? "" : m; };
  const drugItems = selDrugs.map((d) => ({
    name: d, note: moa(d), hint: byDrug.get(d)?.targets ?? "",
    href: narrowTo({drugs: [d]})}));
  const lineItems = perLine.slice().sort((a, b) => d3.ascending(a.name, b.name))
    .map((l) => ({
      name: l.name, note: l.organ, icon: organIcon(l.organ),
      hint: `${l.n_deg.toLocaleString()} genes changed (median)`,
      href: narrowTo({lines: [l.cell_line]})}));
  return htl.html`<div class="result-head">
    <div>
      <h1>${peek(Q.labelDrug, drugItems,
        {title: `${drugItems.length.toLocaleString()} drugs in this query`, kind: "drugs"})}</h1>
      <div class="sub">${Q.labelDose} · ${peek(
        nLinesWithData === lines.length ? "all cell lines"
        : nLinesWithData === 1 ? perLine[0].name
        : `${nLinesWithData} cell lines`, lineItems,
        {title: `${lineItems.length} cell lines in this query`, kind: "cell lines"})
      } · ${sel.length.toLocaleString()} measurement${sel.length === 1 ? "" : "s"}</div>
    </div>
    <a class="btn-ghost" href=${"./?" + location.search.slice(1)}>${pencil()}Edit query</a>
  </div>`;
})())
```

```js
// The verdict comes from analysis/verdicts.py, which applies a closed set of
// rules in a fixed order. Nothing here picks the best-looking number.
const verdict = one ? verdictOf.get(one) ?? null : null;
// verdicts.arrow covers all 379 drugs and ladder.arrow every drug that has a
// test, so this tab has no selection cap.
const selVerdicts = selDrugs.map((d) => verdictOf.get(d)).filter(Boolean);
const ladderSel = ladder.filter((r) => drugSet.has(r.drug));
// Every dose, not just the selected one: verdicts.py decides across all three,
// so showing one dose made the verdict cite an axis the table did not show.
const lad = one ? ladder.filter((r) => r.drug === one) : [];
const hitRows = lad.filter((r) => r.deg_hit || r.path_hit || r.block_hit);
// Prefer the conditional rung, then the selected dose, then anything that hit.
const bestRow = verdict?.genotype
  ? [...hitRows.filter((r) => r.genotype === verdict.genotype)].sort((a, b) =>
      (b.contrast === "conditional") - (a.contrast === "conditional") ||
      (doseSet.has(doseKey(b.dose))) - (doseSet.has(doseKey(a.dose))) ||
      d3.ascending(a.deg_q ?? 1, b.deg_q ?? 1))[0] ?? hitRows[0]
  : null;

const VERDICT = {
  specific_genotype: ["Genotype-selective", "is-hit"],
  specific_genotype_vs_wild_type: ["Genotype-associated", "is-hit"],
  gene_level: ["Gene-level association", ""],
  pathway_level: ["Pathway-level, genotype-independent", ""],
  no_genotype_dependence: ["No genotype dependence", ""],
  underpowered: ["Insufficient carriers to stratify", ""],
  untestable_in_panel: ["Target not represented in this panel", ""],
  not_genotype_targeted: ["No genotype-directed target", ""]
};

// Lines carrying the genotype the verdict names, for the highlight in the chart.
const markedLesion = bestRow
  ? new Set(drivers.filter((d) =>
      d.gene === bestRow.gene &&
      (bestRow.alteration === "any mutation" || d.protein_change === bestRow.alteration))
      .map((d) => d.cell_line))
  : new Set();
const targetGene = bestRow?.gene ?? (one ? (() => {
  const present = new Set(drivers.map((d) => d.gene));
  return (byDrug.get(one)?.targets ?? "").split(/[,;]/).map((x) => x.trim())
    .find((g) => present.has(g)) ?? null;
})() : null);
const geneLines = targetGene
  ? new Set(drivers.filter((d) => d.gene === targetGene).map((d) => d.cell_line))
  : new Set();
const marked = markedLesion.size ? markedLesion : geneLines;
const markLabel = bestRow
  ? (bestRow.alteration === "any mutation" ? `${bestRow.gene} mutant` : bestRow.genotype.replace(":", " "))
  : targetGene ? `${targetGene} mutant` : null;
```

```js
const perLine = d3.rollups(sel, (v) => ({
    n_deg: d3.median(v, (c) => c.n_deg),
    n_up: d3.median(v, (c) => c.n_up),
    n_down: d3.median(v, (c) => c.n_down)}), (c) => c.cell_line)
  .map(([cell_line, {n_deg, n_up, n_down}]) => ({
    cell_line, n_deg, n_up, n_down, name: nameOf(cell_line),
    organ: byLine.get(cell_line)?.organ ?? "?",
    broad: !!byLine.get(cell_line)?.responds_broadly,
    marked: marked.has(cell_line),
    muts: (mutsOf.get(cell_line) ?? []).filter((m) => m.role === "Oncogene")
      .map((m) => m.protein_change ? `${m.gene} ${m.protein_change}` : `${m.gene} ${m.variant}`).slice(0, 6)
      .join("; ")}))
  .sort((a, b) => b.n_deg - a.n_deg);
const nResp = sel.filter((c) => c.n_deg > 0).length;
// Lines that were asked for but carry no measurement are not claimed as data.
const nLinesWithData = new Set(sel.map((c) => c.cell_line)).size;
```

```js
const tab = view(tabs([
  ["overview",    "Overview",                      "response magnitude and genotype"],
  ["deg",         "Differential Expression",       "Upregulated and downregulated genes"],
  ["tf",          "Transcription Factor Activity", "Regulon-inferred TF activity"],
  ["similarity",  "Profile Similarity",            "Correlation between conditions"],
  ["association", "Genotype Specificity",          "Response by oncogenic genotype"]
], {value: "overview"}));
```

```js
showTab(tab);
```

<div class="dash tabpanel" data-tab="overview">

<aside class="panel">
  <div class="panel-h">Query summary</div>

```js
const facts = (() => {
  // A contrast is one drug in one cell line at one concentration. Every figure
  // is taken over the contrasts the query actually returned, so a cell line
  // asked for but not assayed never appears in a denominator.
  const n = sel.length;
  const deg = sel.map((c) => c.n_deg);
  const up = d3.sum(sel, (c) => c.n_up), down = d3.sum(sel, (c) => c.n_down);
  const strongest = n ? d3.greatest(sel, (c) => c.n_deg) : null;
  const q = (v) => v.toLocaleString();
  return [
    ["Drugs", q(selDrugs.length), ""],
    ["Cell lines", String(nLinesWithData), ""],
    ["Concentration", Q.doses.map((d) => `${d}`).join(", ") + " µM", ""],
    ["Contrasts returned", q(n), "drug × cell line × concentration"],
    ["Responsive contrasts", n ? `${Math.round(100 * nResp / n)}%` : "0%",
     `${q(nResp)} with at least one DE gene`],
    ["Median DE genes", n ? q(d3.median(deg)) : "\u2014", "per contrast"],
    ["Interquartile range", n ? `${q(Math.round(d3.quantile(deg.slice().sort(d3.ascending), .25)))}`
       + `\u2013${q(Math.round(d3.quantile(deg.slice().sort(d3.ascending), .75)))}` : "\u2014",
     "DE genes per contrast"],
    ["Maximum DE genes", n ? q(d3.max(deg)) : "\u2014",
     strongest ? `${nameOf(strongest.cell_line)}${selDrugs.length > 1 ? `, ${strongest.drug}` : ""}` : ""],
    ["Induced : repressed", up + down ? `${Math.round(100 * up / (up + down))} : `
       + `${100 - Math.round(100 * up / (up + down))}` : "\u2014",
     "across all DE genes returned"],
    ...(one && byDrug.get(one)?.moa ? [["Annotated mechanism", byDrug.get(one).moa, ""]] : []),
    ...(one && byDrug.get(one)?.targets ? [["Annotated targets", byDrug.get(one).targets, ""]] : [])
  ];
})();
// One element per fact rather than a <dl>: a grid of dt/dd puts the label and
// the value in different columns, and Framework's own dl rule wins anyway.
display(htl.html`<p class="caption">Scope of the current query and the genotype
  verdict it supports. Every figure below is computed over the
  ${sel.length.toLocaleString()} contrast${sel.length === 1 ? "" : "s"} actually
  returned, not the full panel.</p>
  <div class="facts">${facts.map(([k, v, n]) => htl.html`
  <div class="fact"><span class="fact-k">${k}</span>
    <span class="fact-v">${v}${n ? htl.html` <span class="dim">${n}</span>` : ""}</span>
  </div>`)}</div>`)
```

```js
display((() => {
  if (!one) return nothing();
  if (!verdict) return nothing();
  const [label, cls] = VERDICT[verdict.verdict] ?? [verdict.verdict, ""];
  const axes = verdict.axes ? verdict.axes.split(", ") : [];
  return htl.html`<div class="split ${cls}">
    <div class="split-h">${label}</div>
    ${bestRow ? htl.html`<p class="verdict-genotype">${bestRow.gene} ${bestRow.alteration}</p>` : ""}
    <p class="caption">${verdict.reason[0].toUpperCase() + verdict.reason.slice(1)}.</p>
    ${axes.length ? htl.html`<p class="caption">Supported by
      ${axes.length === 1 ? "" : "all three measures: "}${axes.join(", ")}.</p>` : ""}
    ${/* CAUTION BANNER, TEMPORARILY OFF. Restore together with the one in the
          similarity panel and with the two assertions in check.mjs that are
          commented out beside them.
       bestRow?.lineage_confounded ? htl.html`<p class="caution">Carriers come from
         ${bestRow.organs}, so tissue of origin cannot be fully separated from the
         mutation here.</p>` : "" */ ""}
  </div>`;
})())
```

</aside>

<section class="panel">
  <div class="panel-h">Oncogenic genotype of the selected cell lines</div>

```js
display((() => {
  // lines that actually carry a measurement, so this agrees with the header
  const withData = new Set(sel.map((c) => c.cell_line));
  const d = drivers.filter((x) => withData.has(x.cell_line));
  if (!d.length) return htl.html`<div class="empty">No DepMap annotation for these lines.</div>`;
  const onco = d.filter((x) => x.role === "Oncogene");
  const g = d3.rollups(d, (v) => ({
      lines: new Set(v.map((x) => x.cell_line)).size, role: v[0].role,
      changes: Array.from(new Set(v.map((x) => x.protein_change).filter(Boolean))).slice(0, 6).join(", "),
      examples: Array.from(new Set(v.map((x) => x.name))).slice(0, 8).join(", ")}),
    (x) => x.gene).map(([gene, s]) => ({gene, ...s}))
    .sort((a, b) => b.lines - a.lines).slice(0, 24);
  // A cell listing every alteration ran the table to 6,000px. Clip it and
  // keep the whole string in the title, which is where a long list belongs.
  const clip = (v, n = 40) => {
    const el = htl.html`<span title=${v}>${v.length > n ? v.slice(0, n - 1) + "\u2026" : v}</span>`;
    return el;
  };
  const table = Array.from(d3.group(d, (x) => x.name), ([name, v]) => ({
    "cell line": name, tissue: v[0].organ,
    DepMap: v[0].depmap || "\u2014",
    oncogenes: v.filter((x) => x.role === "Oncogene")
      .map((x) => x.protein_change || x.variant ? `${x.gene} ${x.protein_change || x.variant}` : x.gene).join(", "),
    "tumour suppressors": v.filter((x) => x.role === "Suppressor")
      .map((x) => x.protein_change || x.variant ? `${x.gene} ${x.protein_change || x.variant}` : x.gene).join(", ")
  })).sort((a, b) => a["cell line"].localeCompare(b["cell line"]));
  return htl.html`<p class="caption">Cancer driver genes annotated as mutated in the
    selected lines: ${new Set(onco.map((x) => x.gene)).size} oncogenes, which confer a
    gain of function when altered, and
    ${new Set(d.filter((x) => x.role === "Suppressor").map((x) => x.gene)).size} tumour
    suppressors, which confer a loss of function, across
    ${new Set(d.map((x) => x.cell_line)).size} cell lines. These annotations define the
    strata used under <b>Genotype Specificity</b>.</p>
    ${method(htl.html`DepMap driver calls as shipped with Tahoe-100M. Role is
    <code>Driver_GeneType_DM</code>; the protein consequence is
    <code>Driver_ProtEffect_or_CdnaEffect</code> where annotated, otherwise the variant
    class. Only oncogene genotypes carried by at least two assayed cell lines enter the
    tests, which is 12 of them.`)}
    ${Plot.plot({
        width: HALF,
        height: Math.max(200, g.length * 16 + 50), marginLeft: 94, marginRight: 20,
        style: {fontSize: "11px"},
        x: {label: "cell lines carrying the alteration", labelAnchor: "center", grid: true},
        y: {domain: g.map((x) => x.gene), label: null},
        color: {domain: ["Oncogene", "Suppressor"], range: [ORANGE, GREY], legend: true},
        marks: [
          Plot.barX(g, {y: "gene", x: "lines", fill: "role", rx: 3,
                        insetTop: 1, insetBottom: 1}),
          pointerTip(g, {mode: "y", x: "lines", y: "gene", fields: {
            "": (x) => x.gene, "Role": (x) => x.role.toLowerCase(),
            "Cell lines": (x) => String(x.lines),
            "Protein change": (x) => x.changes || null,
            "Examples": (x) => x.examples}}),
          Plot.ruleX([0])
        ]})}
    <div class="subpanel">
      <div class="sub-h">Annotated alterations per cell line</div>
      <div>${Inputs.table(table, {rows: 11, height: 340, select: false,
        // half-width panel now: fixed columns that sum inside it, rather than
        // auto layout running the table out to 1,000px behind a scrollbar
        layout: "fixed", maxWidth: HALF - 28,
        width: {"cell line": 104, tissue: 92, DepMap: 74,
                oncogenes: 126, "tumour suppressors": 126},
        format: {
          "cell line": (v) => htl.html`<b>${v}</b>`,
          tissue: (v) => htl.html`<span class="organ">${organIcon(v)}${v}</span>`,
          oncogenes: (v) => clip(v), "tumour suppressors": (v) => clip(v)},
        header: {DepMap: "ID"}})}</div>
    </div>`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Differential expression magnitude by cell line</div>

```js
display((() => {
  if (!sel.length) return htl.html`<div class="empty">Nothing matches. <a href="./">Change the query</a>.</div>`;
  if (one) {
    const d = perLine;
    // Back to back rather than stacked. The response spans three orders of
    // magnitude, so a stacked bar needs a linear axis and every cell line
    // under a hundred genes collapses onto the axis. Mirroring about zero
    // keeps the symlog scale and still reads as one bar per line.
    const split = d.flatMap((r) => [
      {...r, direction: "repressed", n: -r.n_down},
      {...r, direction: "induced", n: r.n_up}]);
    const lim = d3.max(d, (r) => Math.max(r.n_up, r.n_down)) || 1;
    return htl.html`
      <p class="caption">Genes differentially expressed in each cell line, split by
        direction: induced above the untreated DMSO controls to the right, repressed
        below them to the left. Each treated well is contrasted against every DMSO
        control well of the same cell line. The axis is symlog in both directions, so
        a line changing ten genes stays visible beside one changing two
        thousand.${markLabel ? htl.html` Lines carrying <b>${markLabel}</b> are marked.` : ""}</p>
      ${method(htl.html`Genes counted at Benjamini-Hochberg adjusted <i>p</i> &lt; 0.05
        from the PyDESeq2 Wald test, design <code>~plate + condition</code>. Direction
        is the sign of the Wald statistic over that same significant set, counted in
        full rather than from the truncated per-drug detail, so the two arms sum to the
        total. Genes pre-filtered at <code>min_counts = 10</code> per subset.${multiDose
        ? " Each arm is the median over the selected concentrations." : ""}`)}
      ${Plot.plot({
        width: PANEL,
        height: Math.max(260, d.length * 15 + 66), marginLeft: 118, marginRight: 58,
        style: {fontSize: "11px"},
        x: {type: "symlog", constant: 10, domain: [-lim, lim],
            label: "repressed \u2190 differentially expressed genes \u2192 induced",
            labelAnchor: "center", grid: true,
            ticks: [-1000, -100, -10, 0, 10, 100, 1000].filter((v) => Math.abs(v) <= lim * 1.5),
            tickFormat: (v) => Math.abs(v).toLocaleString()},
        y: {domain: d.map((r) => r.name), label: null},
        color: {domain: ["repressed", "induced"], range: [BLUE, ORANGE], legend: true},
        marks: [
          Plot.barX(split, {y: "name", x: "n", fill: "direction", rx: 2,
                            insetTop: 1, insetBottom: 1}),
          Plot.text(d.filter((r) => r.n_deg > 0), {y: "name", x: (r) => r.n_up,
            text: (r) => r.n_deg.toLocaleString(), dx: 7, textAnchor: "start",
            fontSize: 9.5, fill: "var(--color-ink-900)"}),
          pointerTip(split, {mode: "y", x: "n", y: "name", fields: {
            "": (r) => r.name,
            "Tissue": (r) => r.organ,
            "Induced": (r) => r.n_up.toLocaleString(),
            "Repressed": (r) => r.n_down.toLocaleString(),
            "Total": (r) => r.n_deg.toLocaleString(),
            "Genotype": (r) => r.marked ? markLabel : null,
            "Note": (r) => r.broad ? "responds to most drugs" : null}}),
          Plot.ruleX([0])
        ]})}`;
  }
  const rank = d3.rollups(sel, (v) => d3.median(v, (c) => c.n_deg), (c) => c.drug)
    .sort((a, b) => b[1] - a[1]);
  const shown = rank.slice(0, 40).map((r) => r[0]);
  const cols = d3.rollups(sel, (v) => d3.median(v, (c) => c.n_deg), (c) => c.cell_line)
    .sort((a, b) => b[1] - a[1]).map((r) => nameOf(r[0]));
  const cells = d3.rollups(sel.filter((c) => shown.includes(c.drug)),
    (v) => d3.median(v, (c) => c.n_deg), (c) => c.drug, (c) => c.cell_line)
    .flatMap(([drug, v]) => v.map(([cl, n_deg]) => ({
      drug, cell_line: cl, n_deg, name: nameOf(cl),
      organ: byLine.get(cl)?.organ ?? "?"})));
  const hi = d3.quantile(cells.map((c) => c.n_deg).sort(d3.ascending), 0.8) ?? 100;
  // Size the cells to the panel rather than fixing them and overflowing. An
  // invisible horizontal scrollbar hides half a heatmap.
  const ml = 190, mr = 24;
  const cw = Math.max(7, Math.min(22, Math.floor((PANEL - ml - mr) / cols.length)));
  return htl.html`<p class="caption">How many genes each drug changed in each cell
      line. Darker means a bigger response.${rank.length > 40 ? ` The 40 strongest of
      ${rank.length} drugs.` : ""}</p>
    ${method(htl.html`Genes at Benjamini-Hochberg adjusted <i>p</i> &lt; 0.05 per
      drug-by-cell-line condition. Colour is symlog, clamped at the 80th percentile so
      that a handful of very strong conditions do not flatten everything else. Drugs are
      ranked by their median across cell lines.`)}
    <div class="scrollx">${Plot.plot({
      width: Math.min(PANEL, cols.length * cw + ml + mr),
      height: Math.max(220, shown.length * 15 + 150),
      marginLeft: ml, marginTop: 136, marginBottom: 6, marginRight: mr,
      style: {fontSize: "10.5px"},
      x: {domain: cols, tickRotate: -50, label: null, axis: "top"},
      y: {domain: shown, label: null},
      color: {type: "symlog", constant: 10, scheme: "blues", legend: true, clamp: true,
              range: [0.1, 1], domain: [0, hi], label: "genes changed",
              ticks: [0, 10, 100, 1000, 10000].filter((v) => v <= hi),
              tickFormat: (v) => v.toLocaleString()},
      marks: [
        Plot.cell(cells, {x: "name", y: "drug", fill: "n_deg", inset: 0.5}),
        pointerTip(cells, {x: "name", y: "drug", fields: {
          "": (c) => c.drug, "Cell line": (c) => c.name,
          "Tissue": (c) => c.organ,
          "Genes changed": (c) => c.n_deg.toLocaleString()}})
      ]})}</div>`;
})())
```
</section>

</div>

<div class="dash tabpanel" data-tab="deg" hidden>

<section class="panel span2">
  <div class="panel-h">Differentially expressed genes by cell line</div>

```js
display((() => {
  if (tooManyForDetail) return htl.html`<div class="empty">Gene-level detail is fetched
    one file per drug, so it is capped at ${MAX_DETAIL}; ${selDrugs.length} drugs are
    selected. Narrow the query, or use <b>Pathway activity</b> and
    <b>Genotype Specificity</b>, which cover every drug.</div>`;
  const g = geneRows.filter((r) => doseSet.has(doseKey(r.dose)) && lineSet.has(r.cell_line));
  if (!g.length) return htl.html`<div class="empty">No gene changed here.</div>`;

  // With one drug the interesting axis is the cell line; with several it is the
  // drug, because the question becomes whether they change the same genes.
  const byDrug = selDrugs.length > 1;
  const keyOf = (d) => byDrug ? d.drug : d.cell_line;
  const labelOf = (k) => byDrug ? k : nameOf(k);
  const cells = d3.rollups(g, (v) => d3.median(v, (d) => d.log2fc),
                           (d) => d.gene, keyOf)
    .flatMap(([gene, v]) => v.map(([k, lfc]) => ({gene, key: k, lfc, name: labelOf(k)})));
  const recur = d3.rollup(cells, (v) => v.length, (d) => d.gene);
  const strength = d3.rollup(cells, (v) => d3.median(v, (d) => d.lfc), (d) => d.gene);
  const MAXG = 40;
  const genes = Array.from(recur.keys())
    .sort((a, b) => recur.get(b) - recur.get(a)
                 || Math.abs(strength.get(b)) - Math.abs(strength.get(a)))
    .slice(0, MAXG)
    .sort((a, b) => strength.get(a) - strength.get(b));
  const keep = new Set(genes);
  const shown = cells.filter((c) => keep.has(c.gene));
  const order = byDrug
    ? d3.rollups(g, (v) => new Set(v.map((d) => d.gene)).size, (d) => d.drug)
        .sort((a, b) => b[1] - a[1]).map(([d]) => d)
    : d3.rollups(sel, (v) => d3.median(v, (c) => c.n_deg), (c) => c.cell_line)
        .sort((a, b) => b[1] - a[1])
        .filter(([cl]) => shown.some((c) => c.key === cl)).map(([cl]) => nameOf(cl));
  const lim = d3.max(shown, (c) => Math.abs(c.lfc));
  const truncated = d3.rollups(g, (v) => v.length, (d) => `${d.drug}|${d.cell_line}`)
    .filter(([, n]) => n >= 60).length;
  const ml = 118, mr = 20;
  const cw = Math.max(7, Math.min(24, Math.floor((PANEL - ml - mr) / order.length)));
  return htl.html`<p class="caption">${byDrug
      ? htl.html`Fold change of each differentially expressed gene across the
        ${selDrugs.length} selected drugs, pooled over ${nLinesWithData} cell lines.
        Genes induced or repressed by several drugs indicate a shared transcriptional
        programme; those confined to one column are drug-specific.`
      : htl.html`Fold change of each differentially expressed gene across the selected
        cell lines, ordered by response magnitude. A contiguous block confined to the
        responding lines indicates a programme specific to them.`}
      Red denotes induction, blue repression; an empty cell indicates the gene was not
      differentially expressed in that condition. The
      ${Math.min(MAXG, recur.size)} most widely shared of ${recur.size} genes.</p>
    ${method(htl.html`Colour is the median unshrunk log2 fold change over the selected
      concentrations${byDrug ? " and cell lines" : ""}, for genes clearing a 5% false
      discovery rate. Upstream only the 30 strongest per direction per condition are
      stored, so an empty square means "not among the 30 strongest in that direction"
      rather than strictly "unchanged".${truncated ? ` ${truncated} of the conditions
      here changed more than 60 genes and are therefore truncated.`
      : " No condition here exceeded that cap, so these are complete."}`)}
    <div class="scrollx">${Plot.plot({
      width: Math.min(PANEL, order.length * cw + ml + mr),
      height: genes.length * 15 + 150,
      marginLeft: ml, marginTop: 128, marginBottom: 8, marginRight: mr,
      style: {fontSize: "10.5px"},
      x: {domain: order, tickRotate: -55, label: null, axis: "top"},
      y: {domain: genes, label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-lim, lim], reverse: true,
              legend: true, label: "log2 fold change"},
      marks: [
        Plot.cell(shown, {x: "name", y: "gene", fill: "lfc", inset: 0.5}),
        pointerTip(shown, {x: "name", y: "gene", fields: {
          "": (c) => c.gene, [byDrug ? "Drug" : "Cell line"]: (c) => c.name,
          "Direction": (c) => c.lfc > 0 ? "\u2191 up" : "\u2193 down",
          "Fold change": (c) => `${(2 ** Math.abs(c.lfc)).toFixed(1)}\u00d7`,
          "log2 FC": (c) => c.lfc.toFixed(2)}})
      ]})}</div>`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Differential expression in a single condition</div>

```js
const geneLineChoices = (() => {
  if (!geneRows) return [];
  const g = geneRows.filter((r) => doseSet.has(doseKey(r.dose)) && lineSet.has(r.cell_line));
  return d3.rollups(g, (v) => v.length, (d) => `${d.drug}|${d.cell_line}`)
    .map(([k, n]) => {
      const [drug, cell_line] = k.split("|");
      return {drug, cell_line, n,
              label: (selDrugs.length > 1 ? `${drug} · ` : "") + nameOf(cell_line)};
    })
    .sort((a, b) => b.n - a.n);
})();
```

```js
// The searchable combobox, not a native select: 48 cell lines in an OS dropdown
// is unscannable, and the organ glyph and tissue belong beside the name as they
// do on the query form.
const geneLineBox = geneLineChoices.length
  ? comboBox([[selDrugs.length > 1 ? "Drug and cell line" : "Cell line",
      geneLineChoices.map((c) => [c.label,
        htl.html`<span class="organ">${organIcon(organOf(c.cell_line))}${c.label}</span>`,
        `${organOf(c.cell_line)} · ${c.n} genes`])]],
      {value: geneLineChoices[0].label, placeholder: "Search cell lines or tissues…",
       ariaLabel: "Condition"})
  : null;
const geneLine = geneLineBox ? view(geneLineBox) : display(nothing());
```

```js
display((() => {
  if (tooManyForDetail) return htl.html`<div class="empty">Capped at ${MAX_DETAIL} drugs;
    ${selDrugs.length} are selected.</div>`;
  if (!geneLineChoices.length) return htl.html`<div class="empty">No gene changed here.</div>`;
  const chosen = geneLineChoices.find((c) => c.label === geneLine) ?? geneLineChoices[0];
  const g = geneRows.filter((r) => doseSet.has(doseKey(r.dose))
    && r.cell_line === chosen.cell_line && r.drug === chosen.drug);
  const agg = d3.rollups(g, (v) => d3.median(v, (d) => d.log2fc), (d) => d.gene)
    .map(([gene, lfc]) => ({gene, lfc}));
  const N = 15;
  const up = agg.filter((d) => d.lfc > 0).sort((a, b) => b.lfc - a.lfc).slice(0, N);
  const dn = agg.filter((d) => d.lfc < 0).sort((a, b) => a.lfc - b.lfc).slice(0, N);
  const top = [...dn, ...up].sort((a, b) => a.lfc - b.lfc);
  const lim = d3.max(agg, (d) => Math.abs(d.lfc)) * 1.04;
  const total = sel.find((c) => c.cell_line === chosen.cell_line
                             && c.drug === chosen.drug)?.n_deg ?? 0;
  return htl.html`<p class="caption">Most strongly induced and repressed transcripts
      for <b>${chosen.drug}</b> in <b>${nameOf(chosen.cell_line)}</b>, against
      untreated DMSO control wells of the same line. ${total.toLocaleString()}
      gene${total === 1 ? " is" : "s are"} differentially
      expressed${agg.length < total ? `; the ${agg.length} of largest magnitude are retained`
      : ""}.</p>
    ${method(htl.html`Median unshrunk log2 fold change against every DMSO well of the
      same cell line, for genes clearing a 5% false discovery rate. One unit is a
      doubling. The 30 strongest per direction per condition are stored upstream, which
      is why a condition with thousands of changed genes shows only its strongest.`)}
    ${Plot.plot({
      height: Math.max(260, top.length * 17 + 56), marginLeft: 124, marginRight: 24,
      style: {fontSize: "11px"},
      x: {domain: [-lim, lim], labelAnchor: "center", grid: true,
          label: "log2 fold change, down ← | → up"},
      y: {domain: top.map((d) => d.gene), label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-lim, lim], reverse: true},
      marks: [
        Plot.barX(top, {y: "gene", x: "lfc", fill: "lfc", rx: 3,
                        insetTop: 1.5, insetBottom: 1.5}),
        pointerTip(top, {mode: "y", x: "lfc", y: "gene", fields: {
          "": (d) => d.gene,
          "Direction": (d) => d.lfc > 0 ? "\u2191 up" : "\u2193 down",
          "Fold change": (d) => `${(2 ** Math.abs(d.lfc)).toFixed(1)}\u00d7`,
          "log2 FC": (d) => d.lfc.toFixed(2)}}),
        Plot.ruleX([0])
      ]})}`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Recurrently differentially expressed genes</div>

```js
// Fetched per drug, not bundled: src/detail holds 379 files and a query touches
// a handful. The slug mirrors build_detail.py, where Python's str.isalnum() is
// Unicode-aware, so \p{L}\p{N} and not A-Za-z0-9.
//
// `observable preview` serves everything in the source root under /_file/, and
// build.sh copies the same tree to dist/_file/detail, so this one relative URL
// works in preview and in the build. A plain string, not import.meta.resolve:
// Framework statically analyses that call and rejects a directory.
const DETAIL = "./_file/detail";
const slug = (s) => Array.from(s).map((ch) => /[\p{L}\p{N}\-_]/u.test(ch) ? ch : "_").join("");
async function fetchArrow(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return tableFromIPC(await r.arrayBuffer());
}
// Gene-level detail is one file per drug, so it is capped. Everything else on
// this page comes from tables that already cover all 379 drugs, which is why
// Transcription Factor Activity and Genotype Specificity keep working at any size.
const MAX_DETAIL = 8;
const tooManyForDetail = selDrugs.length > MAX_DETAIL;
const geneRows = tooManyForDetail ? null : (await Promise.all(
  selDrugs.map(async (d) =>
    rows(await fetchArrow(`${DETAIL}/genes/${slug(d)}.arrow`)).map((r) => ({...r, drug: d})))
)).flat();
```

```js
display((() => {
  if (tooManyForDetail) return htl.html`<div class="empty">Capped at ${MAX_DETAIL} drugs;
    ${selDrugs.length} are selected.</div>`;
  const g = geneRows.filter((r) => doseSet.has(doseKey(r.dose)) && lineSet.has(r.cell_line));
  if (!g.length) return htl.html`<div class="empty">No gene passes here.</div>`;
  const nl = new Set(g.map((x) => x.cell_line)).size;
  const agg = d3.rollups(g, (v) => ({
      lines: new Set(v.map((d) => d.cell_line)).size, lfc: d3.median(v, (d) => d.log2fc)}),
    (d) => d.gene, (d) => d.direction)
    .flatMap(([gene, v]) => v.map(([direction, s]) => ({gene, direction, ...s})))
    .filter((d) => d.lines >= Math.min(2, nl));
  // Recurrence first, size second: ranking on fold change alone puts a
  // pseudogene that moved once above DUSP6 moving in twenty lines.
  const pick = (dir, n) => agg.filter((d) => d.direction === dir)
    .sort((a, b) => b.lines - a.lines || Math.abs(b.lfc) - Math.abs(a.lfc)).slice(0, n);
  const top = [...pick("down", 13), ...pick("up", 13)];
  if (!top.length) return htl.html`<div class="empty">No gene changed in more than one line here.</div>`;
  return htl.html`<p class="caption">Genes differentially expressed in the greatest
      number of cell lines, ranked by recurrence. Bar length is the median log2 fold
      change, so one unit is a two-fold induction or repression. Restricted to genes
      differentially expressed in at least ${Math.min(2, nl)} of the ${nl} cell
      line${nl === 1 ? "" : "s"} assayed${selDrugs.length > 1
      ? `, pooled over the ${selDrugs.length} selected drugs` : ""}.</p>
    ${method(htl.html`A gene counts as changed at a 5% false discovery rate. Within a
      condition the residual degrees of freedom are constant, so the BH-adjusted
      <i>p</i> is a monotone function of |Wald|; genes are ranked by |Wald| and the
      first <code>n_padj &lt; 0.05</code> taken, which recovers the FDR-significant set
      exactly without storing a per-gene <i>p</i> matrix. The 30 strongest per direction
      per condition are kept upstream. Here they are ranked by how many cell lines they
      recur in, then by |median log2 fold change|; ranking on fold change alone floats a
      pseudogene that moved once above a gene that moved in twenty lines. Bars are the
      median unshrunk log2 fold change over the cell lines where the gene was
      significant.`)}
    ${Plot.plot({
      height: Math.max(240, top.length * 16 + 54), marginLeft: 116, marginRight: 24,
      style: {fontSize: "11px"},
      x: {label: "median log2 fold change, down \u2190 | \u2192 up",
          labelAnchor: "center", grid: true},
      y: {domain: top.sort((a, b) => a.lfc - b.lfc).map((d) => d.gene), label: null},
      color: {domain: ["down", "up"], range: [BLUE, ORANGE], legend: false},
      marks: [
        Plot.barX(top, {y: "gene", x: "lfc", fill: "direction", rx: 3,
                        insetTop: 1, insetBottom: 1}),
        pointerTip(top, {mode: "y", x: "lfc", y: "gene", fields: {
          "": (d) => d.gene,
          "Direction": (d) => d.lfc > 0 ? "\u2191 up" : "\u2193 down",
          "Fold change": (d) => `${(2 ** Math.abs(d.lfc)).toFixed(1)}\u00d7`,
          "Cell lines": (d) => `${d.lines} of ${nl}`}}),
        Plot.ruleX([0])
      ]})}`;
})())
```
</section>

</div>

<div class="dash tabpanel" data-tab="tf" hidden>

<section class="panel span2">
  <div class="panel-h">Transcription factor activity by pathway family</div>

```js
display((() => {
  const rs = regSummary.filter((r) => doseSet.has(doseKey(r.dose)) && drugSet.has(r.drug));
  if (!rs.length) return htl.html`<div class="empty">No regulator scores here.</div>`;
  const byFam = d3.rollups(rs, (v) => d3.median(v, (d) => d.z), (d) => d.family, (d) => d.regulator)
    .flatMap(([family, v]) => v.map(([regulator, z]) => ({family, regulator, z})));
  const famOrder = families.map((f) => f.name).filter((n) => byFam.some((d) => d.family === n));
  const note = new Map(families.map((f) => [f.name, f.note]));
  const lim = d3.max(byFam, (d) => Math.abs(d.z)) ?? 2;
  const labelled = d3.rollups(byFam, (v) => [d3.least(v, (d) => d.z), d3.greatest(v, (d) => d.z)],
    (d) => d.family).flatMap(([, v]) => v).filter((d) => d && Math.abs(d.z) > 0.25);
  return htl.html`<p class="caption">Inferred activity of each transcription factor,
      from the coordinated movement of its annotated target genes. Negative values
      indicate the factor's regulon was repressed, positive that it was induced.
      Factors are grouped by the signalling pathway whose output they report.</p>
    ${method(htl.html`decoupleR univariate linear model (ULM) fitted to each condition's
      unfiltered Wald statistic vector. Network: CollecTRI for human, complexes
      retained, 1,185 factors over 42,990 edges; minimum regulon size
      <code>tmin = 15</code>, which leaves ${new Set(rs.map((d) => d.regulator)).size}
      scorable factors here. NaN statistics are set to zero before fitting. A score is
      the regression <i>t</i>-value. Each dot takes the median <i>across</i> the
      ${rs.length.toLocaleString()} selected drug-by-dose scores, each of which is
      itself a median across cell lines. Note the order: a median over conditions per
      factor, whereas the test under <b>Genotype Specificity</b> takes a median over a
      pathway's factors per condition. Grouped by the nine pathways pre-specified in
      <code>spec/regulator_families.yaml</code>; factors outside them are not shown.`)}
    ${Plot.plot({
      height: Math.max(240, famOrder.length * 40 + 58), marginLeft: 150, marginRight: 24,
      style: {fontSize: "11px"},
      x: {domain: [-lim, lim], label: "median ULM t, repressed \u2190 | \u2192 activated",
          labelAnchor: "center", grid: true},
      y: {domain: famOrder, label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-lim, lim], reverse: true, legend: false},
      marks: [
        Plot.ruleX([0], {stroke: "currentColor", strokeOpacity: 0.35}),
        Plot.dot(byFam, {x: "z", y: "family", fill: "z", r: 5,
                         stroke: "var(--surface)", strokeWidth: 1}),
        Plot.text(labelled, {x: "z", y: "family", text: "regulator", dy: -11,
                             fontSize: 10, fill: "var(--color-ink-900)"}),
        pointerTip(byFam, {x: "z", y: "family", fields: {
          "": (d) => d.regulator, "Pathway": (d) => d.family,
          "Reports on": (d) => note.get(d.family) ?? null,
          "Direction": (d) => d.z < 0 ? "\u2193 repressed" : "\u2191 activated",
          "Median ULM t": (d) => d.z.toFixed(2)}})
      ]})}`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Transcription factor activity by drug and pathway</div>

```js
display((() => {
  if (selDrugs.length < 2) return htl.html`<div class="empty">Comparative view. Select
    two or more drugs to contrast the pathways whose transcriptional output they
    perturb.</div>`;
  const rs = regSummary.filter((r) => doseSet.has(doseKey(r.dose)) && drugSet.has(r.drug));
  if (!rs.length) return htl.html`<div class="empty">No pathway scores here.</div>`;
  const cells = d3.rollups(rs, (v) => d3.median(v, (d) => d.z), (d) => d.drug, (d) => d.family)
    .flatMap(([drug, v]) => v.map(([family, z]) => ({drug, family, z})));
  const famOrder = families.map((f) => f.name)
    .filter((n) => cells.some((c) => c.family === n));
  const drugOrder = d3.rollups(cells, (v) => d3.max(v, (c) => Math.abs(c.z)), (c) => c.drug)
    .sort((a, b) => b[1] - a[1]).map(([d]) => d);
  const lim = d3.max(cells, (c) => Math.abs(c.z));
  const moa = new Map(drugs.map((d) => [d.drug, d.moa]));
  const ml = 186, mr = 20;
  const cw = Math.max(4, Math.min(24, Math.floor((PANEL - ml - mr) / drugOrder.length)));
  return htl.html`<p class="caption">Inferred activity of each pathway's transcription
      factors, per drug. Red denotes induction of the pathway's transcriptional output,
      blue repression. Drugs with matching column profiles perturb the same programmes.
      Ordered by the magnitude of the largest effect, so the most transcriptionally
      active drugs appear first.</p>
    ${method(htl.html`Median ULM <i>t</i> across the pathway's transcription factors and
      across the selected cell lines and concentrations, per drug. This comes from the
      summary table, which covers all ${drugs.length} drugs, so this panel has no
      selection cap. Only the nine pre-specified pathways are shown; the
      ${regSummary.length.toLocaleString()}-row summary is itself a median across cell
      lines, so a drug that acts in only one or two lines is diluted here.`)}
    <div class="scrollx">${Plot.plot({
      width: Math.min(PANEL, drugOrder.length * cw + ml + mr),
      height: famOrder.length * 24 + 190,
      marginLeft: ml, marginTop: 170, marginBottom: 8, marginRight: mr,
      style: {fontSize: "10.5px"},
      x: {domain: drugOrder, tickRotate: -55, label: null, axis: "top"},
      y: {domain: famOrder, label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-lim, lim], reverse: true,
              legend: true, label: "median ULM t"},
      marks: [
        Plot.cell(cells, {x: "drug", y: "family", fill: "z", inset: 0.5}),
        pointerTip(cells, {x: "drug", y: "family", fields: {
          "": (c) => c.drug, "Mechanism": (c) => moa.get(c.drug) || null,
          "Pathway": (c) => c.family,
          "Direction": (c) => c.z > 0 ? "\u2191 activated" : "\u2193 repressed",
          "Median ULM t": (c) => c.z.toFixed(2)}})
      ]})}</div>`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Transcription factor activity in a single condition</div>

```js
// The ULM score is already a contrast: it is fitted to the treated-vs-DMSO Wald
// vector, so a positive score means that factor's targets rose relative to
// the DMSO controls. No second subtraction is needed or wanted.
const tfProfiles = tooManyForDetail ? null : Object.fromEntries(await Promise.all(
  selDrugs.map(async (d) => [d, await fetchArrow(`${DETAIL}/profiles/tf/${slug(d)}.arrow`)])));
```

```js
const condChoices = (() => {
  if (!tfProfiles) return [];
  const degOf = new Map(sel.map((c) => [`${c.drug}|${c.cell_line}|${doseKey(c.dose)}`, c.n_deg]));
  const out = [];
  for (const [drug, t] of Object.entries(tfProfiles)) {
    const cl = t.getChild("cell_line").toArray(), dz = t.getChild("dose").toArray();
    for (let i = 0; i < cl.length; i++) {
      const line = String(cl[i]), dose = Number(dz[i]);
      if (!lineSet.has(line) || !doseSet.has(doseKey(dose))) continue;
      out.push({drug, i, line, dose,
                n_deg: degOf.get(`${drug}|${line}|${doseKey(dose)}`) ?? 0,
                label: (selDrugs.length > 1 ? `${drug} · ` : "") + nameOf(line)
                       + (multiDose ? ` · ${+dose.toFixed(3)} µM` : "")});
    }
  }
  return out.sort((a, b) => b.n_deg - a.n_deg);
})();
```

```js
const pickBox = condChoices.length
  ? comboBox([[selDrugs.length > 1 ? "Drug and cell line" : "Cell line",
      condChoices.map((c) => [c.label,
        htl.html`<span class="organ">${organIcon(organOf(c.line))}${c.label}</span>`,
        `${organOf(c.line)} · ${c.n_deg.toLocaleString()} DE genes`])]],
      {value: condChoices[0].label, placeholder: "Search cell lines or tissues…",
       ariaLabel: "Condition"})
  : null;
const pick = pickBox ? view(pickBox) : display(nothing());
```

```js
display((() => {
  if (tooManyForDetail) return htl.html`<div class="empty">Factor-level profiles are
    fetched one file per drug, so this is capped at ${MAX_DETAIL};
    ${selDrugs.length} drugs are selected. The pathway views above cover every
    drug.</div>`;
  if (!condChoices.length) return htl.html`<div class="empty">No transcription factor
    profile for this selection.</div>`;
  const chosen = condChoices.find((c) => c.label === pick) ?? condChoices[0];
  const tfProfile = tfProfiles[chosen.drug];
  const names = tfProfile.schema.fields.map((f) => f.name)
    .filter((n) => n !== "cell_line" && n !== "dose");
  const famOf = new Map(families.flatMap((f) => f.members.map((m) => [m, f.name])));
  const vals = names.map((n) => ({
    regulator: n, family: famOf.get(n) ?? "other",
    t: Number(tfProfile.getChild(n).get(chosen.i))}))
    .filter((d) => Number.isFinite(d.t));
  const N = 14;
  const up = vals.slice().sort((a, b) => b.t - a.t).slice(0, N);
  const down = vals.slice().sort((a, b) => a.t - b.t).slice(0, N);
  const top = [...down, ...up].sort((a, b) => a.t - b.t);
  const lim = d3.max(vals, (d) => Math.abs(d.t)) * 1.04;
  const moved = vals.filter((d) => Math.abs(d.t) > 2);
  return htl.html`<p class="caption">Inferred transcription factor activity in
      <b>${chosen.label}</b>, relative to untreated DMSO control wells of the same line.
      Negative values indicate a repressed regulon, positive an induced one. The ${N}
      of largest magnitude in each direction, of ${vals.length} scored.
      ${moved.length} exceed the dashed threshold for a confidently altered regulon
      (${moved.filter((d) => d.t > 0).length} induced,
      ${moved.filter((d) => d.t < 0).length} repressed).</p>
    ${method(htl.html`The ULM <i>t</i>-value is fitted to this condition's
      treated-against-DMSO Wald vector, so it is already a contrast with the untreated
      controls and
      the sign is the direction against control; no second subtraction is applied or
      wanted. The dashed rules sit at |<i>t</i>| = 2. This cell line changed
      ${chosen.n_deg.toLocaleString()} genes at a 5% false discovery rate.`)}
    ${Plot.plot({
      height: Math.max(300, top.length * 17 + 60), marginLeft: 92, marginRight: 168,
      style: {fontSize: "11px"},
      x: {domain: [-lim, lim], labelAnchor: "center", grid: true,
          label: "ULM t vs DMSO control, repressed ← | → activated"},
      y: {domain: top.map((d) => d.regulator), label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-lim, lim], reverse: true},
      marks: [
        Plot.barX(top, {y: "regulator", x: "t", fill: "t", rx: 3,
                        insetTop: 1.5, insetBottom: 1.5}),
        Plot.text(top, {y: "regulator", x: () => lim, text: "family", fontSize: 10,
                        textAnchor: "start", dx: 8, fill: "var(--color-ink-900)"}),
        Plot.ruleX([-2, 2], {stroke: "currentColor", strokeOpacity: .25,
                             strokeDasharray: "2,2"}),
        pointerTip(top, {mode: "y", x: "t", y: "regulator", fields: {
          "": (d) => d.regulator, "Pathway": (d) => d.family,
          "Direction": (d) => d.t > 0 ? "\u2191 activated" : "\u2193 repressed",
          "ULM t vs DMSO": (d) => d.t.toFixed(2)}}),
        Plot.ruleX([0])
      ]})}`;
})())
```
</section>

</div>

<div class="dash tabpanel" data-tab="similarity" hidden>

<section class="panel span2">
  <div class="panel-h">Profile correlation in expression and regulon space</div>

```js
// Both spaces at once: the question is how gene-level and regulon-level
// similarity compare, and a radio made that a before-and-after memory test.
const centred = view(Inputs.toggle({
  label: "Remove the per-feature mean across the conditions shown",
  value: false}));
```

```js
const MAX_DRUGS = 6, MAX_COND = 60;
const tooMany = selDrugs.length > MAX_DRUGS;
// One row per condition while that fits; otherwise one row per drug.
const nCondSel = sel.length;
const byDrugLevel = selDrugs.length > 1 && nCondSel > MAX_COND;
const profiles = tooMany ? null : Object.fromEntries(await Promise.all(
  ["gene", "tf"].map(async (sp) => [sp, await Promise.all(selDrugs.map(async (d) =>
    [d, await fetchArrow(`${DETAIL}/profiles/${sp}/${slug(d)}.arrow`)]))])));
```

```js
// Each row of a profile file is one condition; the columns after cell_line and
// dose are the shared coordinates, identical across every drug, which is what
// makes two profiles comparable at all.
function conditionsIn(space) {
  const items = [];
  for (const [drug, t] of profiles[space]) {
    const cols = t.schema.fields.map((f) => f.name)
      .filter((n) => n !== "cell_line" && n !== "dose");
    const cl = t.getChild("cell_line").toArray(), dz = t.getChild("dose").toArray();
    const mats = cols.map((c) => t.getChild(c).toArray());
    for (let i = 0; i < cl.length; i++) {
      const line = String(cl[i]), dose = Number(dz[i]);
      if (!lineSet.has(line) || !doseSet.has(doseKey(dose))) continue;
      items.push({drug, line, dose,
        label: (selDrugs.length > 1 ? `${drug} · ` : "") + nameOf(line)
               + (multiDose ? ` ${dose}µM` : ""),
        v: Float64Array.from(mats, (m) => m[i])});
    }
  }
  return items;
}

// With several drugs selected there are more conditions than a matrix can show,
// and the question has changed anyway: not "which cell lines behave alike" but
// "do these drugs behave alike". Collapse each drug to its mean profile over
// the selected cell lines.
function drugsIn(space) {
  const by = d3.group(conditionsIn(space), (d) => d.drug);
  return Array.from(by, ([drug, v]) => {
    const k = v[0].v.length, w = new Float64Array(k);
    for (const it of v) for (let j = 0; j < k; j++) w[j] += it.v[j] / v.length;
    return {drug, line: null, label: `${drug}  (${v.length} line${v.length === 1 ? "" : "s"})`,
            v: w};
  });
}

function matrix(space, order) {
  const items = byDrugLevel ? drugsIn(space) : conditionsIn(space);
  if (items.length < 2) return null;
  if (centred) {
    // Subtract each feature's mean over the conditions in view. Every condition
    // of a drug carries a shared additive per-feature component, so raw
    // correlations sit between 0 and 1 and the sign carries no information:
    // adagrasib's 41 NON-responding lines still correlate at r = 0.64.
    const n = items.length, k = items[0].v.length;
    const mean = new Float64Array(k);
    for (const it of items) for (let j = 0; j < k; j++) mean[j] += it.v[j] / n;
    for (const it of items) {
      const w = new Float64Array(k);
      for (let j = 0; j < k; j++) w[j] = it.v[j] - mean[j];
      it.v = w;
    }
  }
  const pairs = [];
  for (let i = 0; i < items.length; i++)
    for (let j = 0; j < items.length; j++)
      pairs.push({a: items[i].label, b: items[j].label,
                  r: i === j ? 1 : pearson(items[i].v, items[j].v)});
  return {items, pairs};
}

// One ordering, taken from gene space, so the two matrices are comparable
// cell by cell. Ordering each independently would make them look different
// when only the row order differed.
function orderOf(m) {
  const {items, pairs} = m, n = items.length;
  const idx = new Map(items.map((it, i) => [it.label, i]));
  const at = (p, q) => pairs[idx.get(p) * n + idx.get(q)].r ?? 0;
  const order = [items[0].label];
  const left = new Set(items.slice(1).map((it) => it.label));
  while (left.size) {
    const last = order[order.length - 1];
    order.push(Array.from(left).sort((p, q) => at(last, q) - at(last, p))[0]);
    left.delete(order[order.length - 1]);
  }
  return order;
}
```

```js
display((() => {
  if (tooMany) return htl.html`<div class="empty">Profile similarity is computed in the
    browser from one file per drug, so it is capped at ${MAX_DRUGS} drugs.
    ${selDrugs.length} are selected.</div>`;
  const gm = matrix("gene");
  if (!gm) return htl.html`<div class="empty">At least two profiles are needed to
    compare.</div>`;
  if (gm.items.length > MAX_COND) return htl.html`<div class="empty">${gm.items.length}
    ${byDrugLevel ? "drugs" : "conditions"} selected; the matrix is capped at
    ${MAX_COND}. Narrow the query.</div>`;
  const tm = matrix("tf");
  const order = orderOf(gm);
  const n = order.length;
  // Two matrices side by side, so each has half the panel. Fit the cells to it.
  // .two-up.even splits the panel in half, less the grid gap and a little
  // slack for the colour legend, which Plot lays out above the frame.
  const half = Math.max(280, HALF);
  const pad = Math.round(Math.min(200, 7 + 6.1 * d3.max(order, (o) => o.length)));
  const cell = Math.max(6, Math.min(18, Math.floor((half - pad - 24) / n)));
  const marker = new Map(gm.items.map((it) => [it.label, marked.has(it.line)]));
  const draw = (m, title, note) => htl.html`<div>
    <div class="sub-h">${title}</div>
    <p class="legend-line">${note}</p>
    <div class="scrollx">${Plot.plot({
      width: Math.min(half, n * cell + pad + 16), height: n * cell + pad + 10,
      marginLeft: pad, marginTop: pad, marginBottom: 6, marginRight: 10,
      style: {fontSize: n > 28 ? "9px" : "10px"},
      x: {domain: order, tickRotate: -55, label: null, axis: "top"},
      y: {domain: order, label: null},
      color: {type: "diverging", scheme: "RdBu", domain: [-1, 1], reverse: true,
              legend: true, label: "Pearson r"},
      marks: [
        Plot.cell(m.pairs, {x: "a", y: "b", fill: "r", inset: 0.5}),
        Plot.dot(order.filter((o) => marker.get(o)).map((o) => ({o})),
                 {x: "o", y: "o", r: 2, fill: "black", stroke: "white", strokeWidth: .7}),
        pointerTip(m.pairs, {x: "a", y: "b", fields: {
          "": (q) => q.a, "against": (q) => q.b,
          "Relationship": (q) => q.r == null ? "not comparable"
            : q.r > 0.5 ? "alike" : q.r < -0.2 ? "opposite" : "weakly related",
          "Pearson r": (q) => q.r == null ? "n/a" : q.r.toFixed(2)}})
      ]})}</div></div>`;
  const span = (m) => {
    const off = m.pairs.filter((q) => q.a !== q.b && q.r != null).map((q) => q.r);
    return `median r ${d3.median(off).toFixed(2)}, ${d3.format(".0%")(
      off.filter((x) => x < 0).length / off.length)} negative`;
  };
  return htl.html`<p class="caption">${byDrugLevel
    ? htl.html`Pairwise concordance between <b>drugs</b>, each summarised over the
      ${nLinesWithData} selected cell lines, since ${nCondSel} individual conditions
      exceeds what one matrix can resolve. Red denotes concordant responses, blue
      discordant ones. A contiguous red block identifies drugs producing
      equivalent transcriptional responses.`
    : htl.html`Pairwise concordance between cell lines. Red denotes concordant
      responses, blue discordant, pale unrelated. Lines are ordered so that concordant
      ones adjoin, making a contiguous red block a set responding as a
      group${markLabel ? `. A marker on the diagonal denotes ${markLabel}` : ""}.`}
    Both panels share the same axis ordering, so corresponding cells may be compared directly.</p>
    ${method(htl.html`Pearson correlation between
    ${byDrugLevel ? "per-drug mean profiles, averaged over the selected cell lines"
                  : "condition profiles"}. Gene space is the
    DESeq2 Wald statistic over a fixed 1,000-gene panel, chosen as the genes most often
    FDR-significant across the atlas; pathway space is all 469 CollecTRI ULM scores.
    Both coordinate systems are identical across drugs, which is what makes two
    profiles comparable. One ordering, taken from gene space by nearest-neighbour
    chaining on 1 &minus; r, is applied to both matrices. Uncentred correlations sit
    almost entirely between 0 and 1 because every condition of a drug carries a shared
    additive per-feature component; the toggle above subtracts each feature's mean over
    the conditions shown, which removes it. The tests under <b>Genotype Specificity</b> are
    unaffected either way, because they use a within-group minus between-group
    difference in which that component cancels.`)}
    <div class="two-up even">
      ${draw(gm, "Expression Space", `1,000 genes · ${span(gm)}`)}
      ${draw(tm, "TF Activity Space", `469 transcription factors · ${span(tm)}`)}
    </div>`;
})())
```

</section>

</div>

<div class="dash tabpanel" data-tab="association" hidden>

<section class="panel span2">
  <div class="panel-h">Genotype specificity summary</div>

```js
display((() => {
  if (selDrugs.length < 2) return htl.html`<div class="empty">Comparative view. Select
    two or more drugs to contrast their genotype dependence across the panel.</div>`;
  const ORDER = ["specific_genotype", "specific_genotype_vs_wild_type", "gene_level",
                 "pathway_level", "no_genotype_dependence", "underpowered",
                 "untestable_in_panel", "not_genotype_targeted"];
  const counts = d3.rollup(selVerdicts, (v) => v.length, (v) => v.verdict);
  const bars = ORDER.filter((k) => counts.has(k))
    .map((k) => ({verdict: k, label: (VERDICT[k] ?? [k])[0], n: counts.get(k)}));
  const tested = selVerdicts.filter((v) => ORDER.indexOf(v.verdict) <= 3);
  return htl.html`<p class="caption">What the genotype test concluded for each of the
      ${selDrugs.length} selected drugs. ${tested.length} yielded a testable result;
      the remainder either have no annotated target, or a target carried by too few
      lines in this panel to stratify on.</p>
    ${method(htl.html`One verdict per drug from a closed vocabulary, assigned by rules
      fixed in advance and ranked strictly by rung, in
      <code>src/analysis/verdicts.py</code>. Nothing here picks the best-looking number.
      This table covers all ${drugs.length} drugs, so there is no selection cap.`)}
    ${Plot.plot({
      height: bars.length * 26 + 46, marginLeft: 232, marginRight: 24,
      style: {fontSize: "11.5px"},
      x: {label: "drugs", labelAnchor: "center", grid: true},
      y: {domain: bars.map((b) => b.label), label: null},
      color: {domain: ORDER.slice(0, 3), range: [ORANGE, ORANGE, BLUE], legend: false},
      marks: [
        Plot.barX(bars, {y: "label", x: "n", rx: 3, insetTop: 2, insetBottom: 2,
          fill: (b) => ORDER.indexOf(b.verdict) <= 1 ? ORANGE
                     : ORDER.indexOf(b.verdict) <= 3 ? BLUE : GREY}),
        Plot.text(bars, {y: "label", x: "n", text: (b) => b.n, dx: 9,
                         textAnchor: "start", fontSize: 11}),
        Plot.ruleX([0])
      ]})}
    ${tested.length ? htl.html`<div class="scrollx"><table class="ladder"><thead><tr>
      <th>drug</th><th>verdict</th><th>genotype</th><th>shown by</th><th>targets</th>
      </tr></thead><tbody>${tested
        .sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict)
                     || d3.ascending(a.drug, b.drug))
        .map((v) => htl.html`<tr>
          <td><a class="xref" href=${"./results?" + new URLSearchParams(
            {dose: Q.doses.join(","), d: v.drug}).toString()}>${v.drug}</a></td>
          <td>${(VERDICT[v.verdict] ?? [v.verdict])[0]}</td>
          <td>${v.genotype ? v.genotype.replace(":", " ") : ""}</td>
          <td class="dim">${v.axes || ""}</td>
          <td class="dim">${v.targets || ""}</td></tr>`)}</tbody></table></div>` : ""}`;
})())
```
</section>

<section class="panel span2">
  <div class="panel-h">Genotype stratification tests</div>

```js
display((() => {
  if (!ladderSel.length) return htl.html`<div class="empty">${verdict?.reason
    ? verdict.reason[0].toUpperCase() + verdict.reason.slice(1) + "."
    : "No genotype test applies to this drug."}</div>`;
  const RUNG = {gene: "any mutation in the gene vs wild type",
                vs_wild_type: "this genotype vs wild type",
                conditional: "this genotype vs other mutations in the same gene"};
  const fmtq = (q) => q == null || !isFinite(q) ? "" : q < 0.001 ? q.toExponential(0) : q.toFixed(3);
  const t = ladderSel.slice().sort((a, b) =>
    d3.ascending(a.drug, b.drug) ||
    d3.ascending(a.gene, b.gene) || d3.ascending(a.alteration, b.alteration) ||
    d3.ascending(a.dose, b.dose) ||
    d3.ascending(["gene", "vs_wild_type", "conditional"].indexOf(a.contrast),
                 ["gene", "vs_wild_type", "conditional"].indexOf(b.contrast)));
  const cell = (hit, v, q, dp = 2) => !isFinite(v) ? htl.html`<td class="num dim">not tested</td>`
    : htl.html`<td class="num ${hit ? "is-hit" : ""}">${v.toFixed(dp)}
        <span class="q">q ${fmtq(q)}</span></td>`;
  return htl.html`<p class="caption">Each row contrasts cell lines carrying a given
      oncogenic genotype against those that do not. Three independent response measures
      are reported side by side because they dissociate: a drug may perturb a
      transcription factor programme without appreciably altering transcript counts.
      Highlighted values are unlikely under the null. All three concentrations are
      listed; the selected one is marked.</p>
    <div class="scrollx"><table class="ladder">
      <thead><tr>${selDrugs.length > 1 ? htl.html`<th>drug</th>` : ""}
        <th>genotype</th><th>contrast</th><th>µM</th><th>lines</th>
        <th>differential expression</th><th>transcription factor activity</th>
        <th>profile concordance</th></tr></thead>
      <tbody>${t.map((r) => htl.html`<tr class=${[r.contrast === "conditional" ? "rung4" : "",
                                                   doseSet.has(doseKey(r.dose)) ? "is-dose" : ""]
                                                   .filter(Boolean).join(" ")}>
        ${selDrugs.length > 1 ? htl.html`<td>${r.drug}</td>` : ""}
        <td>${r.alteration === "any mutation" ? `${r.gene}, any mutation` : r.genotype.replace(":", " ")}</td>
        <td class="dim">${RUNG[r.contrast]}</td>
        <td class="num">${+Number(r.dose).toFixed(3)}${doseSet.has(doseKey(r.dose)) ? htl.html`<span class="dot"></span>` : ""}</td>
        <td class="num dim">${r.n_pos} v ${r.n_neg}</td>
        ${cell(r.deg_hit, r.deg_auroc, r.deg_q)}
        ${cell(r.path_hit, r.path_auroc, r.path_q)}
        ${cell(r.block_hit, r.block_sep, r.block_q, 3)}
      </tr>`)}</tbody>
    </table></div>
    <p class="caption"><b>Differential expression</b> and <b>transcription factor
      activity</b> range from 0.5, the two genotype groups being indistinguishable, to
      1.0, every line carrying the genotype responding more strongly than every line
      without it. <b>Profile concordance</b> is 0 when the carrier lines resemble each
      other no more than they resemble the rest, and rises as they respond as a
      coherent group.</p>
    ${method(htl.html`Genotypes are fixed in advance in
      <code>spec/oncogenic_genotypes.yaml</code> (DepMap
      <code>Driver_GeneType_DM = Oncogene</code>, at least two carriers among the 48
      assayed cell lines) and tested only against drugs annotating that gene as a
      target, so no maximum is taken over genotypes or flags.
      <b>Genes changed</b> is the AUROC on the BH-significant gene count.
      <b>Pathway score</b> is the AUROC on the median ULM <i>t</i> of the single
      pathway <code>spec/target_pathways.yaml</code> assigns to this drug's target,
      signed so larger always means more inhibition. <b>Response similarity</b> is the
      mean within-group profile correlation minus the mean group-to-comparator
      correlation, with an exact permutation null enumerated over all C(n, m)
      assignments where that is at most 200,000, otherwise 50,000 samples. All
      <i>p</i>-values are one-sided exact Mann-Whitney; the asymptotic approximation is
      wrong by orders of magnitude at these group sizes. Benjamini-Hochberg is applied
      across every test this drug makes, which is why all three concentrations are
      listed rather than filtered. Highlighted cells clear <i>q</i> &lt; 0.05.`)}`;
})())
```

```js
display((() => {
  if (!one || !bestRow) return nothing();
  const f = factors.filter((x) => x.drug === one && x.genotype === bestRow.genotype
    && x.dose === bestRow.dose && x.contrast === bestRow.contrast);
  if (!f.length) return nothing();
  const d = f.slice().sort((a, b) => a.delta_z - b.delta_z);
  const lim = d3.max(d, (x) => Math.abs(x.delta_z)) * 1.04;
  return htl.html`<div class="subpanel">
    <div class="panel-h">Transcription factors discriminating the genotype groups</div>
    <p class="caption">Transcription factors whose inferred activity differs most
      between the ${bestRow.n_pos} lines carrying this genotype and the
      ${bestRow.n_neg} that do not. Negative values indicate a regulon repressed
      specifically in the carrier lines, positive one induced in them.</p>
    ${method(htl.html`Difference in median ULM <i>t</i> between the two groups at
      ${+Number(bestRow.dose).toFixed(3)} µM. Ranked by effect size and not by
      <i>p</i>: the exact test floors at
      1/C(${bestRow.n_pos + bestRow.n_neg}, ${bestRow.n_pos}) here, so dozens of factors
      tie at that value and <i>p</i> cannot order them.`)}
    ${Plot.plot({
      height: Math.max(200, d.length * 20 + 56), marginLeft: 92, marginRight: 150,
      style: {fontSize: "11px"},
      x: {domain: [-lim, lim],
          label: "difference in median ULM t, lower in carriers \u2190 | \u2192 higher",
          labelAnchor: "center", grid: true},
      y: {domain: d.map((x) => x.regulator), label: null},
      color: {type: "diverging", scheme: "RdBu", reverse: true, legend: false},
      marks: [
        Plot.barX(d, {y: "regulator", x: "delta_z", fill: "delta_z", rx: 3,
                      insetTop: 2, insetBottom: 2}),
        // family names go in one fixed column on the right, never at the bar
        // end: a left-pointing bar wrote its label through the axis labels
        Plot.text(d, {y: "regulator", x: () => lim, text: "family", fontSize: 10,
                      textAnchor: "start", dx: 8, fill: "var(--color-ink-900)"}),
        pointerTip(d, {mode: "y", x: "delta_z", y: "regulator", fields: {
          "": (x) => x.regulator, "Pathway": (x) => x.family,
          "In mutant lines": (x) => x.z_pos.toFixed(2),
          "In the others": (x) => x.z_neg.toFixed(2),
          "Difference": (x) => x.delta_z.toFixed(2)}}),
        Plot.ruleX([0])
      ]})}</div>`;
})())
```
</section>

</div>

<div class="dash tabpanel" data-tab="similarity" hidden>

<section class="panel span2">
  <div class="panel-h">Nearest drugs by transcription factor signature</div>

```js
display((() => {
  const quiet = ["not_genotype_targeted", "untestable_in_panel",
                 "no_genotype_dependence", "underpowered"];
  if (selDrugs.length > 1) {
    // One row per selected drug. neighbourhood.arrow covers 375 drugs, so this
    // works however many are selected.
    const first = neighbours.filter((x) => drugSet.has(x.drug) && x.rank === 1)
      .sort((a, b) => b.r - a.r);
    if (!first.length) return htl.html`<div class="empty">No signatures here.</div>`;
    const rate = first[0].nn_recovery, chance = first[0].chance;
    return htl.html`<p class="caption">Nearest neighbour of each of the
      ${selDrugs.length} selected drugs, by whole-panel transcription factor signature.
      Identifies which members of a mechanistic class produce equivalent responses, and
      which diverges.</p>
      ${method(htl.html`A drug's signature is its mean ULM score vector across the panel
      at 0.5 µM; neighbours are ranked by Pearson correlation between signatures. The
      nearest neighbour shares the drug's annotated mechanism
      ${(100 * rate).toFixed(0)}% of the time against ${(100 * chance).toFixed(1)}%
      expected by chance, a ${(rate / chance).toFixed(1)}-fold enrichment, so this
      suggests a neighbourhood and does not assign a target.`)}
      <div class="scrollx"><table class="ladder"><thead><tr>
        <th>drug</th><th>nearest</th><th>its mechanism</th><th class="num">similarity</th>
      </tr></thead><tbody>${first.map((x) => htl.html`<tr>
        <td>${x.drug}</td>
        <td><a class="xref" href=${"./results?" + new URLSearchParams(
          {dose: Q.doses.join(","), d: x.neighbour}).toString()}>${x.neighbour}</a></td>
        <td class="dim">${x.neighbour_moa}</td>
        <td class="num">${x.r.toFixed(2)}</td></tr>`)}</tbody></table></div>`;
  }
  if (!one) return htl.html`<div class="empty">No drug selected.</div>`;
  // Only where the ladder has nothing to say. With a genotype verdict in hand
  // this table is weaker evidence sitting next to stronger evidence.
  if (verdict && !quiet.includes(verdict.verdict))
    return htl.html`<div class="empty">Signature similarity is a weak mechanistic
      indicator and is shown only for drugs with no testable annotated target. This
      drug has a pre-specified result under <b>Genotype Specificity</b>, which is the
      stronger evidence.</div>`;
  const n = neighbours.filter((x) => x.drug === one).sort((a, b) => a.rank - b.rank);
  if (!n.length) return htl.html`<div class="empty">No signature for this drug.</div>`;
  const rate = n[0].nn_recovery, chance = n[0].chance;
  return htl.html`<p class="caption">Drugs whose whole-panel transcription factor
    signature most resembles this one. The nearest neighbour shares the annotated
    mechanism <b>${(100 * rate).toFixed(0)}%</b> of the time against
    <b>${(100 * chance).toFixed(1)}%</b> expected by chance, a
    ${(rate / chance).toFixed(1)}-fold enrichment: sufficient to nominate a mechanistic
    neighbourhood, insufficient to assign a target. No target is inferred here.</p>
    <div class="scrollx"><table class="ladder"><thead><tr>
      <th>drug</th><th>mechanism</th><th>targets</th><th class="num">similarity</th>
    </tr></thead><tbody>${n.map((x) => htl.html`<tr>
      <td><a class="xref" href=${"./results?" + new URLSearchParams(
        {dose: Q.doses.join(","), d: x.neighbour}).toString()}>${x.neighbour}</a></td>
      <td class="dim">${x.neighbour_moa}</td>
      <td class="dim">${x.neighbour_targets || "none annotated"}</td>
      <td class="num">${x.r.toFixed(2)}</td></tr>`)}</tbody></table></div>`;
})())
```
</section>

</div>

```js
display(htl.html`<div class="provenance">
  Differential expression: DESeq2, each well against every untreated DMSO well of the same
  cell line, plate controlled. Genes counted at FDR 5%.
  Pathway activity: CollecTRI regulons over the same contrasts.
  Genotype: DepMap driver annotation shipped with Tahoe-100M.
  Genotype: fixed in advance in spec/oncogenic_genotypes.yaml and only
  tested against drugs that annotate the gene as a target. Three axes, BH-corrected
  across every test a drug makes. Response similarity uses an exact permutation null
  where the number of assignments allows it.
  Built ${manifest.built_at.slice(0, 10)} · <code>${manifest.git_sha_short ?? "?"}</code>
</div>`)
```

</div>
