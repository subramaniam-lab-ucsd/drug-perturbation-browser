// The dev server and the built site serve static files from different places,
// and the acceptance suite only ever drove the build. That is how every
// per-drug fetch came to 404 in `observable preview` while every test passed.
// This drives the dev server directly, across several drugs, and fails on any
// console error or any panel that rendered an error.
import puppeteer from "puppeteer";
import {spawn} from "node:child_process";
import {dirname} from "node:path";
import {existsSync, readdirSync} from "node:fs";

const PORT = 8200 + Math.floor(Math.random() * 400);  // the CLI needs a real one
const nodeDir = dirname(process.execPath);
const bin = "./node_modules/.bin/observable";
if (!existsSync(bin)) { console.error("observable CLI not found"); process.exit(1); }

const srv = spawn(bin, ["preview", "--port", String(PORT), "--no-open"],
                  {env: {...process.env, PATH: `${nodeDir}:${process.env.PATH}`},
                   stdio: ["ignore", "pipe", "pipe"]});
let up = false;
srv.stdout.on("data", (b) => { if (/Server running/i.test(String(b))) up = true; });
for (let i = 0; i < 60 && !up; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  try { if ((await fetch(`http://localhost:${PORT}/`)).ok) up = true; } catch {}
}
if (!up) { console.error("preview did not start"); srv.kill(); process.exit(1); }

const br = await puppeteer.launch({args: ["--no-sandbox"]});
const page = await br.newPage();
await page.setViewport({width: 1500, height: 1000});
let errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

let pass = 0; const fail = [];
const ck = (n, c, d = "") => { c ? pass++ : fail.push(`${n}  ${d}`);
  console.log(`${c ? "  ok" : "FAIL"}  ${n}${d && !c ? "  " + d : ""}`); };

// Drug names whose slug differs from the name, so the slug function is really
// exercised. The file stem is not the drug name, so passing the stem would
// match no drug and the page would skip the fetch entirely.
const names = JSON.parse(await (await import("node:fs/promises"))
  .readFile("src/.observablehq/cache/data/drugs.arrow").then(() => "[]").catch(() => "[]"));
const tricky = ["18\u03b2-Glycyrrhetinic acid", "\u03b3-Oryzanol", "(R)-Verapamil (hydrochloride)"];
const drugs = ["Adagrasib", "RMC-6236", "Dabrafenib", "BI-3406", "Panobinostat"];

console.log("\ndev server (observable preview)");
for (const d of [...drugs, ...tricky]) {
  errs = [];
  await page.goto(`http://localhost:${PORT}/results?dose=0.5&d=${encodeURIComponent(d)}`,
                  {waitUntil: "networkidle0", timeout: 120000});
  await new Promise((r) => setTimeout(r, 3000));
  const bad = await page.$$eval(".dash > .panel", (ps) => ps
    .filter((p) => p.querySelector(".observablehq--error"))
    .map((p) => (p.querySelector(".panel-h")?.textContent || "?").trim()));
  const fetches = errs.filter((e) => /404|Failed to fetch|HTTP \d/.test(e));
  ck(`${d}`, bad.length === 0 && fetches.length === 0,
     [...bad.map((b) => "panel " + b), ...fetches].join("; ").slice(0, 160));
}

// and the same URLs against the built site, so the two cannot drift again
console.log("\nbuilt site (dist)");
const {createServer} = await import("node:http");
const {readFile, stat} = await import("node:fs/promises");
const {join, extname} = await import("node:path");
const M = {".html":"text/html",".js":"text/javascript",".css":"text/css",
           ".json":"application/json",".arrow":"application/octet-stream"};
const stat2 = createServer(async (q, r) => {
  try {
    let p = decodeURIComponent(new URL(q.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    let f = join("dist", p);
    try { await stat(f); } catch { f = join("dist", p + ".html"); }
    const b = await readFile(f);
    r.writeHead(200, {"content-type": M[extname(f)] ?? "application/octet-stream"});
    r.end(b);
  } catch { r.writeHead(404); r.end("nf"); }
});
await new Promise((r) => stat2.listen(0, r));
const port2 = stat2.address().port;
for (const d of drugs) {
  errs = [];
  await page.goto(`http://localhost:${port2}/results?dose=0.5&d=${encodeURIComponent(d)}`,
                  {waitUntil: "networkidle0", timeout: 120000});
  await new Promise((r) => setTimeout(r, 2500));
  const bad = await page.$$eval(".dash > .panel", (ps) => ps
    .filter((p) => p.querySelector(".observablehq--error"))
    .map((p) => (p.querySelector(".panel-h")?.textContent || "?").trim()));
  const fetches = errs.filter((e) => /404|Failed to fetch|HTTP \d/.test(e));
  ck(`${d}`, bad.length === 0 && fetches.length === 0,
     [...bad.map((b) => "panel " + b), ...fetches].join("; ").slice(0, 160));
}

await br.close(); stat2.close(); srv.kill("SIGTERM");
console.log(`\n${pass} passed, ${fail.length} failed`);
process.exit(fail.length ? 1 : 0);
