/** Un worker partagé, une requête à la fois ; toute attente se termine à l'arrêt. */
import { ASSET_VERSION } from "./version.js";
let worker = null;
let pending = null;
let booted = false;
const terminal = new Set(["done", "error", "ready", "loss", "sample"]);

export function getWorker() {
  if (!worker) {
    worker = new Worker(new URL(`./pyworker.js?v=${encodeURIComponent(ASSET_VERSION)}`, import.meta.url));
    const current = worker;
    worker.addEventListener("message", (event) => {
      if (worker !== current) return;
      if (event.data?.type === "booted") {
        booted = true;
        clearTimeout(pending?.bootTimer);
        return;
      }
      if (!pending) return;
      pending.onEvent?.(event.data);
      if (terminal.has(event.data?.type)) {
        const task = pending;
        pending = null;
        clearTimeout(task.bootTimer);
        task.resolve(event.data);
      }
    });
    worker.addEventListener("error", () => stopWorker("Python n'a pas pu démarrer. Vérifie la connexion puis réessaie."));
    worker.addEventListener("messageerror", () => stopWorker("La réponse de Python n'a pas pu être lue."));
  }
  return worker;
}
export function stopWorker(text = "Exécution arrêtée.") {
  if (worker) worker.terminate();
  worker = null;
  booted = false;
  const task = pending;
  pending = null;
  clearTimeout(task?.bootTimer);
  task?.resolve({ type: "error", text, cancelled: true });
}
export function request(message, onEvent, { bootTimeoutMs = 120000 } = {}) {
  if (pending) return Promise.resolve({ type: "error", busy: true, text: "Python est occupé. Arrête le calcul avant d'en lancer un autre." });
  return new Promise((resolve) => {
    try {
      const current = getWorker();
      pending = { resolve, onEvent };
      if (!booted) pending.bootTimer = setTimeout(() => {
        if (worker === current && !booted) stopWorker("Le chargement de Python a dépassé le délai. Vérifie la connexion puis relance le contrôle pour redémarrer le moteur.");
      }, bootTimeoutMs);
      current.postMessage(message);
    } catch {
      clearTimeout(pending?.bootTimer);
      pending = null;
      resolve({ type: "error", text: "Python est indisponible dans ce navigateur." });
    }
  });
}
