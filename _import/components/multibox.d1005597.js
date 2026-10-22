/**
 * The searchable dropdown, holding more than one choice.
 *
 *   groups: [[categoryLabel, [[value, label, sublabel?], …]], …]
 *
 * Selected values render as removable chips in the trigger. `.value` is an
 * array and the element fires "input", so Generators.input reads it like any
 * built-in control.
 *
 * A group value (a category rather than a leaf) expands to its members on
 * click, so "All 48 cell lines" and "KRAS mutant" are shortcuts into the same
 * flat list rather than a second kind of selection the rest of the app would
 * have to understand.
 */
export function multiBox(groups, {value = [], placeholder = "Search…", ariaLabel,
                                  expand = () => null, max = 40,
                                  emptyLabel = "Anything", openGroups = []} = {}) {
  const flat = groups.flatMap(([g, items]) => items.map(([v, l, s]) => ({g, v, l, s})));
  const byValue = new Map(flat.map((o) => [o.v, o]));
  const labelOf = (v) => {
    const l = byValue.get(v)?.l;
    return l instanceof Node ? (l.textContent || v) : (l ?? v);
  };

  const root = document.createElement("div");
  root.className = "cb cb-multi";
  if (ariaLabel) root.setAttribute("aria-label", ariaLabel);

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "cb-trigger";
  trigger.setAttribute("aria-haspopup", "listbox");

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

  let current = value.slice();
  let active = -1;
  let shown = [];
  // Groups start closed. The flat list was hundreds of rows long and the
  // categories at the top were pushed out of view by the first of them.
  const open = new Set(openGroups.length ? openGroups : []);

  function paint() {
    trigger.textContent = "";
    if (!current.length) {
      const e = document.createElement("span");
      e.className = "cb-empty";
      e.textContent = emptyLabel;
      trigger.appendChild(e);
      return;
    }
    for (const v of current.slice(0, 6)) {
      const c = document.createElement("span");
      c.className = "cb-chip";
      c.textContent = labelOf(v);
      const x = document.createElement("span");
      x.className = "cb-x";
      x.textContent = "×";
      x.title = `remove ${labelOf(v)}`;
      // the chip sits inside the trigger, so removing must not also open it
      x.onclick = (e) => { e.stopPropagation(); remove(v); };
      c.appendChild(x);
      trigger.appendChild(c);
    }
    if (current.length > 6) {
      const m = document.createElement("span");
      m.className = "cb-more";
      m.textContent = `+${current.length - 6} more`;
      trigger.appendChild(m);
    }
  }

  function render(filter = "") {
    const f = filter.trim().toLowerCase();
    list.textContent = "";
    shown = [];
    for (const [g, items] of groups) {
      const hits = items.filter(([v, l, s]) => {
        const txt = (l instanceof Node ? l.textContent : l) ?? "";
        return !f || txt.toLowerCase().includes(f)
          || (s ?? "").toLowerCase().includes(f);
      });
      if (!hits.length) continue;
      // Typing opens everything that matches, so search still reaches a
      // closed group without the reader having to guess which one holds it.
      const expanded = !!f || open.has(g);
      const chosenHere = hits.filter(([v]) => current.includes(v)).length;

      const head = document.createElement("button");
      head.type = "button";
      head.className = "cb-group" + (expanded ? " is-open" : "");
      head.setAttribute("aria-expanded", String(expanded));
      const caret = document.createElement("span");
      caret.className = "cb-caret";
      caret.textContent = expanded ? "\u2013" : "+";
      const gl = document.createElement("span");
      gl.className = "cb-group-l";
      gl.textContent = g;
      const gn = document.createElement("span");
      gn.className = "cb-group-n";
      gn.textContent = chosenHere ? `${chosenHere} of ${hits.length}` : String(hits.length);
      head.append(caret, gl, gn);
      head.onclick = () => {
        if (f) return;                       // while searching, groups follow the query
        open.has(g) ? open.delete(g) : open.add(g);
        render(search.value);
      };
      list.appendChild(head);
      if (!expanded) continue;

      for (const [v, l, s] of hits) {
        const o = document.createElement("div");
        o.className = "cb-opt" + (current.includes(v) ? " is-selected" : "");
        o.setAttribute("role", "option");
        o.dataset.value = v;
        const tick = document.createElement("span");
        tick.className = "cb-tick";
        tick.textContent = current.includes(v) ? "\u2713" : "";
        const main = document.createElement("span");
        main.className = "cb-opt-l";
        // a label may be a string or a node, so an option can carry a glyph
        if (l instanceof Node) main.appendChild(l.cloneNode(true));
        else main.textContent = l;
        o.append(tick, main);
        if (s) {
          const sub = document.createElement("span");
          sub.className = "cb-opt-s";
          sub.textContent = s;
          o.appendChild(sub);
        }
        o.onclick = () => toggle(v);
        list.appendChild(o);
        shown.push(o);
      }
    }
    if (!list.childElementCount) {
      const e = document.createElement("div");
      e.className = "cb-none";
      e.textContent = "No match";
      list.appendChild(e);
    }
    highlight();
  }

  function highlight() {
    shown.forEach((o, i) => o.classList.toggle("is-active", i === active));
    if (active >= 0 && shown[active]) shown[active].scrollIntoView({block: "nearest"});
  }

  function commit() {
    paint();
    render(search.value);
    root.dispatchEvent(new Event("input", {bubbles: true}));
  }
  function remove(v) {
    current = current.filter((x) => x !== v);
    commit();
  }
  function toggle(v) {
    if (current.includes(v)) return remove(v);
    const members = expand(v);
    const add = (members ?? [v]).filter((x) => !current.includes(x));
    current = current.concat(add).slice(0, max);
    commit();
  }

  trigger.onclick = () => {
    if (panel.hidden) {
      panel.hidden = false;
      search.value = "";
      render();
      search.focus();
    } else panel.hidden = true;
  };
  search.oninput = () => { active = -1; render(search.value); };
  search.onkeydown = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); active = Math.min(active + 1, shown.length - 1); highlight(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); active = Math.max(active - 1, 0); highlight(); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) toggle(shown[active].dataset.value); }
    else if (e.key === "Escape") { e.preventDefault(); panel.hidden = true; trigger.focus(); }
    else if (e.key === "Backspace" && !search.value && current.length) remove(current[current.length - 1]);
  };
  document.addEventListener("pointerdown", (e) => {
    if (!panel.hidden && !root.contains(e.target)) panel.hidden = true;
  });

  Object.defineProperty(root, "value", {
    get: () => current.slice(),
    set: (v) => { current = (v ?? []).slice(); paint(); }
  });
  paint();
  return root;
}
