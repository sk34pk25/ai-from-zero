import { h } from "./dom.js";
let terms = null, serial = 0;
export async function attachTermHelp(article) {
  try {
    if (!terms) {
      const response = await fetch(new URL("data/glossary-core.json", document.baseURI));
      if (!response.ok) return;
      const rows = await response.json(); if (!Array.isArray(rows)) return; terms = rows;
    }
    if (!article.isConnected) return;
    const words = new Map();
    for (const row of terms) for (const name of [row.term, ...(row.aliases || [])]) words.set(name.toLocaleLowerCase("fr"), row);
    const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}_])(${[...words.keys()].sort((a,b) => b.length-a.length).map(escape).join("|")})(?=$|[^\\p{L}\\p{N}_])`, "giu");
    const seen = new Set();
    for (const paragraph of article.querySelectorAll(".block-intuition p, .block-explain p, .block-vocab p")) {
      if (paragraph.querySelector(".term-help") || seen.size >= 8) continue;
      const text = paragraph.textContent, nodes = []; let at = 0;
      for (const match of text.matchAll(pattern)) {
        const row = words.get(match[2].toLocaleLowerCase("fr"));
        if (seen.has(row.term) || seen.size >= 8) continue;
        const start = match.index + match[1].length, id = `term-definition-${++serial}`;
        nodes.push(text.slice(at, start));
        const definition = h("span", { id, hidden: true, class: "term-definition", role: "note", text: `${row.definition} ${row.example || ""}` });
        const button = h("button", { type: "button", class: "term-help", "aria-expanded": "false", "aria-controls": id, "aria-label": `Définition : ${match[2]}`, onClick: () => { definition.hidden = !definition.hidden; button.setAttribute("aria-expanded", String(!definition.hidden)); } }, match[2]);
        button.onkeydown = event => { if (event.key === "Escape") { definition.hidden = true; button.setAttribute("aria-expanded", "false"); } };
        nodes.push(button, definition); at = start + match[2].length; seen.add(row.term);
      }
      if (nodes.length) { nodes.push(text.slice(at)); paragraph.replaceChildren(...nodes); }
    }
  } catch { /* Le cours reste lisible sans cette aide facultative. */ }
}
