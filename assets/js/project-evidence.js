import { h } from "./dom.js";
import { onLeave } from "./lifecycle.js";
import { validateChecks } from "./evidence.js";
import { studyScope } from "./study-scope.js";

export function projectEvidence(index) {
  const scope = studyScope();
  const host = h("section", { class: "sheet project-evidence" });
  const status = h("p", { role: "status" });
  const input = h("input", { type: "file", accept: ".json,application/json", "aria-label": "Rapport de contrôles de mon atelier" });
  const list = h("ol");
  const summary = h("p");
  const source = h("p", { class: "break-word" });
  const read = () => {
    const value = scope.get("preferences", {}).project;
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  };
  const save = (project) => scope.set("preferences", { ...scope.get("preferences", {}), project });
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
      const check = h("input", { type: "checkbox", checked: explained[tp] === true, "aria-label": `Je peux expliquer le TP ${tp} sur un exemple nouveau` });
      check.onchange = () => {
        const current = read();
        if (save({ ...current, explained: { ...current.explained, [tp]: check.checked } })) paint();
        else { check.checked = current.explained?.[tp] === true; status.textContent = "Preuve non enregistrée : le suivi a été effacé ou le stockage est refusé."; }
      };
      const technical = controls.has(tp) ? controls.get(tp) ? report.module === "correction" ? "référence contrôlée" : "contrôle public réussi" : "contrôle à reprendre" : "à construire";
      return h("li", {}, [h("a", { href: `#/atelier/tp/${tp}`, text: `TP ${tp}` }), ` · ${technical} · `,
        h("label", {}, [check, " Je peux l’expliquer sur un exemple nouveau"]),
        h("p", {}, lessons.flatMap(({ lesson }, n) => [n ? " · " : "Leçons : ", h("a", { href: `#/lecon/${lesson.id}`, text: lesson.id })]))]);
    }));
    if (focusedLabel) [...list.querySelectorAll("input")].find((input) => input.getAttribute("aria-label") === focusedLabel)?.focus({ preventScroll: true });
  };
  input.onchange = async () => {
    try {
      const file = input.files[0];
      if (!file || file.size > 2_000_000) throw new Error("Rapport absent ou trop volumineux");
      const raw = JSON.parse(await file.text());
      let project;
      if (raw.format === "afz-personal-project-v1") {
        const p = raw.project;
        if (!p || typeof p !== "object" || Array.isArray(p)) throw new Error("Dossier invalide");
        const explained = Object.fromEntries(Object.entries(p.explained || {}).filter(([key, value]) => /^(?:[1-9]|1[0-2])$/.test(key) && typeof value === "boolean"));
        project = { explained, ...(p.checks ? { checks: validateChecks(p.checks) } : {}), importedAt: Date.now() };
      } else project = { ...read(), checks: validateChecks(raw), importedAt: Date.now() };
      if (!save(project)) throw new Error("Le suivi a été effacé ou le stockage est refusé. Copie ton rapport avant de fermer.");
      paint();
      status.textContent = "Rapport déclaré enregistré. Un fichier importé ne certifie ni l’exécution ni l’autonomie.";
    } catch (e) { status.textContent = e.message; }
  };
  const exportProject = h("button", { type: "button", class: "button button-secondary", onClick: () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ format: "afz-personal-project-v1", project: read() }, null, 2)], { type: "application/json" }));
    const a = h("a", { href: url, download: "mon-projet-gpt.json" }); a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, "Exporter mon dossier de preuves");
  host.append(h("h2", { text: "Mes preuves de construction" }), h("p", { text: "Importe controles.json produit avec ton module élève. Les contrôles, tes explications et la relecture finale sont trois preuves distinctes. Le mode correction contrôle la référence." }), h("p", { class: "muted", text: scope.message }), input, status, summary, source, list, exportProject,
    h("a", { href: "atelier/PROJET_FINAL.md", target: "_blank", rel: "noopener", text: "Livrables du projet final et grille de relecture /20" }));
  const unsubscribe = scope.subscribe(paint);
  onLeave(unsubscribe);
  paint();
  return host;
}
