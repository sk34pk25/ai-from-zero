import { h } from "./dom.js";
import { onLeave } from "./lifecycle.js";
import { publicAssetUrl } from "./public-url.js";
let glossary = null;
export async function paintGlossaryPage(main) {
  const ticket = new AbortController(); onLeave(() => ticket.abort());
  const status = h("p", { role: "status" }, "Chargement des définitions…");
  main.replaceChildren(h("h1", { text: "Glossaire du laboratoire" }), status);
  try {
    if (!glossary) {
      const response = await fetch(publicAssetUrl("data/glossary.json"), { signal: ticket.signal });
      if (!response.ok) throw new Error("Glossaire indisponible");
      const rows = await response.json();
      if (!Array.isArray(rows)) throw new Error("Glossaire invalide");
      glossary = rows;
    }
    if (ticket.signal.aborted) return;
    const input = h("input", { type: "search", "aria-label": "Rechercher un terme", placeholder: "Gradient, token, attention…" });
    const list = h("div", { class: "glossary-list" });
    const fold = text => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
    let limit = 30;
    const more = h("button", { type: "button", class: "button button-secondary", onClick: () => { limit += 30; paint(); } }, "Afficher 30 définitions de plus");
    const paint = () => {
      const query = fold(input.value);
      const rows = glossary.filter(row => fold([row.term, row.english || "", ...(row.aliases || []), row.definition].join(" ")).includes(query))
        .sort((a, b) => query ? a.term.localeCompare(b.term, "fr") : Number(!!b.common) - Number(!!a.common) || a.term.localeCompare(b.term, "fr"));
      status.textContent = `${rows.length} terme(s) · ${Math.min(limit, rows.length)} affiché(s). Les usages d’une même notion sont regroupés.`;
      list.replaceChildren(...rows.slice(0, limit).map(row => h("article", { class: "sheet" }, [
        h("h2", { text: row.term }), row.english ? h("p", { class: "muted", text: `Anglais : ${row.english}` }) : null,
        h("p", { text: row.definition }), row.example ? h("p", { class: "term-example", text: `Exemple : ${row.example}` }) : null,
        row.contexts?.length ? h("details", {}, [h("summary", { text: `Retrouver les ${row.contexts.length} contexte(s) du cours` }),
          ...row.contexts.map(context => h("p", {}, [h("a", { href: `#/lecon/${context.lesson}`, text: `Leçon ${context.lesson}` }), ` · ${context.definition}`]))]) : null,
      ])));
      more.hidden = rows.length <= limit;
    };
    input.oninput = () => { limit = 30; paint(); };
    main.append(h("p", { text: "Une définition commune, un exemple, puis les nuances dans leurs leçons. Recherche aussi par terme anglais." }), input, list, more); paint();
  } catch (error) {
    if (error.name !== "AbortError") {
      status.textContent = "Les définitions n’ont pas pu être chargées.";
      main.append(h("button", { type: "button", onClick: () => void paintGlossaryPage(main) }, "Réessayer le glossaire"));
    }
  }
}
