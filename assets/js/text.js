/** Normalisation et échappement. Le rendu du site passe par textContent. */

export function normalize(value) {
  return String(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function modifierLabel(userAgent) {
  return /Mac|iPhone|iPad|iPod/.test(userAgent) ? "⌘" : "Ctrl";
}
