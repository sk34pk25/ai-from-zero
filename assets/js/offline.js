import { h } from "./dom.js";
let installPrompt;
if (typeof window !== "undefined")
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });
export function registerOffline() {
  if ("serviceWorker" in navigator)
    navigator.serviceWorker
      .register(new URL("sw.js", document.baseURI))
      .catch(() => {});
}
export function offlinePanel() {
  const message = h("p", {
    role: "status",
    text: "La lecture des cours peut être conservée sur cet appareil. Python nécessite une connexion pour charger son moteur.",
  });
  async function cacheFiles(models = false) {
    try {
      if (!("serviceWorker" in navigator))
        throw new Error("Ce navigateur ne propose pas le mode hors connexion.");
      message.textContent = "Téléchargement en cours…";
      const registration = await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      channel.port1.onmessage = ({ data }) => {
        message.textContent =
          data.error ||
          `${data.count} fichiers prêts hors connexion. Les données privées ne sont pas mises dans ce cache.`;
      };
      registration.active.postMessage({ type: "CACHE_COURSE", models }, [
        channel.port2,
      ]);
    } catch (e) {
      message.textContent = e.message;
    }
  }
  return h("section", { class: "sheet" }, [
    h("h2", { text: "Installer et lire hors connexion" }),
    h(
      "button",
      {
        type: "button",
        onClick: async () => {
          if (installPrompt) {
            await installPrompt.prompt();
            installPrompt = null;
          } else
            message.textContent =
              "Dans le menu du navigateur, choisis Installer ou Ajouter à l’écran d’accueil. Cette option dépend de ton navigateur.";
        },
      },
      "Installer sur cet appareil",
    ),
    h(
      "button",
      { type: "button", onClick: () => cacheFiles() },
      "Télécharger les cours",
    ),
    h(
      "button",
      { type: "button", onClick: () => cacheFiles(true) },
      "Conserver aussi les modèles du playground",
    ),
    message,
  ]);
}
