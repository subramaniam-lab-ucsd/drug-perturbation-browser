/**
 * One glyph per tissue of origin, and a few for the interface.
 *
 * Emoji rather than inline SVG: these appear inside option labels and table
 * cells that are plain text, so a glyph travels where markup cannot. The map
 * is deliberately small and falls back to a neutral dot, because a wrong organ
 * picture is worse than none.
 */
// Organ glyphs, grouped by system rather than one per organ.
//
// Emoji were the obvious choice and are the wrong one: the lung, kidney and
// intestine characters are recent additions and simply do not render on many
// systems, including the headless Chrome these pages are tested in, where they
// came out blank. These are inline paths, so they render everywhere, and they
// key to the body system because eight recognisable shapes are worth more than
// twenty-four unrecognisable ones.
const SYSTEM = {
  respiratory: "M8 3v5M8 8c0 3-2 5-4 5-1 0-1.5-.6-1.5-1.5C2.5 9 4 6.5 6 5.5M8 8c0 3 2 5 4 5 1 0 1.5-.6 1.5-1.5C13.5 9 12 6.5 10 5.5",
  digestive: "M5 2.5v3c0 2 5 2 5 4.5s-3 1.5-3 3.5M11 3.5h2v9",
  nervous: "M4.5 8a3.5 3.5 0 017 0 3.5 3.5 0 01-7 0M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2",
  skin: "M2.5 5.5h11M2.5 8.5h11M2.5 11.5h11",
  urinary: "M9.5 3c-3 0-5 2.2-5 5s2 5 5 5c1.2 0 1.8-.8 1.3-1.7-.9-1.6-.9-5 0-6.6C11.3 3.8 10.7 3 9.5 3z",
  reproductive: "M4 3.5c0 4 1.5 6 4 6s4-2 4-6M8 9.5v3M6 12.5h4",
  blood: "M8 2.5s4 4.5 4 7a4 4 0 01-8 0c0-2.5 4-7 4-7z",
  lymphoid: "M8 2.5l4.5 2.6v5.8L8 13.5 3.5 10.9V5.1z",
  other: "M8 5.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z"
};

const OF = {
  "Lung": "respiratory",
  "Bowel": "digestive", "Esophagus/Stomach": "digestive", "Liver": "digestive",
  "Pancreas": "digestive", "Biliary Tract": "digestive", "Ampulla of Vater": "digestive",
  "CNS/Brain": "nervous", "Peripheral Nervous System": "nervous", "Eye": "nervous",
  "Skin": "skin", "Soft Tissue": "skin",
  "Kidney": "urinary", "Bladder/Urinary Tract": "urinary",
  "Uterus": "reproductive", "Ovary/Fallopian Tube": "reproductive",
  "Cervix": "reproductive", "Prostate": "reproductive", "Breast": "reproductive",
  "Lymphoid": "lymphoid", "Myeloid": "blood",
  "Head and Neck": "other", "Thyroid": "other", "Bone": "other"
};

export const organSystem = (o) => OF[o] ?? "other";

/**
 * Inline SVG icons, returned as DOM nodes.
 *
 * htl escapes an interpolated string, so a markup string would print its own
 * angle brackets. Building the element is the only way to get it into a
 * template without an unsafe-HTML escape hatch.
 */
const NS = "http://www.w3.org/2000/svg";
function icon(d, {size = 14} = {}) {
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "ico");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", d);
  svg.appendChild(path);
  return svg;
}

/** The glyph for an organ's body system, as a DOM node. */
export function organIcon(organ, o) {
  const el = icon(SYSTEM[organSystem(organ)], o);
  el.setAttribute("class", "ico ico-organ");
  // aria-label, not a <title> child: a <title> counts towards the element's
  // textContent, so a label containing the glyph read "PancreasMIA PaCa-2".
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", organ);
  el.removeAttribute("aria-hidden");
  return el;
}

/** A pencil, for the control that reopens the query form. */
export const pencil = (o) => icon("M11.5 2.5l2 2L6 12l-3 1 1-3 7.5-7.5z", o);
/** A right chevron, for links that go somewhere. */
export const arrow = (o) => icon("M6 3.5L10.5 8 6 12.5", o);
