/** Test de positionnement : savoir si le niveau 0 peut être survolé, et quelles étapes revoir.
 *
 * Les questions demandent de prévoir le résultat d'un petit programme ou
 * d'un calcul, pas de réciter une définition. Chaque question renvoie aux
 * étapes qui l'enseignent. Rien n'est enregistré par le test lui-même.
 */
import { h } from "./dom.js";

export const PLACEMENT = [
  {
    id: "types",
    code: 'x = "3" + "4"\nprint(x)',
    question: "Qu'affiche ce programme ?",
    choices: ["7", "34", "3 + 4", "Une erreur TypeError"],
    answer: 1,
    steps: ["0.6"],
  },
  {
    id: "conditions",
    code: 'n = 0\nif n > 0:\n    print("positif")\nelif n == 0:\n    print("nul")\nelse:\n    print("négatif")',
    question: "Qu'affiche ce programme ?",
    choices: ["positif", "négatif", "nul", "Rien"],
    answer: 2,
    steps: ["0.7"],
  },
  {
    id: "boucles",
    code: "total = 0\nfor i in range(4):\n    total = total + i\nprint(total)",
    question: "Qu'affiche ce programme ?",
    choices: ["10", "4", "3", "6"],
    answer: 3,
    steps: ["0.8"],
  },
  {
    id: "fonctions",
    code: "def double(x):\n    print(x * 2)\n\ny = double(5)\nprint(y)",
    question: "Qu'affichent les deux print, dans l'ordre ?",
    choices: ["10 puis None", "10 puis 10", "None puis 10", "Une erreur"],
    answer: 0,
    steps: ["0.9"],
  },
  {
    id: "dictionnaires",
    code: 'd = {"a": 1}\nd["b"] = d["a"] + 1\nprint(len(d), d["b"])',
    question: "Qu'affiche ce programme ?",
    choices: ["1 2", "2 2", "2 1", "Une erreur KeyError"],
    answer: 1,
    steps: ["0.10"],
  },
  {
    id: "objets",
    code: "class Boite:\n    def __init__(self):\n        self.v = 1\n\na = Boite()\nb = a\nb.v = 5\nprint(a.v)",
    question: "Qu'affiche ce programme ?",
    choices: ["1", "Une erreur AttributeError", "5", "None"],
    answer: 2,
    steps: ["0.21"],
  },
  {
    id: "tests",
    code: "assert sum([1, 2]) == 4\nprint(\"fini\")",
    question: "Que se passe-t-il à l'exécution ?",
    choices: [
      "Le programme affiche fini",
      "Le programme s'arrête sur une AssertionError, fini n'est pas affiché",
      "Python corrige le calcul et affiche 4",
      "Rien : assert ne sert qu'aux commentaires",
    ],
    answer: 1,
    steps: ["0.12", "0.22"],
  },
  {
    id: "chemins",
    code: 'open("data/notes.txt")',
    question: "Depuis quel dossier Python cherche-t-il ce chemin relatif ?",
    choices: [
      "Le dossier où se trouve l'installation de Python",
      "Toujours le dossier personnel de l'utilisateur",
      "Le dossier courant, celui depuis lequel le programme est lancé",
      "Le dossier du premier fichier ouvert dans l'éditeur",
    ],
    answer: 2,
    steps: ["0.2", "0.3"],
  },
  {
    id: "broadcasting",
    code: "import numpy as np\nx = np.zeros((2, 3)) + np.ones(3)\nprint(x.shape)",
    question: "Qu'affiche ce programme ?",
    choices: ["(2, 3)", "(3,)", "(2,)", "Une erreur de formes"],
    answer: 0,
    steps: ["0.15", "0.17"],
  },
  {
    id: "matrices",
    code: "A a la forme (2, 3)\nB a la forme (3, 4)\nC = A @ B",
    question: "Quelle est la forme de C ?",
    choices: ["(3, 3)", "(2, 4)", "(4, 2)", "Le produit est impossible"],
    answer: 1,
    steps: ["0.18"],
  },
  {
    id: "probabilites",
    code: "Un dé équilibré à six faces est lancé une fois.",
    question: "Quelle est la probabilité d'obtenir un nombre pair ?",
    choices: ["1/6", "1/3", "2/3", "1/2"],
    answer: 3,
    steps: ["0.19"],
  },
  {
    id: "derivee",
    code: "f(x) = x²",
    question: "Que vaut la pente de f en x = 3 ?",
    choices: ["9", "3", "6", "0"],
    answer: 2,
    steps: ["0.20"],
  },
];

/** Seuil : au plus deux erreurs pour proposer de survoler le niveau 0. */
export const PASS_MISSES = 2;

export function scorePlacement(answers, questions = PLACEMENT) {
  const missed = questions.filter((q) => answers[q.id] !== q.answer);
  const unanswered = questions.filter((q) => answers[q.id] == null).length;
  const review = [...new Set(missed.flatMap((q) => q.steps))].sort(
    (a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]),
  );
  return {
    score: questions.length - missed.length,
    total: questions.length,
    unanswered,
    review,
    passed: unanswered === 0 && missed.length <= PASS_MISSES,
  };
}

/** Étapes du niveau 0 à marquer comme connues : toutes, sauf celles à revoir. */
export function knownSteps(levelZeroIds, result) {
  const review = new Set(result.review);
  return levelZeroIds.filter((id) => !review.has(id));
}

export function paintPlacement(main, { index, canTrack, onMarkKnown, enableTracking }) {
  const answers = {};
  const levelZero = index.levels.find((level) => level.id === 0);
  const titleOf = (id) => index.byId.get(id)?.lesson.title || id;
  const result = h("section", { class: "panel placement-result", "aria-live": "polite", hidden: true });
  const submit = h("button", { type: "submit", class: "button button-primary" }, "Voir mon résultat");

  const items = PLACEMENT.map((q, number) =>
    h("fieldset", { class: "placement-question" }, [
      h("legend", { text: `${number + 1}. ${q.question}` }),
      h("pre", {}, h("code", { text: q.code })),
      h(
        "div",
        { class: "placement-choices" },
        q.choices.map((choice, choiceIndex) =>
          h("label", { class: "placement-choice" }, [
            h("input", {
              type: "radio",
              name: `placement-${q.id}`,
              value: String(choiceIndex),
              onChange: () => {
                answers[q.id] = choiceIndex;
              },
            }),
            h("span", { text: choice }),
          ]),
        ),
      ),
    ]),
  );

  const showResult = () => {
    const outcome = scorePlacement(answers);
    const nodes = [
      h("h2", { text: `${outcome.score} / ${outcome.total}` }),
    ];
    if (outcome.unanswered > 0) {
      nodes.push(h("p", { text: `Il reste ${outcome.unanswered} question${outcome.unanswered > 1 ? "s" : ""} sans réponse. Réponds à tout pour un conseil fiable.` }));
    } else if (outcome.passed) {
      nodes.push(
        h("p", {
          text: "Tu peux survoler le niveau 0. Les étapes liées à tes erreurs restent à faire : elles ne sont pas marquées.",
        }),
      );
    } else {
      nodes.push(
        h("p", {
          text: "Commence par le niveau 0. Ce n'est pas une note : les questions ratées montrent les étapes qui te feront gagner le plus de temps ensuite.",
        }),
      );
    }
    if (outcome.review.length > 0)
      nodes.push(
        h("h3", { text: "Étapes à revoir" }),
        h(
          "ul",
          {},
          outcome.review.map((id) => h("li", {}, h("a", { href: `#/lecon/${id}` }, `${id} · ${titleOf(id)}`))),
        ),
      );
    if (outcome.unanswered === 0 && outcome.passed && levelZero) {
      const known = knownSteps(
        levelZero.steps.map((step) => step.id),
        outcome,
      );
      nodes.push(
        canTrack()
          ? h(
              "button",
              {
                type: "button",
                class: "button button-primary",
                onClick: () => onMarkKnown(known),
              },
              `Marquer ${known.length} étapes du niveau 0 comme connues`,
            )
          : h("div", {}, [
              h("p", {
                text: "Le site n'enregistre rien sans ton accord. Ce bouton active le suivi dans ce navigateur, sans compte ni envoi, puis marque ces étapes.",
              }),
              h(
                "button",
                {
                  type: "button",
                  class: "button button-primary",
                  onClick: () => {
                    if (enableTracking()) onMarkKnown(known);
                  },
                },
                `Garder ce résultat sur cet appareil (${known.length} étapes)`,
              ),
            ]),
      );
    }
    nodes.push(h("p", {}, h("a", { href: outcome.passed ? "#/niveau/1" : "#/lecon/0.1" }, outcome.passed ? "Aller au niveau 1" : "Commencer à l'étape 0.1")));
    result.replaceChildren(...nodes);
    result.hidden = false;
    result.focus?.();
  };

  const form = h(
    "form",
    {
      class: "placement-form",
      onSubmit: (event) => {
        event.preventDefault();
        showResult();
      },
    },
    [...items, submit],
  );
  result.setAttribute("tabindex", "-1");
  main.replaceChildren(
    h("header", { class: "placement-head" }, [
      h("p", { class: "eyebrow", text: "Positionnement" }),
      h("h1", { text: "As-tu déjà les bases ?" }),
      h("p", {
        class: "lead",
        text: "Douze questions courtes sur Python et les maths du niveau 0. Prévois le résultat sans exécuter le code. Compte cinq minutes ; rien n'est enregistré tant que tu ne le demandes pas.",
      }),
    ]),
    form,
    result,
  );
}
