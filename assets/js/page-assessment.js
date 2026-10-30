import { h } from "./dom.js";
import { onLeave } from "./lifecycle.js";
import { publicAssetUrl } from "./public-url.js";
import { ASSET_VERSION } from "./version.js";
import { studyScope } from "./study-scope.js";
import { request, stopWorker } from "./pybridge.js";
import { codeFingerprint, exerciseState, EXERCISE_LABELS } from "./exercise-result.js";
import { ASSISTANCE, activeMilliseconds, validateAssessmentFile } from "./assessment.js";

export async function paintAssessment(main) {
  let active = true, running = false, ticket = 0;
  onLeave(() => { active = false; ticket++; if (running) stopWorker(); });
  main.replaceChildren(h("h1", { text: "Mes preuves de compréhension" }), h("p", { role: "status", text: "Chargement des épreuves…" }));
  let catalog, capabilities;
  try {
    const responses = await Promise.all([fetch(publicAssetUrl("data/transfer-tasks.json")), fetch(publicAssetUrl("data/capabilities.json"))]);
    if (responses.some(response => !response.ok)) throw new Error("Catalogue indisponible");
    [catalog, capabilities] = await Promise.all(responses.map(response => response.json()));
  } catch {
    if (active) main.replaceChildren(h("h1", { text: "Épreuves indisponibles" }), h("p", { role: "status", text: "Le catalogue n’a pas pu être chargé." }), h("button", { type: "button", onClick: () => { if (active) void paintAssessment(main); } }, "Réessayer les épreuves"));
    return;
  }
  if (!active) return;
  const scope = studyScope();
  const read = () => {
    try { return validateAssessmentFile(scope.get("preferences").comprehension || { format: "afz-comprehension-v1", attempts: [] }, catalog.tasks, { imported: false }); }
    catch { return { format: "afz-comprehension-v1", attempts: [] }; }
  };
  // origin reste « imported » pour les fichiers importés ; aucun import n’exécute du code.
  const status = h("p", { role: "status", class: "quiz-feedback" });
  const save = file => {
    if (!scope.set("preferences", { ...scope.get("preferences"), comprehension: file })) { status.textContent = "Non enregistré : le suivi a été effacé ou le stockage est refusé. Exporte ou copie ton travail avant de fermer."; return false; }
    return true;
  };
  const pick = h("select", { "aria-label": "Palier de compréhension" });
  for (const task of catalog.tasks.filter(task => task.variant === "A")) pick.append(h("option", { value: task.stage, text: task.title }));
  const variant = h("select", { "aria-label": "Variante de l’épreuve" }, [h("option", { value: "A", text: "Variante A" }), h("option", { value: "B", text: "Variante B, autre diagnostic" })]);
  const alias = h("input", { type: "text", maxlength: 100, "aria-label": "Alias de l’apprenant", placeholder: "Alias facultatif, sans nom réel" });
  const device = h("input", { type: "text", maxlength: 300, "aria-label": "Appareil et navigateur", placeholder: "Ex. tablette, Safari, version…" });
  const instructions = h("div"), workspace = h("section", { class: "sheet assessment-workspace" }), history = h("section", { class: "sheet" });
  const task = () => catalog.tasks.find(row => row.stage === pick.value && row.variant === variant.value);
  let selectedId = null;
  const current = () => read().attempts.find(row => row.id === selectedId);
  const update = (patch, id = selectedId) => {
    if (!active) return false;
    const file = read(), index = file.attempts.findIndex(row => row.id === id);
    if (index < 0) return false;
    file.attempts[index] = { ...file.attempts[index], ...patch };
    return save(file);
  };
  const ended = row => ["finish", "abandon"].includes(row.events.at(-1)?.type);
  const live = row => ["start", "resume"].includes(row.events.at(-1)?.type);
  const repaintHistory = () => {
    const rows = read().attempts;
    history.replaceChildren(h("h2", { text: "Tentatives conservées" }), h("p", { text: rows.length ? `${rows.length} tentative(s). Résultats et relectures sont déclaratifs ; les fichiers importés restent identifiés.` : "Aucune tentative réalisée. Aucun résultat humain n’est prérempli." }), ...rows.slice().reverse().map(row => h("button", { type: "button", class: "assessment-history-link", onClick: () => {
      if (running) return;
      const selected = catalog.tasks.find(task => task.id === row.taskId);
      pick.value = selected.stage; variant.value = selected.variant; selectedId = row.id; paint();
    } }, `${row.taskId} · ${new Date(row.events[0].at).toLocaleString("fr")} · ${ended(row) ? "terminée" : "en cours"}${row.origin === "imported" ? " · importée" : ""}`)));
  };
  const start = h("button", { type: "button", class: "button button-primary", onClick: () => {
    if (running) return;
    const file = read(), value = task();
    if (file.attempts.length >= 100) { status.textContent = "100 tentatives conservées : exporte ton dossier avant de commencer une nouvelle série."; return; }
    if (file.attempts.some(row => row.taskId === value.id && !ended(row))) { status.textContent = "Reprends la tentative en cours depuis l’historique, ou termine-la avant d’en commencer une autre."; return; }
    const row = { id: crypto.randomUUID(), taskId: value.id, taskVersion: value.validatorVersion, siteVersion: ASSET_VERSION, alias: alias.value.trim(), device: device.value.trim(), code: value.starter, diagnosis: "", explanation: "", events: [{ type: "start", at: Date.now() }], assistance: [], revealed: [], checks: [], origin: "local" };
    if (save({ ...file, attempts: [...file.attempts, row] })) { selectedId = row.id; status.textContent = "Tentative démarrée. Essaie d’abord sans cours ni corrigé ; déclare ensuite les aides réellement utilisées."; paint(); }
  } }, "Démarrer une tentative");
  const download = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ ...read(), siteVersion: ASSET_VERSION, catalogVersion: catalog.version, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" }));
    h("a", { href: url, download: "preuves-de-comprehension.json" }).click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const input = h("input", { type: "file", accept: ".json,application/json", "aria-label": "Dossier de compréhension à importer" });
  input.onchange = async () => {
    try {
      const file = input.files[0]; if (!file || file.size > 10_000_000) throw new Error("Fichier absent ou trop volumineux");
      const imported = validateAssessmentFile(JSON.parse(await file.text()), catalog.tasks);
      if (!active) return;
      const before = read(), ids = new Set(before.attempts.map(row => row.id));
      const additions = imported.attempts.filter(row => !ids.has(row.id));
      if (before.attempts.length + additions.length > 100) throw new Error("Le dossier fusionné dépasserait 100 tentatives");
      if (save({ ...before, attempts: [...before.attempts, ...additions] })) { status.textContent = `${additions.length} tentative(s) importée(s), sans exécution et sans remplacer les tentatives présentes.`; repaintHistory(); }
    } catch (error) { if (active) status.textContent = error.message; }
  };
  const paint = () => {
    const value = task(), row = current();
    instructions.replaceChildren(h("h2", { text: `${value.title} · variante ${value.variant}` }), h("p", { text: value.prompt }), h("p", { text: "Avant d’exécuter : prédis un résultat, note le défaut et le test qui permettrait de le détecter." }), h("p", {}, ["Si tu bloques : ", ...value.lessons.flatMap((id, i) => [i ? " · " : "", h("a", { href: `#/lecon/${id}`, text: id })])]), h("p", { text: value.explain }));
    workspace.replaceChildren();
    pick.disabled = variant.disabled = start.disabled = running;
    if (!row) { workspace.append(h("p", { text: "Démarre une tentative pour écrire ton programme et chronométrer le travail. Tu peux interrompre l’essai sans le réussir." })); repaintHistory(); return; }
    const locked = ended(row) || !live(row);
    const code = h("textarea", { class: "ide-fallback", rows: 12, maxlength: 100000, "aria-label": "Code du cas nouveau", readonly: locked }); code.value = row.code;
    const diagnosis = h("textarea", { rows: 4, maxlength: 20000, "aria-label": "Diagnostic et contre-exemple", readonly: locked }); diagnosis.value = row.diagnosis;
    const explanation = h("textarea", { rows: 5, maxlength: 20000, "aria-label": "Explication sur le cas nouveau", readonly: locked }); explanation.value = row.explanation;
    const validity = h("p", { role: "status", "data-transfer-result": value.id });
    let validityTicket = 0;
    const refresh = async () => {
      const n = ++validityTicket, source = code.value, hash = await codeFingerprint(source);
      if (!active || n !== validityTicket || current()?.id !== row.id) return;
      const check = current()?.checks.at(-1);
      validity.textContent = EXERCISE_LABELS[exerciseState(check, hash, value.validatorVersion)] + (check ? " · L’explication et l’autonomie restent à relire." : " · Aucun contrôle lancé.");
    };
    code.oninput = () => { if (update({ code: code.value })) { validity.textContent = "Code modifié : contrôle à relancer."; void refresh(); } };
    diagnosis.oninput = () => update({ diagnosis: diagnosis.value }); explanation.oninput = () => update({ explanation: explanation.value });
    const assistance = h("fieldset", {}, h("legend", { text: "Aides réellement utilisées pendant cette tentative" }));
    for (const help of ASSISTANCE) {
      const check = h("input", { type: "checkbox", checked: row.assistance.includes(help), disabled: locked || row.revealed.includes(help) });
      check.onchange = () => { const prior = current().assistance; update({ assistance: check.checked ? [...new Set([...prior, help])] : prior.filter(value => value !== help) }); };
      assistance.append(h("label", { class: "checkpoint-criterion" }, [check, help]));
    }
    const reveal = (help, text) => h("button", { type: "button", disabled: locked, onClick: () => {
      const prior = current(); if (!update({ assistance: [...new Set([...prior.assistance, help])], revealed: [...new Set([...prior.revealed, help])] })) return;
      const details = h("pre", { class: "assessment-help" }, h("code", { text })); workspace.append(details); paintAssistance();
    } }, help === "indice" ? "Demander un indice" : "Afficher le corrigé (aide déclarée)");
    const paintAssistance = () => [...assistance.querySelectorAll("input")].forEach((input, i) => { input.checked = current().assistance.includes(ASSISTANCE[i]); input.disabled = locked || current().revealed.includes(ASSISTANCE[i]); });
    const run = h("button", { type: "button", class: "button button-primary", disabled: locked, onClick: async () => {
      if (running) return;
      const attemptId = row.id, source = code.value, checks = current().checks;
      if (checks.length >= 100) { status.textContent = "100 contrôles conservés pour cette tentative. Termine-la et commence une nouvelle tentative."; return; }
      const generation = ++ticket; running = true; run.disabled = true; pick.disabled = variant.disabled = start.disabled = true;
      validity.textContent = "Chargement de Python puis contrôle du code…";
      try {
        const codeHash = await codeFingerprint(source);
        const result = await request({ type: "exercise", code: `${source}\n${value.check}` });
        if (!active || generation !== ticket || current()?.id !== attemptId) return;
        if (result.cancelled || result.busy) { validity.textContent = result.busy ? "Python est occupé. Relance le contrôle après le calcul en cours." : "Contrôle interrompu ; ton travail est conservé."; return; }
        if (["loading", "dependencies"].includes(result.phase)) { validity.textContent = `Python n’a pas pu être chargé. ${result.text || "Vérifie la connexion."} Relance le contrôle ; ton code n’a pas encore été évalué.`; return; }
        const latest = current();
        if (codeHash && update({ checks: [...latest.checks, { ok: result.type !== "error", codeHash, validatorVersion: value.validatorVersion, checkedAt: Date.now(), assistance: [...latest.assistance] }] })) {
          await refresh();
          if (result.type === "error") validity.append(document.createTextNode(` ${result.text || "Vérifie ton contre-exemple."}`));
        }
      } catch (error) { if (active) validity.textContent = `${error.message}. Ton travail est conservé.`; }
      finally { if (active && generation === ticket) { running = false; run.disabled = locked; pick.disabled = variant.disabled = start.disabled = false; } }
    } }, "Contrôler le cas nouveau");
    const clock = h("p", { class: "muted", text: `${Math.round(activeMilliseconds(row.events) / 1000)} s actives au dernier affichage · ${ended(row) ? "tentative terminée" : live(row) ? "chronomètre en cours" : "en pause"}. Les temps et aides sont déclaratifs.` });
    const transition = (type) => {
      const r = current();
      if (r.events.length >= 499 && !["finish", "abandon"].includes(type)) { status.textContent = "Termine cette tentative avant d’ajouter une nouvelle pause."; return; }
      if (running) { ticket++; stopWorker(); running = false; }
      if (update({ events: [...r.events, { type, at: Date.now() }] })) paint();
    };
    workspace.append(h("h2", { text: "Ma tentative" }), clock, h("label", {}, ["Programme reconstruit et corrigé", code]), h("label", {}, ["Défaut, hypothèse et contre-exemple", diagnosis]), h("label", {}, ["Prédiction, résultat observé et limite", explanation]), assistance, reveal("indice", value.hint), reveal("corrigé", value.solution), run,
      h("button", { type: "button", disabled: locked, onClick: () => { ticket++; if (running) stopWorker(); running = false; pick.disabled = variant.disabled = start.disabled = false; run.disabled = false; validity.textContent = "Contrôle arrêté ; code conservé."; } }, "Arrêter Python"), validity);
    if (!ended(row)) workspace.append(
      h("button", { type: "button", onClick: () => transition(live(current()) ? "pause" : "resume") }, live(row) ? "Mettre en pause" : "Reprendre le chronomètre"),
      h("button", { type: "button", onClick: () => transition("finish") }, "Terminer et garder cette tentative"),
      h("button", { type: "button", onClick: () => transition("abandon") }, "Conserver un abandon"));
    else workspace.append(reviewForm(row, update, status));
    if (row.checks.length) workspace.append(h("details", {}, [h("summary", { text: "Historique des contrôles et aides" }), h("ol", {}, row.checks.map(check => h("li", { text: `${new Date(check.checkedAt).toLocaleString("fr")} · ${check.ok ? "réussi" : "échoué"} · code ${check.codeHash.slice(0, 8)} · aides : ${check.assistance.join(", ") || "aucune déclarée"}` })))]));
    if (row.origin === "imported") workspace.append(h("p", { text: "Tentative importée : ces déclarations n’ont pas été observées par le site." }));
    void refresh(); repaintHistory();
  };
  const choose = () => { if (running) return; selectedId = read().attempts.findLast(row => row.taskId === task().id && !ended(row))?.id || null; paint(); };
  pick.onchange = variant.onchange = choose;
  const matrix = h("section", { class: "sheet" }, [h("h2", { text: "Ce que le dépôt permet réellement" }), ...capabilities.map(row => h("details", {}, [h("summary", { text: `${row.title} · ${row.status}` }), h("p", { text: row.limit }), h("p", { text: `Code : ${row.source}. Tests : ${row.tests.join(", ") || "aucun module exécutable revendiqué"}.` })]))]);
  main.replaceChildren(h("h1", { text: "Mes preuves de compréhension" }), h("p", { class: "lead", text: "Reconstruire, diagnostiquer, expliquer. Cinq paliers, deux variantes et des cas différents du cours. Un contrôle passé ne remplace ni l’explication ni une observation humaine." }),
    h("p", { text: scope.message }), h("a", { href: "atelier/RELECTURE.md", target: "_blank", rel: "noopener", text: "Protocole pour observer de vrais débutants" }),
    h("section", { class: "sheet assessment-selector" }, [h("label", {}, ["Palier", pick]), h("label", {}, ["Variante", variant]), h("label", {}, ["Alias facultatif", alias]), h("label", {}, ["Appareil et navigateur facultatifs", device]), instructions, start]), workspace, status, history,
    h("section", { class: "sheet" }, [h("h2", { text: "Exporter ou reprendre mon dossier" }), h("p", { text: `${scope.owner ? "Compte propriétaire : synchronisation privée active. Pour un essai sans envoi, utilise une session visiteur." : "Aucun envoi automatique."} L’export contient ton code, tes textes et les déclarations d’aides et de relecture. Partage-le seulement avec l’accord des personnes concernées.` }), h("button", { type: "button", onClick: download }, "Exporter mes preuves de compréhension"), input]), matrix, h("a", { href: "#/espace", text: "Retour à mon espace" }));
  choose();
}

function reviewForm(row, update, status) {
  const review = row.review;
  const type = h("select", { "aria-label": "Type de relecture" }, [h("option", { value: "", text: "Non évaluée" }), h("option", { value: "self", text: "Autoévaluation déclarée" }), h("option", { value: "observer", text: "Observation par un tiers déclarée" })]); type.value = review?.type || "";
  const by = h("input", { type: "text", maxlength: 100, "aria-label": "Alias de la personne qui relit" }); by.value = review?.by || "";
  const evidence = h("textarea", { rows: 4, maxlength: 20000, "aria-label": "Faits observés justifiant la relecture" }); evidence.value = review?.evidence || "";
  const axes = ["Reconstruire : absent / avec aide / seul sur un cas nouveau", "Diagnostiquer : absent / défaut nommé / hypothèse et contre-test", "Expliquer : absent / description / prédiction et limite vérifiées"];
  const selects = axes.map((axis, i) => { const select = h("select", { "aria-label": axis }, [h("option", { value: "", text: "Non évalué" }), ...[0, 1, 2].map(score => h("option", { value: score, text: String(score) }))]); select.value = review?.scores[i] == null ? "" : String(review.scores[i]); return select; });
  return h("fieldset", { class: "assessment-review" }, [h("legend", { text: "Relecture humaine, à renseigner après l’essai" }), h("p", { text: "Chaque axe vaut 0, 1 ou 2 selon les critères indiqués. Aucun score n’est calculé automatiquement. Une observation par un tiers exige une personne présente et des faits précis." }), h("label", {}, ["Type", type]), h("label", {}, ["Alias de la personne qui relit", by]), ...selects.map((select, i) => h("label", {}, [axes[i], select])), h("label", {}, ["Faits, blocages, aides et contre-exemple vérifié", evidence]), h("button", { type: "button", onClick: async () => {
    if (!type.value || selects.some(select => select.value === "") || !evidence.value.trim() || (type.value === "observer" && !by.value.trim())) { status.textContent = "Renseigne le type, les trois axes et les faits observés ; un tiers doit fournir son alias."; return; }
    const contentHash = await codeFingerprint(JSON.stringify([row.code, row.diagnosis, row.explanation]));
    if (contentHash && update({ review: { type: type.value, by: by.value.trim(), scores: selects.map(select => Number(select.value)), evidence: evidence.value.trim(), contentHash } }, row.id)) status.textContent = "Relecture déclarée enregistrée. Elle ne constitue pas une certification du site.";
  } }, "Enregistrer la relecture déclarée")]);
}
