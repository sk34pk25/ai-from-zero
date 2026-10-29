import { h } from "./dom.js";
import { isOwner, selectRows } from "./auth.js";
export async function paintExperiments(main) {
  const stamp = main.dataset.paint;
  main.replaceChildren(
    h("h1", { text: "Comparer mes expériences" }),
    h("p", { text: "Chargement des mesures…" }),
  );
  const reports = [];
  for (const [name, path] of [
    ["Pré-entraînement publié", "data/gpt_run.json"],
    ["Ajustement publié", "data/finetune_run.json"],
    [
      "Atelier de référence · phrases synthétiques",
      "data/atelier_reference_run.json",
    ],
  ]) {
    try {
      const r = await fetch(new URL(path, document.baseURI));
      if (r.ok) reports.push({ name, ...(await r.json()) });
    } catch {
      /* affichage partiel */
    }
  }
  if (isOwner()) {
    try {
      for (const r of await selectRows("training_runs"))
        reports.push({
          name: r.label,
          seconds: r.seconds,
          steps: r.loss?.length,
          train_loss_start: r.loss?.[0],
          train_loss_end: r.loss?.at(-1),
          sample: r.sample,
        });
    } catch {
      /* hors connexion */
    }
  }
  if (main.dataset.paint !== stamp) return;
  const board = h("div", { class: "table-scroll" });
  const status = h("p", { role: "status" });
  const format = (v) =>
    typeof v === "number"
      ? Number(v.toFixed(4)).toLocaleString("fr")
      : "Non mesuré";
  const paint = () => {
    const table = h("table");
    table.append(
      h("caption", {
        text: "Mesures conservées ; une case vide n’est pas une valeur nulle.",
      }),
      h(
        "thead",
        {},
        h(
          "tr",
          {},
          [
            "Expérience",
            "Pas",
            "Paramètres",
            "Perte train fin",
            "Perte validation",
            "Durée (s)",
            "Données / limites",
          ].map((text) => h("th", { scope: "col", text })),
        ),
      ),
    );
    table.append(
      h(
        "tbody",
        {},
        reports.map((r) =>
          h(
            "tr",
            {},
            [
              r.name,
              format(r.steps),
              format(r.parameter_count),
              format(r.train_loss_end ?? r.full?.eval_loss_end),
              format(r.val_loss_end),
              format(r.seconds),
              r.dataset_note ||
                r.limite ||
                r.full?.evaluation ||
                r.corpus ||
                "Voir la recette du run",
            ].map((text) => h("td", { text })),
          ),
        ),
      ),
    );
    board.replaceChildren(
      table,
      ...reports.map((r) =>
        h("details", {}, [
          h("summary", { text: `Recette et résultats : ${r.name}` }),
          h("pre", {}, h("code", { text: JSON.stringify(r, null, 2) })),
        ]),
      ),
    );
  };
  const file = h("input", {
    type: "file",
    accept: ".json,application/json",
    "aria-label": "Ajouter un rapport local",
  });
  file.onchange = async () => {
    try {
      if (!file.files[0] || file.files[0].size > 5_000_000)
        throw new Error("Rapport trop volumineux");
      const x = JSON.parse(await file.files[0].text());
      if (
        !x ||
        typeof x !== "object" ||
        Array.isArray(x) ||
        !(
          "train_loss_end" in x ||
          "plan" in x ||
          "full" in x ||
          (x.format === "afz-training-plan-v1" && Array.isArray(x.items))
        )
      )
        throw new Error("Format de rapport inconnu");
      if (x.format === "afz-training-plan-v1") {
        if (
          !x.items.length ||
          x.items.some((r) => !r || typeof r !== "object" || Array.isArray(r))
        )
          throw new Error("Phases du plan invalides");
        x.items.forEach((r, i) =>
          reports.push({
            ...r,
            name: `${file.files[0].name} · phase ${i + 1} (${r.mode})`,
            train_loss_end:
              r.train_evaluation?.loss ?? r.train_loss_end ?? r.loss_end,
            val_loss_end: r.validation_loss_end ?? r.val_loss_end,
            dataset_note:
              r.evaluation ||
              "Pré-entraînement du plan ; voir les données de la recette",
          }),
        );
      } else reports.push({ ...x, name: file.files[0].name });
      paint();
      status.textContent =
        "Rapport ajouté pour cette comparaison. Le fichier reste sur ton appareil.";
    } catch (e) {
      status.textContent = e.message;
    }
  };
  main.replaceChildren(
    h("h1", { text: "Comparer mes expériences" }),
    h("p", {
      text: "Compare les données, le tokenizer et le budget avant les pertes. Les anciens runs conservent leurs limites ; ils ne sont pas présentés comme de nouvelles validations indépendantes.",
    }),
    file,
    status,
    board,
  );
  paint();
}
