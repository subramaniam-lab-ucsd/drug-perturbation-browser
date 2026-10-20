// Formatting and cross-linking. Every drug and line name in the app is a link.
export const fmtP = (p) =>
  p == null || !isFinite(p) ? "n/a"
  : p < 1e-4 ? p.toExponential(1).replace("e-", "e−")
  : p < 0.001 ? p.toFixed(5) : p.toFixed(3);

export const fmtA = (a) => (ok(a) ? a.toFixed(3) : "n/a");

// isFinite(null) === true, because Number(null) === 0. Every null guard in this
// app goes through ok() so that trap cannot come back.
export const ok = (x) => x != null && typeof x === "number" && Number.isFinite(x);

// null-safe rounding for table cells; returns null so the column stays numeric
export const num = (x, d = 3) => (ok(x) ? +x.toFixed(d) : null);

// Outside references. A cell line is keyed here by its Cellosaurus accession,
// which DepMap does not resolve, so celllines.arrow carries the DepMap ACH id
// beside it; a drug is addressed by the PubChem CID in the Tahoe drug
// metadata. Either can be absent (one line and two drugs in this panel), and
// both return null for that, so a name with no id is left unlinked rather than
// pointed at a search page that may land on the wrong compound.
export const depmapHref = (id) =>
  id && id !== "nan" ? `https://depmap.org/portal/cell_line/${id}` : null;
export const pubchemHref = (cid) =>
  cid ? `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` : null;

// both deep-link into the browser, which is the only page that renders an entity
export const drugHref = (d) => `./?drug=${encodeURIComponent(d)}`;
export const lineHref = (c) => `./?line=${encodeURIComponent(c)}`;

export function drugLink(d) {
  const a = document.createElement("a");
  a.href = drugHref(d); a.textContent = d; a.className = "xref";
  return a;
}
export function lineLink(id, name) {
  const a = document.createElement("a");
  a.href = lineHref(id); a.textContent = name ?? id; a.className = "xref";
  return a;
}

// read a query param so pages deep-link into each other
export function param(name, fallback = null) {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}
export function setParam(name, value) {
  const u = new URL(location.href);
  u.searchParams.set(name, value);
  history.replaceState(null, "", u);
}

// Arrow tables come back from FileAttachment().parquet(); make plain rows.
export const rows = (t) => (t.toArray ? t.toArray().map((r) => ({...r})) : t);

// PROMPT.md constraint 3: an AUROC is never shown without its carrier count.
export function aurocCell(auroc, n) {
  const s = document.createElement("span");
  s.innerHTML = `${fmtA(auroc)} <span class="muted">(n=${n})</span>`;
  return s;
}
