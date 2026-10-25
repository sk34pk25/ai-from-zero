/** Une figure manipulable par niveau, en plus du schéma de la leçon. */

const HOSTS = {
  "0.1": (host) => slider(host, "Charge CPU", "La charge passe de", "% du dessin, pas une mesure de ta machine."),
  "1.14": (host) => slider(host, "Position du point", "Le point est à", ". À gauche la pente est négative, à droite elle est positive.", (value) => (value < 5 ? "descente vers la droite" : "descente vers la gauche")),
  "2.5": (host) => reorder(host, ["le", "chat", "dort"], "L'ordre des jetons change les identifiants."),
  "3.5": (host) => slider(host, "Température", "Température", ". Plus elle monte, plus la masse s'étale.", (value) => (value < 3 ? "distribution pointue" : "distribution étalée")),
  "4.4": (host) => reorder(host, ["je", "regarde", "ici"], "Déplacer un jeton change qui peut être vu."),
  "5.2": (host) => slider(host, "Rotation", "Angle", " cran. RoPE tourne la paire de coordonnées, la forme reste la même."),
  "6.3": (host) => slider(host, "Longueur T", "T =", ". Le coût d'attention dessiné suit T au carré.", (value) => `coût relatif ${value * value}`),
  "7.4": (host) => slider(host, "Experts actifs", "Top-k =", ". Les autres experts restent en mémoire.", (value) => `${Math.max(1, Math.round(value / 3))} expert(s) calculé(s)`),
  "8.7": (host) => slider(host, "Oubli", "Oubli", ". Plus il est fort, moins le premier pas survit.", (value) => (value > 6 ? "le début s'efface" : "le début reste lisible")),
  "9.2": (host) => reorder(host, ["p1", "p2", "p3", "p4"], "L'ordre des patches n'est pas l'ordre des pixels."),
  "10.4": (host) => reorder(host, ["question", "doc A", "doc B"], "Rapprocher un document change le contexte injecté."),
  "11.2": (host) => slider(host, "Écart à la baseline", "Écart", ". On ne change qu'une colonne du comparateur."),
  "12.8": (host) => slider(host, "Part de scan", "Mélange", ". Le dos hybride garde la même forme de sortie.", (value) => (value < 5 ? "plutôt attention" : "plutôt scan")),
  "13.6": (host) => slider(host, "Part de la réponse", "Masque", ". Seule cette part entre dans la perte.", (value) => `${value} caractère(s) de réponse comptés dans le dessin`),
};

export function mountManipulator(host, lessonId) {
  const build = HOSTS[lessonId];
  if (!build) return false;
  host.replaceChildren();
  build(host);
  return true;
}

function slider(host, label, before, after, extra) {
  const input = document.createElement("input");
  input.type = "range";
  input.min = "0";
  input.max = "10";
  input.value = "4";
  input.setAttribute("aria-label", label);
  const note = document.createElement("p");
  note.className = "manip-readout";
  const paint = () => {
    const value = Number(input.value);
    const tail = extra ? ` ${extra(value)}.` : "";
    note.textContent = `${before} ${value}${after}${tail}`;
  };
  input.addEventListener("input", paint);
  const field = document.createElement("label");
  field.append(document.createTextNode(label), input);
  host.append(field, note);
  paint();
}

function reorder(host, items, caption) {
  let order = items.slice();
  let drag = 0;
  const list = document.createElement("div");
  list.className = "token-board";
  const note = document.createElement("p");
  note.className = "manip-readout";
  const paint = () => {
    list.replaceChildren();
    order.forEach((item, index) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "token-chip";
      chip.draggable = true;
      chip.textContent = item;
      chip.setAttribute("aria-label", `Jeton ${item}`);
      chip.addEventListener("dragstart", () => { drag = index; });
      chip.addEventListener("dragover", (event) => event.preventDefault());
      chip.addEventListener("drop", (event) => {
        event.preventDefault();
        move(drag, index);
      });
      list.append(chip);
    });
    note.textContent = `${caption} Ordre : ${order.join(" · ")}.`;
  };
  function move(from, to) {
    if (from === to) return;
    const next = order.slice();
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    order = next;
    paint();
  }
  const forward = document.createElement("button");
  forward.type = "button";
  forward.className = "visual-button";
  forward.textContent = "Avancer le jeton";
  forward.addEventListener("click", () => move(0, Math.min(order.length - 1, 1)));
  const back = document.createElement("button");
  back.type = "button";
  back.className = "visual-button";
  back.textContent = "Reculer le jeton";
  back.addEventListener("click", () => move(order.length - 1, Math.max(0, order.length - 2)));
  host.append(list, forward, back, note);
  paint();
}
