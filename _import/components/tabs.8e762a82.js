/**
 * A tab bar whose panels are already in the DOM.
 *
 * Panels are plain markup carrying `data-tab`, so Framework renders every cell
 * once and switching a tab only toggles `hidden`. Rendering on demand would be
 * tidier markup and would also recompute a 47x47 correlation matrix on every
 * click, and Plot sizes its charts from explicit widths rather than from the
 * DOM, so a chart drawn while hidden comes out correct.
 *
 *   tabs([["overview", "Overview", "12 lines"], ...], {value})
 *
 * The element exposes `.value` and fires "input", so Generators.input and
 * view() read it like any built-in control.
 */
export function tabs(defs, {value, ariaLabel = "Sections"} = {}) {
  const root = document.createElement("div");
  root.className = "tabbar";
  root.setAttribute("role", "tablist");
  root.setAttribute("aria-label", ariaLabel);

  let current = value ?? defs[0]?.[0];
  const buttons = new Map();

  const paint = () => {
    for (const [key, b] of buttons) {
      const on = key === current;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
  };

  const keys = defs.map(([k]) => k);
  for (const [key, label, note] of defs) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tab";
    b.setAttribute("role", "tab");
    b.dataset.tab = key;
    const t = document.createElement("span");
    t.className = "tab-l";
    t.textContent = label;
    b.appendChild(t);
    if (note) {
      const n = document.createElement("span");
      n.className = "tab-n";
      n.textContent = note;
      b.appendChild(n);
    }
    b.onclick = () => {
      if (key === current) return;
      current = key;
      paint();
      root.dispatchEvent(new Event("input", {bubbles: true}));
    };
    b.onkeydown = (e) => {
      const i = keys.indexOf(current);
      const j = e.key === "ArrowRight" ? i + 1 : e.key === "ArrowLeft" ? i - 1 : null;
      if (j == null) return;
      e.preventDefault();
      const next = keys[(j + keys.length) % keys.length];
      buttons.get(next).click();
      buttons.get(next).focus();
    };
    buttons.set(key, b);
    root.appendChild(b);
  }

  Object.defineProperty(root, "value", {
    get: () => current,
    set: (v) => { if (buttons.has(v)) { current = v; paint(); } }
  });
  paint();
  return root;
}

/** Show the panels belonging to `key`, hide the rest. */
export function showTab(key, selector = ".tabpanel") {
  for (const p of document.querySelectorAll(selector)) {
    p.hidden = p.dataset.tab !== key;
  }
}
