/** Mon modèle : les briques de l'architecture s'allument quand leur étape est cochée. */
import { crumb, h } from "./dom.js";

export function paintModel(main, { architecture, done, selectedPart, onSelect }) {
  const parts = architecture;
  const selected =
    parts.find((part) => part.id === selectedPart) ?? parts[0];
  const list = h("div", { class: "pipeline", role: "list" });
  for (const part of parts) {
    const unlocked = done.has(part.step);
    const pressed = selected?.id === part.id;
    const button = h(
      "button",
      {
        type: "button",
        class: `component${unlocked ? " is-on" : ""}${pressed ? " is-selected" : ""}`,
        "aria-pressed": pressed ? "true" : "false",
        onClick: () => onSelect(part.id),
      },
      [
        h("span", {
          class: "eyebrow",
          text: unlocked ? "Acquis" : "Verrouillé",
        }),
        h("strong", { text: part.name }),
        h("span", { text: `Étape ${part.step}` }),
      ],
    );
    list.append(h("div", { role: "listitem" }, [button]));
  }
  const detail = h(
    "section",
    { class: "component-info", "aria-live": "polite" },
    [
      h("p", { class: "eyebrow", text: "Inspecteur" }),
      h("h2", { text: selected ? selected.name : "Composant" }),
      h("p", { text: selected ? selected.summary : "" }),
      selected
        ? h("p", {}, [
            "Introduit à l'étape ",
            h("a", { href: `#/lecon/${selected.step}`, text: selected.step }),
            done.has(selected.step)
              ? ". Cette brique est débloquée."
              : ". Termine cette étape pour la débloquer.",
          ])
        : null,
      h("p", {
        text: "Le code de référence est dans le dossier model/ du dépôt, couvert par pytest.",
      }),
    ],
  );
  const numeric = h("div", { class: "visual-host", "data-architecture-lab": "true" });
  const openNumeric = h("button", { type: "button", class: "button button-secondary", onClick: async () => {
    openNumeric.disabled = true;
    try { const { mountArchitectureLab } = await import("./visual-labs.js"); mountArchitectureLab(numeric); }
    catch { numeric.textContent = "Le trajet numérique n’a pas pu être chargé. Réessaie."; openNumeric.disabled = false; }
  } }, "Ouvrir le trajet numérique");
  main.replaceChildren(
    crumb([{ href: "#/", label: "Accueil" }, { label: "Mon modèle" }]),
    h("p", { class: "eyebrow", text: "Fil rouge" }),
    h("h1", { text: "Architecture évolutive" }),
    h("p", {
      class: "lead",
      text: "Les briques se débloquent quand l'étape qui les introduit est terminée. Le code correspondant est dans le dossier model/.",
    }),
    h("div", { class: "model-shell" }, [list, detail]),
    h("section", { class: "visual" }, [h("h2", { text: "Inspecter les calculs d’un exemple" }), h("p", { text: "Un trajet miniature avec des valeurs choisies pour lire les formes. Les briques cochées restent des repères de progression ; cet exemple ne prouve pas que ton modèle est entraîné." }), openNumeric, numeric]),
  );
}
