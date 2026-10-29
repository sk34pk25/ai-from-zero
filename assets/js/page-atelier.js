/** Atelier public téléchargeable, sans poids ni dépendance à une session. */
import { h } from "./dom.js";
import { zipStore } from "./zipstore.js";
import { onLeave } from "./lifecycle.js";
import { pathChoice } from "./path-choice.js";

export async function paintAtelier(main, index) {
  const controller = new AbortController();
  onLeave(() => controller.abort());
  const response = await fetch(new URL("data/atelier.json", document.baseURI), {
    signal: controller.signal,
  });
  if (!response.ok) throw new Error("Atelier indisponible");
  const spec = await response.json();
  const status = h("p", { role: "status" });
  const download = h(
    "button",
    {
      type: "button",
      class: "button button-primary",
      onClick: async () => {
        download.disabled = true;
        status.textContent = "Préparation du projet…";
        try {
          const files = [];
          for (const path of spec.files) {
            if (
              !/^atelier\/[a-zA-Z0-9_./-]+$/.test(path) ||
              path.includes("..")
            )
              throw new Error("Chemin invalide");
            const r = await fetch(new URL(path, document.baseURI), {
              signal: controller.signal,
            });
            if (!r.ok) throw new Error("Fichier manquant");
            files.push({
              name: `mon-llm/${path.slice("atelier/".length)}`,
              data: new Uint8Array(await r.arrayBuffer()),
            });
          }
          const url = URL.createObjectURL(zipStore(files));
          const a = h("a", {
            href: url,
            download: "mon-llm.zip",
            hidden: true,
          });
          main.append(a);
          a.click();
          a.remove();
          const timer = setTimeout(() => URL.revokeObjectURL(url), 10000);
          onLeave(() => {
            clearTimeout(timer);
            URL.revokeObjectURL(url);
          });
          status.textContent =
            "Projet prêt. Décompresse-le puis lis INSTALLATION.md.";
        } catch (e) {
          if (e.name !== "AbortError")
            status.textContent =
              "Téléchargement incomplet. Vérifie la connexion puis réessaie.";
        } finally {
          download.disabled = false;
        }
      },
    },
    "Télécharger mon atelier (.zip)",
  );
  const core = h("ol", { class: "chapter-list" });
  const titles = [
    "Fondations",
    "Apprentissage",
    "Texte et nombres",
    "Premier modèle",
    "Transformer",
    "Données et ajustement",
  ];
  spec.coreLevels.forEach((id, i) =>
    core.append(
      h(
        "li",
        {},
        h("a", { href: `#/niveau/${id}` }, `Niveau ${id} · ${titles[i]}`),
      ),
    ),
  );
  const list = h("ol", { class: "track-list" });
  for (const stage of spec.stages) {
    list.append(
      h("li", { class: "sheet", id: `tp-${stage.id}` }, [
        h("h2", { text: `TP ${stage.id} · ${stage.title}` }),
        h("p", { text: stage.contract }),
        h("p", {}, ["À compléter : ", h("code", { text: stage.functions })]),
        h("p", {}, [
          "Contrôle : ",
          h("code", { text: `python verifier.py --jusqua ${stage.id}` }),
        ]),
        h(
          "p",
          {},
          stage.lessons.flatMap((id, i) => [
            i ? " · " : "Leçons : ",
            h("a", { href: `#/lecon/${id}`, text: id }),
          ]),
        ),
      ]),
    );
  }
  const doc = h("section", { class: "sheet atelier-document" });
  const selector = h("select", { "aria-label": "Guide de l’atelier" });
  const names = [
    "Installation Windows, macOS et Linux",
    "Guide des 12 TP",
    "Projet final et grille de relecture",
    "Objets, matrices et gradients",
    "Huit pannes à diagnostiquer",
    "Banc français et questions réservées",
    "BPE octets, PyTorch et utilisation locale",
    "Relire avec un débutant et sur de vrais appareils",
  ];
  spec.documents.forEach((path, i) =>
    selector.append(h("option", { value: path, text: names[i] })),
  );
  const content = h("pre", {
    class: "atelier-guide",
    tabindex: "0",
    "aria-label": "Document de l’atelier",
  });
  let documentTicket = 0;
  async function loadDoc() {
    const ticket = ++documentTicket;
    content.textContent = "Chargement du guide…";
    try {
      const r = await fetch(new URL(selector.value, document.baseURI), {
        signal: controller.signal,
      });
      if (!r.ok) throw new Error("Guide absent");
      const text = await r.text();
      if (ticket === documentTicket) content.textContent = text;
    } catch (e) {
      if (e.name !== "AbortError" && ticket === documentTicket)
        content.textContent =
          "Guide indisponible. Reconnecte-toi puis réessaie.";
    }
  }
  selector.onchange = loadDoc;
  doc.append(h("h2", { text: "Lire les consignes" }), selector, content);
  const diagnostics = h("section", { class: "sheet" }, [
    h("h2", { text: "Apprendre à diagnostiquer" }),
    h("p", { text: "Écris ton hypothèse avant d’ouvrir les indices. La solution donne un test à refaire avec d’autres nombres." }),
    ...(spec.diagnostics || []).map((item) => h("article", { class: "diagnostic-card" }, [
      h("h3", { text: item.title }), h("pre", { tabindex: "0", "aria-label": `Code à diagnostiquer : ${item.title}` }, h("code", { text: item.code })),
      h("p", { text: item.observation }), h("p", { text: item.question }),
      ...item.hints.map((hint, i) => h("details", {}, [h("summary", { text: `Indice ${i + 1}` }), h("p", { text: hint })])),
      h("details", {}, [h("summary", { text: "Diagnostic et contrôle" }), h("p", { text: item.solution })]),
      h("a", { href: `#/lecon/${item.lesson}`, text: `Revoir la leçon ${item.lesson}` }),
    ])),
  ]);
  main.replaceChildren(
    h("h1", { text: "Atelier : mon premier GPT" }),
    h("p", {
      class: "lead",
      text: "Construis tes composants dans un projet indépendant, entraîne ton modèle et apporte les preuves de son fonctionnement.",
    }),
    pathChoice(index),
    h("section", { class: "callout" }, [
      h("h2", { text: "Commencer sur ton ordinateur" }),
      h("p", {
        text: "Le projet contient eleve.py à compléter, un corrigé séparé, des primitives NumPy, les contrôles et le lanceur. Aucun poids préentraîné ni API. La lecture reste disponible sur mobile et tablette.",
      }),
      download,
      status,
      h("p", {
        text: "Les 12 contrôles vérifient des propriétés techniques. Ils ne certifient pas ton autonomie : explique les briques sans le corrigé et réalise le projet final sur tes données.",
      }),
    ]),
    h("section", { class: "sheet" }, [
      h("h2", { text: "Le tronc commun recommandé" }),
      core,
      h("p", {
        text: "Puis niveaux 5 et 6 pour les variantes et les coûts. MoE, SSM et multimodalité sont des approfondissements. Les durées affichées sont indicatives ; ajoute le temps des TP et du projet.",
      }),
    ]),
    doc,
    diagnostics,
    list,
  );
  await loadDoc();
}
