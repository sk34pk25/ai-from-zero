/** Un worker Pyodide pour l'IDE, les exercices et le pas à pas. L'arrêt tue le worker. */

import { ASSET_VERSION } from "./version.js";

let worker = null;
let listener = null;

export function getWorker() {
  if (!worker) worker = new Worker(new URL(`./pyworker.js?v=${encodeURIComponent(ASSET_VERSION)}`, import.meta.url));
  return worker;
}

export function stopWorker() {
  if (listener && worker) worker.removeEventListener("message", listener);
  listener = null;
  if (worker) worker.terminate();
  worker = null;
}

export function request(message, onEvent) {
  const current = getWorker();
  return new Promise((resolve) => {
    if (listener) current.removeEventListener("message", listener);
    listener = (event) => {
      onEvent?.(event.data);
      const kind = event.data?.type;
      if (kind === "done" || kind === "error" || kind === "ready" || kind === "loss" || kind === "sample") {
        current.removeEventListener("message", listener);
        listener = null;
        resolve(event.data);
      }
    };
    current.addEventListener("message", listener);
    current.postMessage(message);
  });
}
