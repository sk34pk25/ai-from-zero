/** Ressources attachées à la page active, libérées avant le prochain rendu. */
let disposers = [];
export function onLeave(fn) {
  disposers.push(fn);
}
export function leavePage() {
  const previous = disposers;
  disposers = [];
  for (const fn of previous) {
    try {
      fn();
    } catch {
      /* page déjà fermée */
    }
  }
}
