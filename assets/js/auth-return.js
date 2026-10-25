/** Retour Supabase après « Mot de passe oublié ».
 *
 * Le site route avec le fragment (`#/lecon/1.2`). Le flux implicite de
 * Supabase écrit la session au même endroit
 * (`#access_token=…&type=recovery`) et efface donc la route. Le flux PKCE
 * pose `?code=` dans la query, parfois à côté d'un fragment de route.
 * On sépare les deux avant que le routeur ne prenne le fragment pour un chemin.
 */

export const RECOVERY_HASH = "#/nouveau-mot-de-passe";

const AUTH_KEYS = [
  "access_token",
  "refresh_token",
  "expires_in",
  "expires_at",
  "token_type",
  "type",
  "error",
  "error_code",
  "error_description",
  "code",
  "sb_flow_id",
  "provider_token",
  "provider_refresh_token",
];

const EXPIRED_CODES = new Set(["otp_expired", "flow_state_expired", "flow_state_not_found"]);

function paramsOf(searchParams) {
  const params = {};
  for (const key of AUTH_KEYS) {
    const value = searchParams.get(key);
    if (value) params[key] = value;
  }
  return params;
}

/** Sépare une route `#/…` des paires auth collées dans le même fragment. */
export function splitHash(rawHash) {
  const raw = String(rawHash || "");
  if (!raw) return { route: "", params: {} };
  if (raw.startsWith("/")) {
    const queryAt = raw.indexOf("?");
    const ampAt = raw.indexOf("&");
    const cut = queryAt === -1 ? ampAt : ampAt === -1 ? queryAt : Math.min(queryAt, ampAt);
    if (cut === -1) return { route: raw, params: {} };
    return {
      route: raw.slice(0, cut),
      params: paramsOf(new URLSearchParams(raw.slice(cut + 1))),
    };
  }
  if (!raw.includes("=")) return { route: raw, params: {} };
  return { route: "", params: paramsOf(new URLSearchParams(raw)) };
}

export function readAuthReturn(href) {
  const url = new URL(href);
  const hash = url.hash.startsWith("#") ? url.hash.slice(1) : "";
  const split = splitHash(hash);
  const params = { ...split.params, ...paramsOf(url.searchParams) };
  let kind = "none";
  if (params.error || params.error_code || params.error_description) kind = "error";
  else if (params.access_token || params.refresh_token) {
    kind = params.access_token && params.refresh_token ? "implicit" : "error";
  } else if (params.code) kind = "pkce";
  return {
    kind,
    params,
    route: split.route,
    type: params.type || "",
    flowType: kind === "pkce" ? "pkce" : "implicit",
  };
}

export function recoveryErrorMessage(code, description = "") {
  const normalized = String(code || "");
  if (EXPIRED_CODES.has(normalized) || /expired/i.test(String(description || ""))) {
    return "Ce lien a expiré. Demande un nouveau message pour choisir un mot de passe.";
  }
  if (normalized === "access_denied") {
    return "Ce lien n'est plus valable. Demande un nouveau message pour choisir un mot de passe.";
  }
  return "Ce lien de réinitialisation n'a pas fonctionné. Demande un nouveau message.";
}

export function passwordResetRedirect(baseHref) {
  const url = new URL(baseHref);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/index\.html$/i, "");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.hash = RECOVERY_HASH;
  return url.toString();
}

export function cleanAuthLocation(href, hash = RECOVERY_HASH) {
  const url = new URL(href);
  for (const key of AUTH_KEYS) url.searchParams.delete(key);
  url.hash = hash.startsWith("#") ? hash : `#${hash}`;
  return url.toString();
}

export function isEmailAddress(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export function passwordProblems(password, confirmation) {
  if (password.length < 12) return "Le mot de passe doit contenir au moins 12 caractères.";
  if (password !== confirmation) return "Les deux mots de passe ne correspondent pas.";
  return "";
}
