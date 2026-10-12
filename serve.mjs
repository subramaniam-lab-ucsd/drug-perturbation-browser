// Serve the static build locally with the .html fallback that clean URLs need.
//
// `python -m http.server` 404s on /drugs because the file is drugs.html. Real
// static hosts (Netlify, Vercel, GitHub Pages, nginx try_files) do this fallback
// for you; this is the local equivalent.
import {createServer} from "node:http";
import {readFile, stat} from "node:fs/promises";
import {join, extname, normalize} from "node:path";

const ROOT = "dist";
const PORT = Number(process.argv[2] ?? 3000);
const MIME = {".html":"text/html; charset=utf-8", ".js":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".arrow":"application/octet-stream",
  ".png":"image/png", ".svg":"image/svg+xml", ".wasm":"application/wasm",
  ".woff2":"font/woff2", ".woff":"font/woff", ".map":"application/json"};

createServer(async (req, res) => {
  try {
    let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
    if (p.includes("..")) throw new Error("traversal");
    if (p.endsWith("/")) p += "index.html";
    let f = join(ROOT, p);
    try { if ((await stat(f)).isDirectory()) f = join(f, "index.html"); }
    catch { f = join(ROOT, p + ".html"); }        // the clean-URL fallback
    const body = await readFile(f);
    res.writeHead(200, {"content-type": MIME[extname(f)] ?? "application/octet-stream"});
    res.end(body);
  } catch {
    res.writeHead(404, {"content-type": "text/plain"});
    res.end("not found");
  }
}).listen(PORT, () => console.log(`serving ${ROOT}/ at http://localhost:${PORT}/`));
