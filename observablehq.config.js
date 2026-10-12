// The data under src/data/ is static Arrow and JSON, not loader output, so this
// repository builds with node alone. The loaders that produced those files are
// kept in loaders/ and re-run by ./refresh.sh against the analysis repository.
// Hrefs are relative, not absolute. GitHub Pages serves a project site from
// org.github.io/<repo>/, so "/statistics" would leave the site entirely. Every
// page sits at depth 1, so "./statistics" is correct both at the domain root
// and under a prefix. The in-page links in index.md already use "./results".
const NAV = [
  {href: "./", label: "Query", match: (p) => p === "/index" || p === "/results"},
  {href: "./statistics", label: "Datasets", match: (p) => p === "/statistics"},
  {href: "./about", label: "About", match: (p) => p === "/about"}
];

const header = ({path}) => `
<header class="topnav">
  <div class="topnav-inner">
    <a class="brand" href="./">
      <svg class="mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7.5" fill="var(--color-brand-600)"/><rect x="7" y="19" width="4" height="7" rx="2" fill="#fff" opacity=".55"/><rect x="14" y="13" width="4" height="13" rx="2" fill="#fff" opacity=".8"/><rect x="21" y="6" width="4" height="20" rx="2" fill="var(--color-accent-500)"/></svg>
      <span class="brand-text">Drug Perturbation <span>Browser</span></span>
    </a>
    <nav class="topnav-links">
      ${NAV.map((n) => `<a href="${n.href}" class="${n.match(path) ? "is-active" : ""}">${n.label}</a>`).join("")}
    </nav>
    <a class="topnav-cta" href="./">Run a query</a>
  </div>
</header>`;

export default {
  title: "Drug Perturbation Browser",
  root: "src",
  preserveIndex: false,
  // the sidebar is replaced by the top navigation above
  sidebar: false,
  toc: false,
  pages: [],
  header,
  footer: `<div class="shell site-footer">
    <div>
      <strong>Drug Perturbation Browser</strong>
      <p>Differential expression and transcription factor activity in pooled
      chemical-perturbation atlases. Currently Tahoe-100M.</p>
    </div>
    <nav>
      <a href="./">Query</a>
      <a href="./statistics">Datasets</a>
      <a href="./about">About</a>
    </nav>
  </div>`,
  head: '<meta name="color-scheme" content="light">'
      + '<link rel="preconnect" href="https://fonts.googleapis.com">'
      + '<link rel="icon" href="data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20viewBox%3D%220%200%2032%2032%22%3E%3Crect%20width%3D%2232%22%20height%3D%2232%22%20rx%3D%227%22%20fill%3D%22%230072B2%22/%3E%3Crect%20x%3D%227%22%20y%3D%2218%22%20width%3D%224%22%20height%3D%228%22%20rx%3D%222%22%20fill%3D%22%23fff%22%20opacity%3D%22.85%22/%3E%3Crect%20x%3D%2214%22%20y%3D%2212%22%20width%3D%224%22%20height%3D%2214%22%20rx%3D%222%22%20fill%3D%22%23fff%22%20opacity%3D%22.85%22/%3E%3Crect%20x%3D%2221%22%20y%3D%226%22%20width%3D%224%22%20height%3D%2220%22%20rx%3D%222%22%20fill%3D%22%23D55E00%22/%3E%3C/svg%3E">',
  style: "style.css"
};
