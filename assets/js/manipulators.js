/** Une figure manipulable par niveau, en plus du schéma de la leçon. */

const HOSTS = {
  "10.4": host => reorder(host, ["question", "doc A", "doc B"], "L’ordre de présentation des documents change le contexte injecté."),
};

export function mountManipulator(host, lessonId) {
  const build = HOSTS[lessonId];
  if (!build) return false;
  host.replaceChildren();
  build(host);
  return true;
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
