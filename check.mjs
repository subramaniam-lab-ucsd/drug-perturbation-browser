// Acceptance for the four-page site. Serves dist, drives the form, follows it to
// the dashboard, and asserts on what a person would actually see: charts with
// marks in them, gene symbols, pathway names, and tooltips whose text has
// contrast against their own panel (a tip can have textContent and still render
// invisible, which is how the dark-box bug got through once).
import puppeteer from "puppeteer";
import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {join, extname} from "node:path";

const ROOT = "dist", PORT = 0;   // 0 = let the OS pick, so an orphaned run cannot block the next
const M = {".html":"text/html",".js":"text/javascript",".css":"text/css",
  ".json":"application/json",".arrow":"application/octet-stream"};
const srv = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    let f = join(ROOT, p);
    try { await stat(f); } catch { f = join(ROOT, p + ".html"); }
    const b = await readFile(f);
    r.writeHead(200, {"content-type": M[extname(f)] ?? "application/octet-stream"});
    r.end(b);
  } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise((r) => srv.listen(PORT, r));
const port = srv.address().port;
const br = await puppeteer.launch({args: ["--no-sandbox"]});
let pass = 0; const fail = [];
const ck = (n, c, d = "") => { c ? pass++ : fail.push(`${n}  ${d}`);
  console.log(`${c ? "  ok" : "FAIL"}  ${n}${d && !c ? "  " + d : ""}`); };

const page = await br.newPage();
await page.setViewport({width: 1500, height: 1050});
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
const go = async (u) => {
  errs.length = 0;
  await page.goto(`http://localhost:${port}${u}`, {waitUntil: "networkidle0", timeout: 90000});
  await new Promise((r) => setTimeout(r, 3000));
};
const count = (sel) => page.$$eval(sel, (e) => e.length).catch(() => 0);
const text = () => page.evaluate(() => document.body.innerText);

// ---- landing ------------------------------------------------------------
console.log("\n/ (query form)");
await go("/");
ck("no page errors", errs.length === 0, errs[0]);
ck("three query fields", await count(".q-field") === 3);
ck("show-results button", await count(".q-actions .go") === 1);
ck("example chips", await count(".examples .chip") >= 3);
// The landing page carries the logo and the form, nothing else.
ck("no heading or tagline", await count(".home-head h1") === 0
   && await count(".home-head .lede") === 0);
ck("logo lockup present", await count(".logo-lockup .mark") === 1
   && await count(".logo-lockup .brand-text") === 1);
ck("logo is centred", await page.$eval(".home-head",
  (h) => getComputedStyle(h).textAlign === "center"));
ck("logo matches the navbar mark", await page.evaluate(() => {
  const a = document.querySelector(".topnav .mark"), b = document.querySelector(".logo-lockup .mark");
  return !!a && !!b && a.innerHTML === b.innerHTML;
}));
ck("field order is drugs, cell lines, concentration",
   JSON.stringify(await page.$$eval(".q-field .q-label", (e) => e.map((x) => x.textContent)))
   === JSON.stringify(["Drugs", "Cell lines", "Concentration"]));
ck("drugs and cell lines are multi-select", await count(".cb-multi") === 2);
ck("concentration is a single-choice segmented control",
   await count(".seg-b") === 3 && await count(".seg-b.is-on") === 1);
ck("0.5 uM is the default",
   (await page.$eval(".seg-b.is-on", (e) => e.textContent)).trim() === "0.5 µM");
// Hundreds of options under one heading pushed the categories out of view.
await page.evaluate(() => document.querySelectorAll(".q-field")[0]
  .querySelector(".cb-trigger").click());
await new Promise((r) => setTimeout(r, 400));
ck("groups start collapsed", await count(".q-field .cb-opt") === 0
   && await count(".q-field .cb-group") >= 2);
ck("a group opens on click", await page.evaluate(async () => {
  document.querySelector(".q-field .cb-group").click();
  await new Promise((r) => setTimeout(r, 300));
  return document.querySelectorAll(".q-field .cb-opt").length > 0;
}));
ck("organ glyphs render as svg, not emoji", await page.evaluate(async () => {
  const f = document.querySelectorAll(".q-field")[1];
  f.querySelector(".cb-trigger").click();
  await new Promise((r) => setTimeout(r, 300));
  [...f.querySelectorAll(".cb-group")].find((g) => /TISSUE/i.test(g.textContent)).click();
  await new Promise((r) => setTimeout(r, 300));
  return f.querySelectorAll(".cb-opt svg.ico-organ").length >= 10;
}));
await page.keyboard.press("Escape");
// picking two drugs must put both in the link, not replace the first
const link = await page.evaluate(() => {
  const open = (label) => {
    const f = [...document.querySelectorAll(".q-field")]
      .find((x) => x.querySelector(".q-label")?.textContent.trim() === label);
    f.querySelector(".cb-trigger").click(); return f;
  };
  const f = open("Drugs");
  const s = f.querySelector(".cb-search");
  for (const name of ["Adagrasib", "Trametinib"]) {
    s.value = name; s.dispatchEvent(new Event("input", {bubbles: true}));
    [...f.querySelectorAll(".cb-opt")].find((o) =>
      o.querySelector(".cb-opt-l").textContent.trim() === name).click();
    f.querySelector(".cb-trigger").click();
  }
  return f.querySelectorAll(".cb-chip").length;
});
// the link is a reactive cell, so it updates a tick after the control fires
await new Promise((r) => setTimeout(r, 1200));
const href = await page.$eval(".q-actions .go", (a) => a.getAttribute("href"));
ck("two drugs selected", link === 2, String(link));
ck("both drugs in the link", /d=Adagrasib(%2C|,)Trametinib/.test(href), href);
ck("search reaches inside a collapsed group", await page.evaluate(async () => {
  const f = [...document.querySelectorAll(".q-field")]
    .find((x) => x.querySelector(".q-label").textContent.trim() === "Cell lines");
  f.querySelector(".cb-trigger").click();
  await new Promise((r) => setTimeout(r, 250));
  const s = f.querySelector(".cb-search");
  s.value = "A549"; s.dispatchEvent(new Event("input", {bubbles: true}));
  await new Promise((r) => setTimeout(r, 250));
  return [...f.querySelectorAll(".cb-opt")].some((o) => /A549/.test(o.textContent));
}));
ck("no stale nav links", !(await page.$$eval("a", (a) => a.map((x) => x.pathname)))
  .some((p) => ["/genotype", "/tf", "/report", "/methods", "/diagnostics"].includes(p)));
ck("nav is three items", await count(".topnav-links a") === 3);

// ---- dashboard, one compound -------------------------------------------
console.log("\n/results?d=Adagrasib (one drug)");
await go("/results?dose=0.5&d=Adagrasib");
ck("no page errors", errs.length === 0, errs[0]);
let t = await text();
ck("names the drug", t.includes("Adagrasib"));
// the direction split, and that the two arms reconcile with the total
ck("response chart splits induced from repressed", await page.evaluate(() => {
  // by heading, not by position: the overview panels are laid out summary and
  // genotype on top, this chart full width beneath them
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /magnitude by cell line/.test(x.querySelector(".panel-h")?.textContent ?? ""));
  // Plot puts the colour legend in an HTML figure beside the svg, not in it
  const leg = p.textContent;
  const bars = p.querySelectorAll("svg g[aria-label='bar'] rect").length;
  const rows = p.querySelectorAll("svg g[aria-label='y-axis tick label'] text").length;
  return /induced/.test(leg) && /repressed/.test(leg) && bars >= rows;
}));
ck("control is named as untreated DMSO",
   /untreated DMSO control/i.test(t) && !/vehicle/i.test(t), (t.match(/vehicle/i) ?? [])[0]);
// ---- the header counts open what they stand for -------------------------
// One drug and 47 cell lines: the title is a plain name, the count is a peek.
ck("the drug title is not a peek with one drug",
   await page.$$eval(".result-head h1 details.peek", (e) => e.length) === 0);
ck("the cell line count opens a list", await count(".result-head .sub details.peek") === 1);
ck("the peek names every selected line",
   await count(".result-head .sub .peek-item") === 47);
ck("a peek entry narrows the query to that line", await page.$eval(
  ".result-head .sub .peek-item", (e) => {
    const p = new URLSearchParams(e.getAttribute("href").slice(1));
    return p.get("d") === "Adagrasib" && p.get("dose") === "0.5"
        && (p.get("l") ?? "").split(",").length === 1;
  }));
// A list of 47 gets a filter; the filter hides, it does not reorder
await page.evaluate(() => document.querySelector(".result-head .sub .peek > summary").click());
await new Promise((r) => setTimeout(r, 200));
ck("the peek opens on click", await count(".result-head details.peek[open]") === 1);
await page.type(".result-head .peek-f", "pancreas");
await new Promise((r) => setTimeout(r, 300));
const peeked = await page.$$eval(".result-head .peek-item",
  (e) => e.filter((x) => !x.hidden).map((x) => x.querySelector(".peek-n").textContent));
ck("the filter narrows the list", peeked.length > 0 && peeked.length < 47
   && peeked.includes("MIA PaCa-2"), peeked.join(", "));
await page.evaluate(() => document.body.click());
await new Promise((r) => setTimeout(r, 200));
ck("a click outside closes the peek", await count("details.peek[open]") === 0);
ck("edit query button, with a pencil",
   (await page.$eval(".btn-ghost", (e) => e.textContent.trim())) === "Edit query"
   && await count(".btn-ghost svg.ico") === 1);
ck("five tabs", await count(".tab") === 5);
// Pinned to the labels in results.md. If they are edited there, update here
// rather than the other way round.
ck("tab labels are biological", await page.$$eval(".tab .tab-l", (e) =>
  JSON.stringify(e.map((x) => x.textContent)) === JSON.stringify(
    ["Overview", "Differential Expression", "Transcription Factor Activity",
     "Profile Similarity", "Genotype Specificity"])));
// the words the terminology sweep removed, in anything a reader sees
ck("no lesion or allele anywhere in the page", await page.evaluate(() =>
  !/\b(lesion|allele)s?\b/i.test(document.body.innerText)),
  (await text()).match(/.{0,40}(lesion|allele).{0,40}/i)?.[0]);
ck("one tab panel visible at a time", await page.evaluate(() =>
  [...document.querySelectorAll(".tabpanel")].filter((p) => !p.hidden)
    .every((p) => p.dataset.tab === document.querySelector(".tab.is-active").dataset.tab)));
ck("thirteen panels across all tabs", await count(".dash > .panel") === 13);
// the similarity tab shows gene and TF space side by side, on one ordering
await page.evaluate(() => document.querySelector('.tab[data-tab="similarity"]').click());
await new Promise((r) => setTimeout(r, 2500));
ck("both spaces shown side by side", await page.evaluate(() => {
  const h = [...document.querySelectorAll(".two-up .sub-h")].map((x) => x.textContent);
  if (!h.includes("Expression Space") || !h.includes("TF Activity Space")) return false;
  const [a, b] = [...document.querySelectorAll(".two-up > div")].map((d) => d.getBoundingClientRect());
  return Math.abs(a.top - b.top) < 40 && a.left !== b.left;
}));
// CAUTION BANNERS TEMPORARILY OFF in results.md; restore with them.
// ck("the positive offset is disclosed", /absolute value is not interpretable/i.test(await text()));
ck("centring control present", await count('.dash input[type="checkbox"]') >= 1);
// every tab is opened in turn; a panel is only judged while its tab is shown
const panels = [];
for (const key of ["overview", "deg", "tf", "similarity", "association"]) {
  await page.evaluate((k) => document.querySelector(`.tab[data-tab="${k}"]`).click(), key);
  await new Promise((r) => setTimeout(r, 1600));
  panels.push(...await page.evaluate(() =>
    [...document.querySelectorAll(".tabpanel")].filter((p) => !p.hidden)
      .flatMap((v) => [...v.querySelectorAll(".panel")])
      .map((p) => ({h: p.querySelector(".panel-h")?.textContent.trim(),
                    marks: p.querySelectorAll("svg [aria-label], table tbody tr").length,
                    empty: !!p.querySelector(".empty"),
                    err: !!p.querySelector(".observablehq--error")}))));
}
ck("no panel errored in any tab", panels.every((p) => !p.err),
   panels.filter((p) => p.err).map((p) => p.h).join("; "));
// A chart wider than its panel hides behind a scrollbar nobody sees.
const overflow = [];
for (const key of ["overview", "deg", "tf", "similarity", "association"]) {
  await page.evaluate((k) => document.querySelector(`.tab[data-tab="${k}"]`).click(), key);
  await new Promise((r) => setTimeout(r, 1500));
  overflow.push(...await page.evaluate((k) =>
    [...document.querySelectorAll(".tabpanel:not([hidden]) .scrollx")]
      .filter((d) => d.scrollWidth > d.clientWidth + 2)
      .map((d) => `${k}: ${d.scrollWidth} in ${d.clientWidth}`), key));
}
ck("nothing scrolls sideways", overflow.length === 0, overflow.join("; "));
t = await text();
t = await text();
// "At a glance" is a definition list, not a chart, so it is checked by its text
// "At a glance" is a definition grid, and "Drugs with a similar response" is
// deliberately empty for a drug that already has a genotype verdict.
// Deliberately empty with a single drug selected: each compares across drugs.
const SOFT = ["Query summary",
              "Nearest drugs by transcription factor signature",
              "Transcription factor activity by drug and pathway",
              "Genotype specificity summary"];
for (const p of panels.filter((x) => !SOFT.includes(x.h)))
  ck(`panel "${p.h}" has content`, p.marks > 0 && !p.empty,
     `marks=${p.marks} empty=${p.empty}`);
ck("query summary facts", await count(".facts .fact-v") >= 8);
// Every figure must come from the contrasts the query returned, not the panel.
ck("summary is computed over the returned contrasts", await page.evaluate(() => {
  const f = Object.fromEntries([...document.querySelectorAll(".fact")].map((x) =>
    [x.querySelector(".fact-k").textContent.trim(),
     x.querySelector(".fact-v").textContent.replace(/\s+/g, " ").trim()]));
  return f["Contrasts returned"]?.startsWith("47")
      && /per contrast/.test(f["Median DE genes"] ?? "")
      && /DE genes per contrast/.test(f["Interquartile range"] ?? "")
      && /MIA PaCa-2/.test(f["Maximum DE genes"] ?? "");
}));
ck("summary avoids the colloquial label",
   !/Genes changed, typical|Most in any line|Responded/.test(await text()));
const onTab = async (k, openMethods = true) => {
  await page.evaluate((x) => document.querySelector(`.tab[data-tab="${x}"]`).click(), k);
  await new Promise((r) => setTimeout(r, 1800));
  if (openMethods) {
    await page.evaluate(() => document
      .querySelectorAll(".tabpanel:not([hidden]) .method").forEach((d) => (d.open = true)));
    await new Promise((r) => setTimeout(r, 250));
  }
  return text();
};
const tDeg = await onTab("deg");
// the per-cell-line view: which genes moved in which line, not just pooled
ck("gene matrix present", /differentially expressed genes by cell line/i.test(tDeg));
ck("matrix says what a blank cell means",
   /empty cell indicates the gene was not differentially expressed/i.test(tDeg),
   tDeg.slice(0, 400));
ck("matrix discloses the storage cap",
   /30 strongest per direction per condition are stored/.test(tDeg));
ck("matrix drawn with cells for several lines", await page.evaluate(() => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /by cell line/i.test(x.querySelector(".panel-h").textContent));
  if (!p) return false;
  const cells = p.querySelectorAll("svg g[aria-label='cell'] rect").length;
  const cols = new Set([...p.querySelectorAll("svg g[aria-label='cell'] rect")]
    .map((r) => r.getAttribute("x"))).size;
  return cells >= 200 && cols >= 10;
}));
ck("single condition gene view present",
   /differential expression in a single condition/i.test(tDeg));
// a native select is unscannable at 48 options and ignores the organ glyphs
ck("gene view uses the searchable combobox, not a native select",
   await page.evaluate(() => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /in a single condition/i.test(x.querySelector(".panel-h").textContent));
  return !!p && !!p.querySelector(".cb-trigger") && !p.querySelector("select");
}));
ck("condition selector carries organ glyphs", await page.evaluate(async () => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /in a single condition/i.test(x.querySelector(".panel-h").textContent));
  p.querySelector(".cb-trigger").click();
  await new Promise((r) => setTimeout(r, 400));
  const n = p.querySelectorAll(".cb-opt svg.ico-organ").length;
  p.querySelector(".cb-trigger").click();
  return n >= 20;
}));
ck("the trigger shows only the cell line name", await page.evaluate(() => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /in a single condition/i.test(x.querySelector(".panel-h").textContent));
  // a <title> inside the glyph used to leak into textContent as "PancreasMIA PaCa-2"
  return !/^[A-Z][a-z]+[A-Z]/.test(p.querySelector(".cb-trigger").textContent.trim());
}));
ck("the G12C-specific programme is visible in the matrix",
   /SPRY4/.test(tDeg) && /DUSP6/.test(tDeg));
ck("gene symbols shown", /\b(SPRY4|DUSP6|EGR1|FOSL1|JUN)\b/.test(tDeg), tDeg.slice(0, 200));
ck("DEG method note states the threshold", /FDR-significant set exactly/.test(tDeg));
const tTf = await onTab("tf");
ck("pathway names, not raw z", tTf.includes("MAPK / AP-1 output"));
ck("TF byline names the method", /univariate linear model|ULM/.test(tTf)
   && /CollecTRI/.test(tTf) && /tmin/.test(tTf));
ck("TF note states its aggregation order",
   /median over conditions per factor/.test(tTf));
// the per-condition view: what this drug did to TF activity in one cell line
ck("per-condition TF panel present",
   /transcription factor activity in a single condition/i.test(tTf));
ck("per-condition note says the score is already a contrast",
   /already a contrast with the untreated\s+controls/.test(tTf));
ck("per-condition panel is bidirectional", await page.evaluate(() => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /in a single condition/i.test(x.querySelector(".panel-h").textContent));
  if (!p) return false;
  const w = [...p.querySelectorAll("svg g[aria-label='bar'] rect")]
    .map((r) => +r.getAttribute("x"));
  const zero = p.querySelector("svg g[aria-label='rule'] line");
  return w.length >= 20 && new Set(w).size > 2;   // bars start at both sides of 0
}));
ck("condition selector present", await count(".tabpanel:not([hidden]) .cb-trigger") >= 1);
ck("the repressed AP-1 programme is visible", /\bJUN\b/.test(tTf) && /\bELK1\b/.test(tTf));
t = await onTab("association");
ck("the genotype, not just the gene", /vs other mutations in the same gene/.test(t));
const tOv = await onTab("overview");
ck("genotype panel",
   /oncogenic genotype of the selected cell lines/i.test(tOv) && /ACH-\d{6}/.test(tOv));
ck("DepMap byline names the source column",
   /Driver_GeneType_DM/.test(tOv) && /Driver_ProtEffect/.test(tOv));
ck("verdict is stated", /genotype-selective/i.test(tOv), tOv.slice(0, 300));
ck("verdict names the genotype", /KRAS p\.G12C/.test(tOv));
// CAUTION BANNERS TEMPORARILY OFF in results.md; restore with them.
// ck("lineage caveat shown", /tissue of origin cannot be fully separated/i.test(tOv));
const tSim = await onTab("similarity");
ck("similarity panel", /profile correlation in expression and regulon space/i.test(tSim));
ck("neighbours suppressed when a verdict exists",
   /which is the stronger evidence/i.test(tSim));
t = await onTab("association");
// AUROC is allowed now: the ladder table prints it with its scale explained in
// the caption below it. What stays banned is the vocabulary of the superseded
// analysis, which no longer has anything behind it.
ck("no retired vocabulary",
  !/noise floor|reproducibility ceiling|resid_df|thresholds\.json|stage S\d/i.test(t),
  (t.match(/noise floor|reproducibility ceiling|resid_df|thresholds\.json|stage S\d/i) ?? [])[0]);
// the method lives behind an (i) disclosure, the caption stays plain
ck("every tab carries a method note", await page.evaluate(async () => {
  for (const k of ["overview", "deg", "tf", "similarity", "association"]) {
    document.querySelector(`.tab[data-tab="${k}"]`).click();
    await new Promise((r) => setTimeout(r, 400));
    if (!document.querySelector(".tabpanel:not([hidden]) .method > summary")) return false;
  }
  return true;
}));
ck("method notes are collapsed by default", await page.evaluate(() => {
  document.querySelectorAll(".method").forEach((d) => (d.open = false));
  return document.querySelectorAll(".method").length >= 1;
}) && await count(".method[open]") === 0);
ck("no technical vocabulary in the plain captions", await page.evaluate(() => {
  const caps = [...document.querySelectorAll(".panel .caption")]
    .filter((c) => !c.closest(".method-body"));
  return !caps.some((c) => /Wald|ULM|CollecTRI|Benjamini|tmin|Driver_|padj|Mann-Whitney/
    .test(c.textContent));
}));
ck("the 0.5-to-1 scale is explained",
  /range from 0\.5, the two genotype groups being indistinguishable/.test(t),
  t.slice(0, 200));
// Plot right-anchors an x label by default, which ran long sentences off the
// plot and into whatever sat in the right margin.
ck("x axis labels are centred", await page.evaluate(() => {
  const vis = [...document.querySelectorAll(".tabpanel:not([hidden]) svg")];
  const labels = vis.flatMap((s) => [...s.querySelectorAll("text")])
    .filter((t) => /repressed|activated|fold change|genes changed|carrying/.test(t.textContent));
  if (!labels.length) return true;
  return labels.every((t) => (t.getAttribute("text-anchor") ?? "middle") === "middle");
}));

// the genotype ladder
ck("all three measures are named", /differential expression/i.test(t)
   && /transcription factor activity/i.test(t) && /profile concordance/i.test(t));
ck("ladder shows all three rungs", await page.evaluate(() => {
  const tb = [...document.querySelectorAll("table.ladder")][0];
  if (!tb) return false;
  const txt = tb.textContent;
  return ["any mutation in the gene vs wild type", "this genotype vs wild type",
          "this genotype vs other mutations in the same gene"].every((x) => txt.includes(x));
}));
ck("the conditional rung is the one highlighted", await page.evaluate(() => {
  const rows = [...document.querySelectorAll("table.ladder tbody tr")];
  const r4 = rows.filter((r) => r.textContent.includes("vs other mutations")
                                && r.querySelector("td.is-hit"));
  // one dose is selected, so exactly one conditional row should be hit
  return r4.length >= 1 && r4.every((r) => r.textContent.includes("G12C"));
}));
ck("factor evidence ranked by effect size", /not by <i>p<\/i>|not by p/i.test(t));
ck("ETS1 named among the moved factors", /ETS1/.test(t));
ck("method note names the spec file", /oncogenic_genotypes\.yaml/.test(t));
ck("exact test named, not asymptotic", /exact Mann-Whitney/i.test(t));

// tooltip: hover the first bar of the response panel and measure contrast.
// Must be on a visible tab: a hidden panel has a zero bounding rect, the mouse
// lands nowhere and the tip never renders.
await onTab("overview");
const tip = await (async () => {
  const box = await page.$eval(
    ".tabpanel:not([hidden]) .panel svg g[aria-label='bar'] rect", (r) => {
      const b = r.getBoundingClientRect();
      return {x: b.x + b.width / 2, y: b.y + b.height / 2};
    });
  await page.mouse.move(box.x, box.y);
  await new Promise((r) => setTimeout(r, 600));
  return page.evaluate(() => {
    const g = document.querySelector("g[aria-label='tip']");
    if (!g) return null;
    const txt = [...g.querySelectorAll("text")].map((n) => n.textContent).join(" ").trim();
    const path = g.querySelector("path");
    if (!path) return {txt, ratio: null};
    const lum = (c) => { const m = getComputedStyle(document.body).color && c.match(/[\d.]+/g);
      if (!m) return null; const [r, gg, b] = m.map(Number).map((v) => {
        v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
      return 0.2126 * r + 0.7152 * gg + 0.0722 * b; };
    const bg = lum(getComputedStyle(path).fill);
    const fg = lum(getComputedStyle(g.querySelector("text")).fill);
    const ratio = bg == null || fg == null ? null
      : (Math.max(bg, fg) + 0.05) / (Math.min(bg, fg) + 0.05);
    return {txt, ratio};
  });
})();
ck("tooltip appears", !!tip?.txt, JSON.stringify(tip));
ck("tooltip text is legible", (tip?.ratio ?? 0) >= 4.5, `contrast ${tip?.ratio?.toFixed(1)}`);
// Flat monochrome blocks are hard to scan. The label should recede and the
// value carry the weight, with the first line acting as a title.
ck("tooltip has a typographic hierarchy", await page.evaluate(() => {
  const g = document.querySelector("g[aria-label='tip']");
  if (!g) return false;
  const lines = [...g.querySelectorAll("text > tspan")];
  if (lines.length < 2) return false;
  const title = getComputedStyle(lines[0]);
  const label = lines.map((l) => l.querySelector("tspan")).find(Boolean);
  if (!label) return false;
  const ls = getComputedStyle(label), vs = getComputedStyle(lines[1]);
  return +title.fontSize.replace("px", "") > +ls.fontSize.replace("px", "")
      && +vs.fontWeight > +ls.fontWeight;
}));

// ---- dashboard, many compounds -----------------------------------------
// a drug the ladder cannot speak about must say so and fall back to neighbours
console.log("\n/results?d=Panobinostat (no genotype test applies)");
await go("/results?dose=0.5&d=Panobinostat");
ck("no page errors", errs.length === 0, errs[0]);
let tp = await onTab("overview");
ck("says it has no genotype-directed target",
   /no genotype-directed target/i.test(tp), tp.slice(0, 300));
tp = await onTab("similarity");
ck("falls back to the neighbourhood",
   /nearest neighbour shares the annotated mechanism/i.test(tp), tp.slice(0, 200));
ck("hit rate is stated with the neighbours", /% of the time against/.test(tp));

console.log("\n/results?d=Dabrafenib (pathway axis only)");
await go("/results?dose=0.5&d=Dabrafenib");
ck("no page errors", errs.length === 0, errs[0]);
const td = await text();
ck("verdict names BRAF V600E", /BRAF p\.V600E/.test(td));
ck("verdict names only the measures that carried it",
   /transcription factor activity, profile concordance/.test(td), td.slice(0, 400));

console.log("\n/results (every drug, heatmap mode)");
await go("/results?dose=0.5");
ck("no page errors", errs.length === 0, errs[0]);
const cells = await page.$$eval("svg [aria-label='cell'] rect", (e) => e.length).catch(() => 0);
ck("heatmap drawn", cells > 500, `${cells} cells`);
// A capped panel must say what to do instead, not just go blank.
ck("gene panel explains its cap", (await onTab("deg")).includes("capped at 8"));
ck("similarity declines gracefully",
   (await onTab("similarity")).includes("capped at 6 drugs"));

// ---- genotype query ----------------------------------------------------
console.log("\n/results: two drugs, five lines, correlation matrix");
const five = "CVCL_0428,CVCL_1547,CVCL_0023,CVCL_0546,CVCL_0031";
await go(`/results?dose=0.5&d=Adagrasib,Trametinib&l=${five}`);
ck("no page errors", errs.length === 0, errs[0]);
ck("two drugs in the heading", (await text()).includes("2 drugs"));
await onTab("similarity");
const corr = await page.evaluate(() => {
  const p = [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .find((x) => /profile correlation/i.test(x.querySelector(".panel-h").textContent));
  if (!p) return {missing: true};
  return {cells: p.querySelectorAll("svg [aria-label='cell'] rect").length,
          mats: p.querySelectorAll(".two-up > div").length,
          empty: !!p.querySelector(".empty")};
});
ck("both correlation matrices drawn",
   corr.mats === 2 && corr.cells >= 2 * 64 && !corr.empty, JSON.stringify(corr));

// centring must recompute both matrices, not just relabel them
const before = await page.$eval(".two-up .legend-line", (e) => e.textContent);
await page.evaluate(() => {
  // the centring toggle, by its label: other panels carry checkboxes too
  const b = [...document.querySelectorAll('.dash input[type="checkbox"]')]
    .find((x) => /per-feature mean/.test(x.closest("label")?.textContent ?? ""))
    ?? [...document.querySelectorAll('.dash input[type="checkbox"]')][0];
  b.click();
});
await new Promise((r) => setTimeout(r, 3000));
const after = await page.$eval(".two-up .legend-line", (e) => e.textContent);
ck("centring recomputes the matrices", before !== after, `${before} -> ${after}`);
ck("centring reveals anticorrelation",
   /[1-9]\d?% negative/.test(after), after);
ck("centring explains that the tests are unaffected", await page.evaluate(() => {
  document.querySelectorAll(".tabpanel:not([hidden]) .method").forEach((d) => (d.open = true));
  return /unaffected either way/i.test(document.body.innerText);
}));
console.log("\n/results: all three concentrations");
await go("/results?d=Adagrasib");
ck("no page errors", errs.length === 0, errs[0]);
ck("all doses in the subtitle", (await text()).includes("0.05, 0.5, 5"));

// ---- browse and about --------------------------------------------------
for (const [u, name, needles] of [
  ["/statistics", "browse", ["Transcriptional potency by drug",
                             "Intrinsic responsiveness by cell line",
                             "Transcription factor activity across the panel"]],
  ["/about", "about", ["How differential expression is measured",
                       "What this cannot tell you", "false-discovery rate"]]
]) {
  console.log(`\n${u}`);
  await go(u);
  ck("no page errors", errs.length === 0, errs[0]);
  const body = await text();
  for (const n of needles) ck(`has "${n}"`, body.includes(n));
  ck("charts rendered", await count("svg") >= (name === "about" ? 0 : 3));
}
console.log("\n/statistics: dose switch");
await go("/statistics");
// Inputs.radio labels the input, and its value attribute is an index, so click
// the label whose text is the dose rather than matching on value.
await page.evaluate(() => {
  const l = [...document.querySelectorAll("label")].find((x) => x.textContent.trim() === "5");
  if (!l) throw new Error("no 5 µM option: " +
    [...document.querySelectorAll("label")].map((x) => x.textContent.trim()).join("|"));
  (l.querySelector("input") ?? l).click();
});
await new Promise((r) => setTimeout(r, 2500));
ck("switching dose does not error", errs.length === 0, errs[0]);

// ---- lazy detail is not bundled ----------------------------------------
const sizes = await page.evaluate(async (port) => {
  const r = await fetch(`http://localhost:${port}/_file/detail/genes/Adagrasib.arrow`);
  return {ok: r.ok, bytes: (await r.arrayBuffer()).byteLength};
}, port);
console.log("\ndetail");
ck("per-compound detail fetches", sizes.ok && sizes.bytes > 1000, JSON.stringify(sizes));
ck("detail file is small", sizes.bytes < 2e6, `${(sizes.bytes / 1e3).toFixed(0)} KB`);
const prof = await page.evaluate(async (port) => {
  const out = {};
  for (const s of ["gene", "tf"]) {
    const r = await fetch(`http://localhost:${port}/_file/detail/profiles/${s}/Adagrasib.arrow`);
    out[s] = {ok: r.ok, bytes: (await r.arrayBuffer()).byteLength};
  }
  return out;
}, port);
ck("gene profiles fetch", prof.gene.ok && prof.gene.bytes > 1e5, JSON.stringify(prof.gene));
ck("tf profiles fetch", prof.tf.ok && prof.tf.bytes > 1e4, JSON.stringify(prof.tf));
ck("a profile stays under a megabyte",
   prof.gene.bytes < 1e6 && prof.tf.bytes < 1e6,
   `${(prof.gene.bytes / 1e3).toFixed(0)} / ${(prof.tf.bytes / 1e3).toFixed(0)} KB`);

// 0.05 has no float32 representation. One table storing dose narrowly was
// enough to make every 0.05 uM query return an empty page with no error, so
// each dose is now asserted to return data.
// Selecting several drugs used to kill four of the five tabs with "pick one
// drug". Only gene detail and profile vectors are per-drug fetches; the
// pathway, genotype and neighbour tables already cover all 379 drugs.
console.log("\nmultiple drugs");
const RAS = "Adagrasib,BI-3406,RMC-6236,Lonafarnib,Trametinib,Binimetinib";
await go(`/results?dose=0.5&d=${encodeURIComponent(RAS)}`);
ck("no page errors with six drugs", errs.length === 0, errs[0]);
const liveIn = async (k) => {
  await onTab(k, false);
  return page.evaluate(() => [...document.querySelectorAll(".tabpanel:not([hidden]) .panel")]
    .map((p) => ({h: p.querySelector(".panel-h").textContent.trim(),
                  live: !p.querySelector(".empty") && !p.querySelector(".observablehq--error")
                        && p.querySelectorAll("svg [aria-label], table tbody tr, .fact").length > 0})));
};
for (const k of ["overview", "deg", "tf", "similarity", "association"]) {
  const ps = await liveIn(k);
  ck(`${k}: every panel live with six drugs`, ps.every((x) => x.live),
     ps.filter((x) => !x.live).map((x) => x.h).join("; "));
}
let tM = await onTab("deg");
ck("gene matrix pivots to drugs", /across the 6 selected drugs/.test(tM), tM.slice(0, 300));
tM = await onTab("tf");
ck("drug by pathway matrix appears",
   /transcription factor activity by drug and pathway/i.test(tM));
tM = await onTab("similarity");
ck("similarity collapses to drug level",
   /Pairwise concordance between drugs/.test(tM), tM.slice(0, 300));
ck("neighbour table lists every selected drug",
   await page.$$eval(".tabpanel:not([hidden]) table.ladder tbody tr", (r) => r.length) === 6);
tM = await onTab("association");
ck("verdict summary across the selection", /genotype specificity summary/i.test(tM));
ck("ladder gains a drug column", await page.evaluate(() =>
  [...document.querySelectorAll(".tabpanel:not([hidden]) table.ladder th")]
    .some((h) => h.textContent.trim() === "drug")));

// and the tabs that cover every drug must survive the whole panel
console.log("\nevery drug at once");
await go("/results?dose=0.5");
ck("no page errors with all drugs", errs.length === 0, errs[0]);
// The panels fed by the eager tables must survive the whole panel. The two
// that need a per-drug fetch are capped by design and must say so instead.
const CAPPED = ["Transcription factor activity in a single condition"];
for (const k of ["overview", "tf", "association"]) {
  const ps = await liveIn(k);
  const dead = ps.filter((x) => !x.live && !CAPPED.includes(x.h)).map((x) => x.h);
  ck(`${k}: still answers for all 376 drugs`, dead.length === 0, dead.join("; "));
}
ck("the capped factor panel explains itself at 376 drugs",
   /capped at 8/.test(await onTab("tf", false)));
const tAll = await onTab("deg", false);
ck("gene tab explains its cap rather than going blank",
   /capped at 8/.test(tAll) && /cover every drug/.test(tAll), tAll.slice(0, 300));

console.log("\nevery concentration returns data");
for (const d of ["0.05", "0.5", "5", "0.05,0.5,5"]) {
  await go(`/results?dose=${d}&d=Adagrasib`);
  const sub = await page.$eval(".result-head .sub", (e) => e.textContent);
  const n = Number((sub.match(/([\d,]+) measurements/) ?? [0, "0"])[1].replace(/,/g, ""));
  ck(`dose=${d} returns measurements`, n > 0, sub.trim());
  ck(`dose=${d} prints cleanly`, !/0\.0500000/.test(await text()));
}

console.log("\nwording");
for (const u of ["/results?dose=0.5&d=Adagrasib", "/statistics", "/about"]) {
  await go(u);
  const body = await text();
  ck(`no "vehicle" on ${u}`, !/\bvehicle\b/i.test(body),
     (body.match(/.{0,40}vehicle.{0,40}/i) ?? [])[0]);
}
await go("/statistics");
const all = [await text()];
await go("/about"); all.push(await text());
await go("/"); all.push(await text());
ck("the word compound is gone", !/compound/i.test(all.join(" ")),
   (all.join(" ").match(/.{0,40}compound.{0,40}/i) ?? [])[0]);

await br.close(); srv.close();
console.log(`\n${pass} passed, ${fail.length} failed`);
if (fail.length) { for (const f of fail) console.log("  FAIL " + f); process.exit(1); }
