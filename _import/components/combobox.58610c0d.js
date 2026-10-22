/**
 * A searchable dropdown with categories.
 *
 * Replaces the pair of controls this page used to have (a grouped <select> plus a
 * separate datalist input). A native <select> cannot be typed into, and a native
 * datalist cannot show categories and renders an inconsistent affordance across
 * browsers. One control does both: click to open, type to filter, arrow keys to
 * move, Enter to choose.
 *
 *   groups: [[categoryLabel, [[value, label, sublabel?], …]], …]
 *
 * The element exposes `.value` and fires "input", so Observable's
 * Generators.input reads it like any built-in control.
 */
export function comboBox(groups, {value, placeholder = "Search…", ariaLabel} = {}) {
  const flat = groups.flatMap(([g, items]) => items.map(([v, l, s]) => ({g, v, l, s})));
  // A label may be a node, so an option can carry a glyph. The trigger shows a
  // clone, because the same node cannot live in the list and the trigger at once.
  const entryOf = (v) => flat.find((o) => o.v === v);
  const textOf = (l) => (l instanceof Node ? l.textContent : l) ?? "";

  const root = document.createElement("div");
  root.className = "cb";
  if (ariaLabel) root.setAttribute("aria-label", ariaLabel);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cb-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");
  trigger.setAttribute("aria-expanded", "false");

  const panel = document.createElement("div");
  panel.className = "cb-panel";
  panel.hidden = true;

  const search = document.createElement("input");
  search.type = "text";
  search.className = "cb-search";
  search.placeholder = placeholder;
  search.autocomplete = "off";
  search.spellcheck = false;

  const list = document.createElement("div");
  list.className = "cb-list";
  list.setAttribute("role", "listbox");

  panel.append(search, list);
  root.append(trigger, panel);

  let current = value ?? flat[0]?.v;
  let active = -1;
  let shown = [];

  const paint = () => {
    const l = entryOf(current)?.l;
    trigger.textContent = "";
    if (l instanceof Node) trigger.appendChild(l.cloneNode(true));
    else trigger.textContent = l ?? current;
  };

  function render(filter = "") {
    const f = filter.trim().toLowerCase();
    list.textContent = "";
    shown = [];
    for (const [g, items] of groups) {
      const hits = items.filter(([v, l, s]) =>
        !f || textOf(l).toLowerCase().includes(f)
           || (s ?? "").toLowerCase().includes(f));
      if (!hits.length) continue;
      const head = document.createElement("div");
      head.className = "cb-group";
      head.textContent = g;
      list.appendChild(head);
      for (const [v, l, s] of hits) {
        const o = document.createElement("div");
        o.className = "cb-opt" + (v === current ? " is-selected" : "");
        o.setAttribute("role", "option");
        o.dataset.value = v;
        o.innerHTML = "";
        const main = document.createElement("span");
        main.className = "cb-opt-l";
        if (l instanceof Node) main.appendChild(l.cloneNode(true));
        else main.textContent = l;
        o.appendChild(main);
        if (s) {
          const sub = document.createElement("span");
          sub.className = "cb-opt-s";
          sub.textContent = s;
          o.appendChild(sub);
        }
        o.onclick = () => choose(v);
        list.appendChild(o);
        shown.push(o);
      }
    }
    if (!shown.length) {
      const e = document.createElement("div");
      e.className = "cb-none";
      e.textContent = "No match";
      list.appendChild(e);
    }
    active = shown.findIndex((o) => o.dataset.value === current);
    highlight();
  }

  function highlight() {
    shown.forEach((o, i) => o.classList.toggle("is-active", i === active));
    if (active >= 0) shown[active].scrollIntoView({block: "nearest"});
  }

  function open() {
    panel.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
    search.value = "";
    render();
    search.focus();
  }
  function close() {
    panel.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }
  function choose(v) {
    current = v;
    paint();
    close();
    root.dispatchEvent(new Event("input", {bubbles: true}));
  }

  trigger.onclick = () => (panel.hidden ? open() : close());
  search.oninput = () => render(search.value);
  search.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); highlight(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].dataset.value); }
    else if (e.key === "Escape") { e.preventDefault(); close(); trigger.focus(); }
  };
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !root.contains(e.target)) close();
  });

  Object.defineProperty(root, "value", {
    get: () => current,
    set: (v) => { current = v; paint(); }
  });
  paint();
  return root;
}
