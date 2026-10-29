/** Validation de rapports déclaratifs, sans exécuter le code qu'ils décrivent. */
const object = (x) => x && typeof x === "object" && !Array.isArray(x);
const finite = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0;
const sha = (x) => typeof x === "string" && /^[a-f0-9]{64}$/.test(x);

export function validateChecks(x) {
  if (!object(x) || x.format !== "afz-atelier-checks-v1" || !sha(x.source_sha256) || typeof x.module !== "string" || !Array.isArray(x.controles) || !x.controles.length || x.controles.length > 12)
    throw new Error("Rapport de contrôles non reconnu");
  const ids = new Set();
  for (const c of x.controles) {
    if (!object(c) || !Number.isInteger(c.tp) || c.tp < 1 || c.tp > 12 || typeof c.ok !== "boolean" || ids.has(c.tp))
      throw new Error("Contrôles invalides ou dupliqués");
    ids.add(c.tp);
  }
  if (x.total !== ids.size || x.reussis !== x.controles.filter((c) => c.ok).length)
    throw new Error("Compteurs de contrôles incohérents");
  return { format: x.format, module: x.module.slice(0, 100), source_sha256: x.source_sha256,
    total: x.total, reussis: x.reussis, controles: x.controles.map(({ tp, ok }) => ({ tp, ok })) };
}

export function normalizeReports(x, name) {
  if (!object(x)) throw new Error("Rapport JSON objet requis");
  if (x.format === "afz-training-plan-v1") {
    if (!Array.isArray(x.items) || !x.items.length || x.items.length > 100 || x.items.some((r) => !object(r) || !["pretrain", "sft"].includes(r.mode)))
      throw new Error("Phases du plan invalides");
    return x.items.map((r, i) => measured({ ...r, name: `${name} · phase ${i + 1} (${r.mode})`,
      train_loss_end: r.train_evaluation?.loss ?? r.train_loss_end ?? r.loss_end,
      val_loss_end: r.validation_loss_end ?? r.val_loss_end,
      dataset_note: r.evaluation || "Pré-entraînement du plan ; voir la provenance" }));
  }
  if (x.format === "afz-benchmark-v1") {
    if (!Array.isArray(x.runs) || !x.runs.length || x.runs.length > 100 || !Array.isArray(x.test_final))
      throw new Error("Benchmark incomplet");
    if (x.test_final.some((r) => !object(r) || !finite(r.test_loss) || !Number.isInteger(r.seed))) throw new Error("Tests du benchmark invalides");
    return x.runs.map((r) => measured({ ...r, name: `${name} · largeur ${r.width}, graine ${r.seed}`,
      test_final: r.width === x.selected_width ? x.test_final.find((t) => t.seed === r.seed) : undefined,
      dataset_note: `${x.dataset_note || x.limite || "Banc pédagogique"} · ${r.width === x.selected_width ? "largeur retenue sur validation" : "variante comparée sur validation"}` }));
  }
  if (x.format === "afz-modern-benchmark-v1") {
    if (!Array.isArray(x.runs) || !x.runs.length || x.runs.length > 100 || !["absolute", "rope"].includes(x.selected_position) || !Array.isArray(x.test_final)) throw new Error("Benchmark moderne incomplet");
    if (x.test_final.some(r => !object(r) || !finite(r.loss) || !Number.isInteger(r.seed))) throw new Error("Tests documentaires invalides");
    const pairs = new Set();
    return x.runs.map(r => {
      if (!object(r) || !["absolute", "rope"].includes(r.position) || !Number.isInteger(r.seed) || pairs.has(r.position + "/" + r.seed)) throw new Error("Runs modernes invalides");
      pairs.add(r.position + "/" + r.seed);
      const test = r.position === x.selected_position ? x.test_final.find(t => t.seed === r.seed) : undefined;
      return measured({ ...r, name: `${name} · ${r.position}, graine ${r.seed}`, test_loss: test?.loss, test_final: test,
        dataset_note: `${x.limite || "Livres réservés"} · ${test ? "test après sélection" : "validation seulement"}` });
    });
  }
  if (x.format === "afz-atelier-test-v1") {
    if (!finite(x.test_loss) || !sha(x.checkpoint_sha256) || typeof x.test_independent !== "boolean")
      throw new Error("Évaluation finale invalide");
    return [{ ...x, name, dataset_note: `${x.provenance_status} · loss test ${x.test_loss}` }];
  }
  if (x.format === "afz-questions-eval-v1") {
    if (!finite(x.exact_match_rate) || x.exact_match_rate > 1 || !["validation", "test"].includes(x.split) || !sha(x.checkpoint_sha256)) throw new Error("Diagnostic de questions invalide");
    return [measured({ ...x, name, val_loss_end: x.split === "validation" ? x.loss?.loss : undefined,
      test_loss: x.split === "test" ? x.loss?.loss : undefined,
      dataset_note: `${x.provenance_status} · exact-match lexical ${Math.round(100 * x.exact_match_rate)} % ; réponses à relire` })];
  }
  if (x.format && x.format !== "afz-atelier-run-v1")
    throw new Error("Format de rapport inconnu");
  if (!finite(x.train_loss_end) && !(object(x.full) && finite(x.full.eval_loss_end)))
    throw new Error("Mesures d’entraînement manquantes");
  return [measured({ ...x, name })];
}

function measured(x) {
  for (const key of ["steps", "parameter_count", "train_loss_end", "val_loss_end", "seconds", "validation_loss_end"])
    if (x[key] != null && !finite(x[key])) throw new Error(`Mesure invalide : ${key}`);
  if (x.code_sha256 != null && !sha(x.code_sha256)) throw new Error("Empreinte du code invalide");
  return x;
}
