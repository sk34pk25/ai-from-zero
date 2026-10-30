import { h } from "./dom.js";

export function pathChoice(index) {
  const select = h("select", { "aria-label": "Mon parcours" }, [
    h("option", { value: "core", text: "Mon premier GPT · 84 leçons" }),
    h("option", { value: "all", text: "Tous les niveaux dans l’ordre numérique" }),
  ]);
  select.value = index.path;
  if (index.focusPathChoice) {
    index.focusPathChoice = false;
    queueMicrotask(() => { if (select.isConnected) select.focus({ preventScroll: true }); });
  }
  const status = h("p", { role: "status", text: "Ce choix règle Continuer et les séances. Le premier GPT se termine par le bilan du projet ; les 77 explorations restent accessibles séparément. Les leçons cochées sont conservées." });
  select.onchange = () => {
    try { localStorage.setItem("afz-learning-path", select.value); } catch { /* préférence pour cette session */ }
    window.dispatchEvent(new CustomEvent("afz-path-change", { detail: select.value }));
  };
  return h("section", { class: "sheet" }, [h("h2", { text: "Mon parcours" }), select, status]);
}
