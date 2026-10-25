/** Page À propos : le strict minimum demandé. */

import { h } from "./dom.js";

export function paintAbout(main) {
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "À propos" }),
    h("h1", { text: "Patrik Skala" }),
    h("p", { text: "Étudiant TSSR à l'ENI de Strasbourg." }),
    h("p", { text: "Stage du 23 novembre 2026 au 22 janvier 2027." }),
    h("p", {
      text: "AI From Zero est un parcours en français pour construire un petit modèle, du tokenizer jusqu'à un GPT entraîné dans le dépôt, avec les sources et les limites écrites à côté des résultats.",
    }),
    h("p", {}, [h("a", { href: "https://github.com/sk34pk25", text: "https://github.com/sk34pk25" })]),
  );
}
