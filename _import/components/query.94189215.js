// The query lives in the URL, so a result page is shareable and the landing page
// stays a form. One encoder, one decoder, one set of controls.
//
// A query is three lists: drugs, cell lines, doses. Empty means "everything",
// which keeps the common case out of the URL. Lists are comma-joined rather
// than repeated keys so a link stays readable.
import * as Plot from "../../_npm/@observablehq/plot@0.6.17/93ce672e.js";

export const ALL = "all";
export const DOSES = [0.05, 0.5, 5];

/**
 * Canonical key for a dose.
 *
 * Doses are compared for equality across five different files. 0.05 has no
 * float32 representation, and one table storing it narrowly was enough to make
 * every 0.05 uM query return an empty page with no error. The loaders now keep
 * dose in float64; this is the belt as well as the braces.
 */
export const doseKey = (d) => Number(d).toFixed(3);
export const doseSetOf = (xs) => new Set(xs.map(doseKey));

const join = (xs) => xs.join(",");
const split = (s) => (s ? s.split(",").filter(Boolean) : []);

export function encode({drugs = [], lines = [], doses = []}) {
  const p = new URLSearchParams();
  if (drugs.length) p.set("d", join(drugs));
  if (lines.length) p.set("l", join(lines));
  if (doses.length) p.set("dose", join(doses.map(String)));
  return p.toString();
}

/**
 * Resolve the URL into concrete drug, cell line and dose lists.
 *
 * `drugMeta` rows carry `drug`; `lineMeta` rows carry `cell_line` (the id) and
 * `name`. An empty selection means every one of them, which is why the caller
 * never has to special-case "all" downstream.
 */
export function decode(search, {drugMeta, lineMeta}) {
  const p = new URLSearchParams(search);
  const dKeys = split(p.get("d")), lKeys = split(p.get("l"));
  const doses = split(p.get("dose")).map(Number).filter((x) => DOSES.includes(x));

  const byDrug = new Set(dKeys);
  const drugs = dKeys.length ? drugMeta.filter((x) => byDrug.has(x.drug)) : drugMeta;

  const byLine = new Set(lKeys);
  const lines = lKeys.length ? lineMeta.filter((x) => byLine.has(x.cell_line)) : lineMeta;

  const label = (xs, all, n, one) =>
    !xs.length ? all : xs.length === 1 ? one(xs[0]) : `${xs.length} ${n}`;

  return {
    doses: doses.length ? doses.sort((a, b) => a - b) : DOSES,
    allDoses: !doses.length,
    drugs, lines,
    drugKeys: dKeys, lineKeys: lKeys,
    labelDrug: label(dKeys, "All drugs", "drugs", (k) => k),
    labelLine: label(lKeys, "all cell lines", "cell lines",
                     (k) => lineMeta.find((x) => x.cell_line === k)?.name ?? k),
    labelDose: doses.length === 1 ? `${doses[0]} \u00b5M`
      : doses.length ? doses.map((d) => `${d}`).join(", ") + " \u00b5M"
      : "all three concentrations"
  };
}

/** Pearson correlation of two equal-length vectors, ignoring non-finite pairs. */
export function pearson(a, b) {
  let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    n++; sa += x; sb += y; saa += x * x; sbb += y * y; sab += x * y;
  }
  if (n < 3) return null;
  const cov = sab / n - (sa / n) * (sb / n);
  const va = saa / n - (sa / n) ** 2, vb = sbb / n - (sb / n) ** 2;
  if (!(va > 0) || !(vb > 0)) return null;
  return cov / Math.sqrt(va * vb);
}

/**
 * A tooltip that actually fires on a cell chart, with a readable hierarchy.
 *
 * `tip: {format: …}` on the mark renders an empty tip here: the pointer
 * transform never resolves a row. An explicit Plot.tip with Plot.pointer is
 * the reliable form.
 *
 * Two shapes are supported. `title` gives one free-text block, every line in
 * the same weight and colour, which reads as a wall. `fields` gives labelled
 * channels instead, which Plot renders as label/value pairs and dims the
 * label, so the thing being named stands out from the things describing it.
 * Prefer `fields`; the lead entry is keyed with a blank label so the entity
 * name sits on its own line above the rest.
 */
export function pointerTip(data, {x, y, title, fields, mode = "xy"}) {
  // On a horizontal bar chart the value is x and only the row identifies the
  // datum, so a two-dimensional pointer finds nothing and the tip renders
  // empty. Use pointerY there, pointerX for vertical bars, 2-D for cells.
  const pointer = mode === "y" ? Plot.pointerY : mode === "x" ? Plot.pointerX : Plot.pointer;
  const common = {
    x, y, fontSize: 12, lineHeight: 1.4,
    fill: "var(--surface)", stroke: "var(--line)"
  };
  if (fields) {
    const channels = {};
    for (const [k, v] of Object.entries(fields)) if (v != null) channels[k] = v;
    return Plot.tip(data, pointer({...common, channels, format: {x: false, y: false}}));
  }
  return Plot.tip(data, pointer({...common, title}));
}
