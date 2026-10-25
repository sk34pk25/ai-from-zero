/** Retour Supabase après « Mot de passe oublié ».
 *
 * GoTrue construit le retour implicite en collant un second fragment :
 * `redirect_to + "#" + jetons`. Si `redirect_to` contient déjà
 * `#/nouveau-mot-de-passe`, le navigateur reçoit
 * `…/#/nouveau-mot-de-passe#access_token=…&refresh_token=…`.
 * `URLSearchParams` colle alors `access_token` à la route et le site
 * classait le lien en erreur. On découpe sur chaque `#` avant ça.
 *
 * Les prochains messages partent vers `?recovery=1`, sans fragment,
 * donc un seul `#` suffit. Les messages déjà envoyés gardent le double fragment.
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
  "token_hash",
];

const IMPLICIT_KEYS = [
  "access_token",
  "expires_at",
  "expires_in",
  "provider_refresh_token",
  "provider_token",
  "refresh_token",
  "token_type",
  "type",
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

/** `%23` dans le fragment est un second `#` que l'URL n'a pas toujours décodé. */
function decodeHashDelimiters(value) {
  return String(value || "").replace(/%23/gi, "#");
}

function absorb(params, chunk) {
  if (!chunk || !chunk.includes("=")) return;
  Object.assign(params, paramsOf(new URLSearchParams(chunk.replace(/^[?&]/, ""))));
}

/** Sépare une route `#/…` des paires auth, y compris après un second `#`. */
export function splitHash(rawHash) {
  const raw = decodeHashDelimiters(rawHash);
  if (!raw) return { route: "", params: {} };
  const params = {};
  const pieces = raw.split("#");
  let route = "";
  pieces.forEach((piece, index) => {
    if (index > 0) {
      absorb(params, piece);
      return;
    }
    const cut = piece.search(/[?&]/);
    const head = cut === -1 ? piece : piece.slice(0, cut);
    const tail = cut === -1 ? "" : piece.slice(cut + 1);
    if (!head.includes("=")) route = head;
    else absorb(params, head);
    absorb(params, tail);
  });
  return { route, params };
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
  else if (params.token_hash) kind = "token_hash";
  return {
    kind,
    params,
    route: split.route,
    type: params.type || "",
    flowType: kind === "pkce" ? "pkce" : "implicit",
  };
}

/** Fragment unique que `detectSessionInUrl` sait lire. */
export function normalizeImplicitHref(href) {
  const auth = readAuthReturn(href);
  if (auth.kind !== "implicit") return href;
  const url = new URL(href);
  const hashBody = decodeHashDelimiters(url.hash.startsWith("#") ? url.hash.slice(1) : "");
  if (!hashBody.includes("#")) {
    const parsed = new URLSearchParams(hashBody);
    if (
      parsed.get("access_token") === auth.params.access_token
      && parsed.get("refresh_token") === auth.params.refresh_token
    ) {
      return href;
    }
  }
  for (const key of AUTH_KEYS) url.searchParams.delete(key);
  const fragment = new URLSearchParams();
  for (const key of IMPLICIT_KEYS) {
    if (auth.params[key]) fragment.set(key, auth.params[key]);
  }
  url.hash = fragment.toString();
  return url.toString();
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

/** Adresse sans fragment : GoTrue n'ajoute alors qu'un seul `#`. */
export function passwordResetRedirect(baseHref) {
  const url = new URL(baseHref);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/index\.html$/i, "");
  if (!url.pathname.endsWith("/")) url.pathname += "/";
  url.searchParams.set("recovery", "1");
  return url.toString();
}

export function cleanAuthLocation(href, hash = RECOVERY_HASH) {
  const url = new URL(href);
  for (const key of AUTH_KEYS) url.searchParams.delete(key);
  url.searchParams.delete("recovery");
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
