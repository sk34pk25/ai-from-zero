/** Décide s'il faut recharger la page pour prendre les assets d'un nouveau déploiement.
 *
 * Le instantané d'arrivée est celui du premier script, avant que le routeur
 * ne retire les jetons du fragment. Le rechargement repart de cette adresse.
 */

export function nextCacheUrl(href, expected, remoteVersion) {
  const remote = String(remoteVersion || "");
  const current = String(expected || "");
  if (!remote || remote === current) return "";
  const url = new URL(href);
  if (url.searchParams.get("v") === remote) return "";
  url.searchParams.set("v", remote);
  const next = url.toString();
  return next === href ? "" : next;
}
