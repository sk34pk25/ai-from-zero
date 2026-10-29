import { h } from "./dom.js";
import { isOwner } from "./auth.js";
import { getRecord, setRecord, subscribe } from "./workspace.js";
import { onLeave } from "./lifecycle.js";
import { validateChecks } from "./evidence.js";

export function projectEvidence(index) {
  const host = h("section", { class: "sheet project-evidence" });
  const status = h("p", { role: "status" });
  const input = h("input", { type: "file", accept: ".json,application/json", "aria-label": "Rapport de contrôles de mon atelier", disabled: !isOwner() });
  const list = h("ol");
  const summary = h("p");
  const source = h("p", { class: "break-word" });
  const read = () => {
    const value = getRecord("preferences", {}).project;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
  const save = (project) => setRecord("preferences", { ...getRecord("preferences", {}), project });
  const paint = () => {
    const focusedLabel = document.activeElement?.getAttribute("aria-label");
    const project = read();
    let report;
    try { report = project.checks ? validateChecks(project.checks) : null; } catch { report = null; }
    const controls = new Map((report?.controles || []).map((c) => [c.tp, c.ok]));
    const explained = project.explained || {};
    summary.textContent = `${report?.reussis || 0} contrôles publics réussis · ${Array.from({ length: 12 }, (_, i) => explained[i + 1] === true).filter(Boolean).length} explications déclarées. La lecture des leçons est suivie séparément.`;
    source.textContent = report ? `Module ${report.module} · code SHA-256 ${report.source_sha256} · import ${new Date(project.importedAt).toLocaleDateString("fr")}` : "Aucun rapport importé.";
    list.replaceChildren(...Array.from({ length: 12 }, (_, i) => {
      const tp = i + 1;
      const lessons = index.lessons.filter(({ lesson }) => lesson.tpIds?.includes(tp));
      const check = h("input", { type: "checkbox", checked: explained[tp] === true, disabled: !isOwner(), "aria-label": `Je peux expliquer le TP ${tp} sur un exemple nouveau` });
      check.onchange = () => { const current = read(); save({ ...current, explained: { ...current.explained, [tp]: check.checked } }); };
      const technical = controls.has(tp) ? controls.get(tp) ? report.module === "correction" ? "référence contrôlée" : "contrôle public réussi" : "contrôle à reprendre" : "à construire";
      return h("li", {}, [h("a", { href: `#/atelier`, text: `TP ${tp}` }), ` · ${technical} · `,
        h("label", {}, [check, " Je peux l’expliquer sur un exemple nouveau"]),
        h("p", {}, lessons.flatMap(({ lesson }, n) => [n ? " · " : "Leçons : ", h("a", { href: `#/lecon/${lesson.id}`, text: lesson.id })]))]);
    }));
    if (focusedLabel) [...list.querySelectorAll("input")].find((input) => input.getAttribute("aria-label") === focusedLabel)?.focus({ preventScroll: true });
  };
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file || file.size > 2_000_000) throw new Error("Rapport absent ou trop volumineux");
      const checks = validateChecks(JSON.parse(await file.text()));
      if (!isOwner()) throw new Error("Connexion propriétaire requise");
      save({ ...read(), checks, importedAt: Date.now() });
      paint();
      status.textContent = "Rapport déclaré enregistré. Un fichier importé ne certifie ni l’exécution ni l’autonomie.";
    } catch (e) { status.textContent = e.message; }
  };
  host.append(h("h2", { text: "Mes preuves de construction" }), h("p", { text: "Importe controles.json produit avec ton module élève. Les contrôles, tes explications et la relecture finale sont trois preuves distinctes. Le mode correction contrôle la référence." }), input, status, summary, source, list,
    h("a", { href: "atelier/PROJET_FINAL.md", target: "_blank", rel: "noopener", text: "Livrables du projet final et grille de relecture /20" }));
  const unsubscribe = subscribe(paint);
  onLeave(unsubscribe);
  paint();
  return host;
}
