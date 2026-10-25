/** Routes hash : partageables, et le bouton retour du navigateur fonctionne.
 *
 * Un fragment Supabase (`#access_token=…&type=recovery`, ou un second
 * `#` collé après `#/nouveau-mot-de-passe`) n'est pas une route.
 * Il est reconnu avant le reste, sinon le routeur afficherait une 404
 * et le jeton se retrouverait dans le texte de la page.
 */

import { readAuthReturn } from "./auth-return.js";

const LESSON = /^\/lecon\/(\d+\.\d+)$/;
const LEVEL = /^\/niveau\/(\d+)$/;

export function routeFromHref(href) {
  const auth = readAuthReturn(href);
  if (auth.kind !== "none") return { name: "recovery" };
  return parseHash(new URL(href).hash);
}

export function parseHash(hash) {
  const raw = String(hash ?? "").trim();
  const auth = readAuthReturn(`https://afz.local/${raw.startsWith("#") || raw === "" ? raw : `#${raw}`}`);
  if (auth.kind !== "none") return { name: "recovery" };
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  const path = withoutHash === "" ? "/" : withoutHash;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/" || normalized === "/accueil") return { name: "home" };
  if (normalized === "/parcours") return { name: "home", focus: "roadmap" };
  if (normalized === "/modele") return { name: "model" };
  if (normalized === "/construire") return { name: "track" };
  if (normalized === "/playground") return { name: "playground" };
  if (normalized === "/ide") return { name: "ide" };
  if (normalized === "/connexion") return { name: "connexion" };
  if (normalized === "/nouveau-mot-de-passe") return { name: "recovery" };
  if (normalized === "/a-propos") return { name: "about" };
  if (normalized === "/donnees") return { name: "donnees" };
  const lesson = normalized.match(LESSON);
  if (lesson) return { name: "lesson", id: lesson[1] };
  const level = normalized.match(LEVEL);
  if (level) return { name: "level", id: Number(level[1]) };
  return { name: "notfound", path: normalized };
}

export function hrefFor(route) {
  switch (route.name) {
    case "home":
      return route.focus === "roadmap" ? "#/parcours" : "#/";
    case "model":
      return "#/modele";
    case "track":
      return "#/construire";
    case "playground":
      return "#/playground";
    case "ide":
      return "#/ide";
    case "connexion":
      return "#/connexion";
    case "recovery":
      return "#/nouveau-mot-de-passe";
    case "about":
      return "#/a-propos";
    case "donnees":
      return "#/donnees";
    case "lesson":
      return `#/lecon/${route.id}`;
    case "level":
      return `#/niveau/${route.id}`;
    default:
      return "#/";
  }
}
