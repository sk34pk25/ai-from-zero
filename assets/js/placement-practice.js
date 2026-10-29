import { h } from "./dom.js";
import { onLeave } from "./lifecycle.js";
let specPromise;
function specification() {
  if (!specPromise) specPromise = fetch(new URL("data/placement_practice.json", document.baseURI))
    .then((r) => { if (!r.ok) throw new Error("chargement"); return r.json(); })
    .catch((error) => { specPromise = null; throw error; });
  return specPromise;
}
export function practicalPanel(changed) {
  let passed = false, current = true, bridge = null, running = false;
  const text = h("p", { text: "Chargement de la consigne…" });
  const area = h("textarea", { class: "ide-fallback", "aria-label": "Code de l’épreuve pratique", disabled: true });
  const status = h("p", { role: "status", text: "" });
  const run = h("button", { type: "button", class: "button button-primary", disabled: true }, "Vérifier mon programme");
  const stop = h("button", {
    type: "button", class: "button button-secondary", disabled: true,
    onClick: () => bridge?.stopWorker(),
  }, "Arrêter le contrôle");
  const node = h("section", { class: "panel placement-practice", hidden: true }, [
    h("h2", { text: "Une petite épreuve pratique" }), text,
    h("p", { text: "Le premier contrôle charge Python et NumPy depuis jsDelivr. Ton programme s’exécute dans un worker de ce navigateur ; le test ne l’enregistre pas. Sans réseau, réalise le mini-projet 0.23 sur ton ordinateur et conserve le niveau 0 à parcourir." }),
    area, run, stop, status, h("a", { href: "#/lecon/0.23", text: "Revoir le mini-projet et ses explications" }),
  ]);
  const loaded = specification().then((spec) => {
    if (!current) return spec;
    text.textContent = spec.prompt; area.value = spec.starter;
    area.disabled = false; run.disabled = false;
    return spec;
  }).catch(() => {
    if (current) status.textContent = "Consigne indisponible. Recharge lorsque le réseau revient, ou ouvre le mini-projet 0.23.";
    return null;
  });
  area.addEventListener("input", () => { passed = false; status.textContent = "Programme modifié : relance le contrôle."; changed(); });
  run.addEventListener("click", async () => {
    const spec = await loaded;
    if (!current || !spec) return;
    const source = area.value;
    passed = false; running = true; run.disabled = true; changed();
    status.textContent = "Démarrage de Python puis contrôle des cas publics…";
    try {
      bridge = await import("./pybridge.js");
      if (!current) return;
      stop.disabled = false;
      const result = await bridge.request({ type: "run", code: source + "\n" + spec.check, files: [] });
      if (!current) return;
      passed = source === area.value && result.type === "done";
      status.textContent = passed ? "Cas publics réussis. Explique aussi ton raisonnement : ce contrôle ne certifie pas ta compréhension."
        : result.cancelled ? "Contrôle arrêté. Tu peux modifier ton programme et relancer."
        : source !== area.value ? "Programme modifié pendant le contrôle : relance-le."
        : "Contrôle non réussi. " + (result.text || "Vérifie les calculs et les cas limites.");
    } catch {
      if (current) status.textContent = "Python indisponible : vérifie le réseau et réessaie, ou utilise le projet local.";
    } finally {
      running = false; if (current) { run.disabled = false; stop.disabled = true; changed(); }
    }
  });
  onLeave(() => { current = false; if (running) bridge?.stopWorker(); });
  return { node, get passed() { return passed; } };
}
