// Acceptance for the GitHub Pages deployment, which is NOT the same shape as
// the local build. Two things differ and both have broken the site before:
//
//  1. A project site is served from org.github.io/<repo>/, so every absolute
//     path leaves the site. This serves dist under that prefix and fails on any
//     request that escapes it.
//  2. Pages runs Jekyll unless dist/.nojekyll exists, and Jekyll deletes every
//     path beginning with an underscore. That is _file/, _import/ and
//     _observablehq/. With --jekyll this server mimics that deletion, so the
//     test proves the guard is what keeps the site alive rather than assuming it.
import puppeteer from "puppeteer";
import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {join, extname} from "node:path";
import {existsSync} from "node:fs";

const ROOT = "dist";
const PREFIX = "/drug-perturbation-browser";
const JEKYLL = process.argv.includes("--jekyll");   // simulate Pages WITHOUT .nojekyll
const M = {".html":"text/html",".js":"text/javascript",".css":"text/css",
  ".json":"application/json",".arrow":"application/octet-stream",".csv":"text/csv"};

const escaped = [];      // requests that fell outside the prefix
const stripped = [];     // requests Jekyll would have deleted
const srv = createServer(async (q, r) => {
  let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
  if (!p.startsWith(PREFIX + "/") && p !== PREFIX) {
    escaped.push(p); r.writeHead(404); r.end("outside prefix"); return;
  }
  p = p.slice(PREFIX.length) || "/";
  // Jekyll drops underscore-prefixed paths, so Pages would 404 them.
  if (JEKYLL && p.split("/").some((seg) => seg.startsWith("_"))) {
    stripped.push(p); r.writeHead(404); r.end("jekyll stripped"); return;
  }
  try {
    if (p.endsWith("/")) p += "index.html";
    let f = join(ROOT, p);
    try { await stat(f); } catch { f = join(ROOT, p + ".html"); }   // Pages' extensionless lookup
    const b = await readFile(f);
    r.writeHead(200, {"content-type": M[extname(f)] ?? "application/octet-stream"});
    r.end(b);
  } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise((res) => srv.listen(0, res));
const port = srv.address().port;
const base = `http://localhost:${port}${PREFIX}`;

const br = await puppeteer.launch({args: ["--no-sandbox"]});
const page = await br.newPage();
await page.setViewport({width: 1500, height: 1050});
const errs = [], failed = [];
page.on("pageerror", (e) => errs.push(e.message));
page.on("requestfailed", (q) => failed.push(q.url()));
page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`); });

let pass = 0; const fail = [];
const ck = (n, c, d = "") => { c ? pass++ : fail.push(`${n}  ${d}`);
  console.log(`${c ? "  ok" : "FAIL"}  ${n}${d && !c ? "  " + d : ""}`); };
const go = async (u) => { errs.length = 0; failed.length = 0;
  await page.goto(base + u, {waitUntil: "networkidle0", timeout: 90000});
  await new Promise((r) => setTimeout(r, 3000)); };

console.log(JEKYLL ? "\nPages WITHOUT .nojekyll (must break)" : `\nPages at ${PREFIX}/`);
ck(".nojekyll is in the build", existsSync(join(ROOT, ".nojekyll")));

await go("/");
if (JEKYLL) {
  // The point of the guard: prove the failure is real, so nobody removes it.
  ck("Jekyll would strip the data layer", stripped.length > 0, `${stripped.length} paths`);
  ck("and the page would be dead", failed.length > 0, `${failed.length} failed requests`);
  await br.close(); srv.close();
  console.log(`\n${pass} passed, ${fail.length} failed`);
  process.exit(fail.length ? 1 : 0);
}

ck("landing loads under the prefix", errs.length === 0 && failed.length === 0,
   [errs[0], failed[0]].filter(Boolean).join(" | "));
ck("nothing requested outside the prefix", escaped.length === 0, escaped.slice(0, 3).join(" "));
ck("query form is live", await page.$$eval(".q-field", (e) => e.length) === 3);
// every link a reader can click must stay inside the deployed prefix
const hrefs = await page.$$eval("a[href]", (a) => a.map((x) => x.href));
ck("every link stays inside the prefix",
   hrefs.every((h) => !h.startsWith("http://localhost") || h.includes(PREFIX + "/")
                      || h.endsWith(PREFIX)), hrefs.find((h) =>
   h.startsWith("http://localhost") && !h.includes(PREFIX)));

for (const [label, path] of [["Datasets", "/statistics"], ["About", "/about"]]) {
  await go(path);
  ck(`${label} loads under the prefix`, errs.length === 0 && failed.length === 0,
     [errs[0], failed[0]].filter(Boolean).join(" | "));
}

// the results page is the one that fetches per-drug detail at runtime, by URL
await go("/results?dose=0.5&d=Adagrasib");
ck("results loads under the prefix", errs.length === 0 && failed.length === 0,
   [errs[0], failed[0]].filter(Boolean).join(" | "));
ck("per-drug detail resolved under the prefix", await page.evaluate(() =>
  document.querySelectorAll(".tabpanel:not([hidden]) svg g[aria-label='bar'] rect").length > 0));
const detail = await page.evaluate(() => performance.getEntriesByType("resource")
  .map((e) => e.name).filter((n) => n.includes("/detail/")));
ck("detail fetches carried the prefix", detail.length > 0
   && detail.every((u) => u.includes(PREFIX + "/_file/detail/")), detail[0] ?? "none fetched");

// and the tab that pulls a second payload per drug
await page.evaluate(() => document.querySelector('.tab[data-tab="similarity"]').click());
await new Promise((r) => setTimeout(r, 3500));
ck("similarity tab renders under the prefix",
   await page.$$eval(".tabpanel:not([hidden]) svg", (s) => s.length) > 0 && failed.length === 0,
   failed[0]);

// a deep link is what gets cited, so it must survive a cold load at the prefix
await go("/results?dose=0.5&d=Dabrafenib&lines=A375");
ck("deep link cold-loads under the prefix", errs.length === 0 && failed.length === 0,
   [errs[0], failed[0]].filter(Boolean).join(" | "));

await br.close(); srv.close();
console.log(`\n${pass} passed, ${fail.length} failed`);
for (const f of fail) console.log("  FAIL " + f);
process.exit(fail.length ? 1 : 0);
