/** Routes hash : partageables, et le bouton retour du navigateur fonctionne. */

const LESSON = /^\/lecon\/(\d+\.\d+)$/;
const LEVEL = /^\/niveau\/(\d+)$/;

export function parseHash(hash) {
  const raw = String(hash ?? "").trim();
  const withoutHash = raw.startsWith("#") ? raw.slice(1) : raw;
  const path = withoutHash === "" ? "/" : withoutHash;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/" || normalized === "/accueil") return { name: "home" };
  if (normalized === "/parcours") return { name: "home", focus: "roadmap" };
  if (normalized === "/modele") return { name: "model" };
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
    case "lesson":
      return `#/lecon/${route.id}`;
    case "level":
      return `#/niveau/${route.id}`;
    default:
      return "#/";
  }
}
