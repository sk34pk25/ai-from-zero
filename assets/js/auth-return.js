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

/** Le mail intégré de Supabase plafonne très bas (quelques envois par heure). */
export const RECOVERY_EMAIL_COOLDOWN_MS = 60 * 60 * 1000;
export const RECOVERY_EMAIL_LOCK_MS = 30 * 1000;
export const RECOVERY_EMAIL_UNTIL_KEY = "afz-recovery-email-until";
export const RECOVERY_EMAIL_LOCK_KEY = "afz-recovery-email-lock";

export const RECOVERY_EMAIL_HINT = "Le courrier part du service intégré de Supabase, limité à quelques envois par heure. Le message précédent peut encore être valable. Pense aux courriers indésirables.";

export const RECOVERY_EMAIL_SENT = "Si ce compte existe, un message de réinitialisation a été envoyé. Regarde la boîte de réception et les courriers indésirables. Un autre envoi sera possible dans environ une heure, pour ne pas épuiser ce quota.";

export const RECOVERY_EMAIL_RATE_LIMIT = "Limite horaire du courrier atteinte. Le mail intégré de Supabase n'envoie que quelques messages par heure : attends environ une heure avant de réessayer. Le message précédent peut encore être valable. Vérifie aussi les courriers indésirables.";

export const RECOVERY_EMAIL_NETWORK = "Le message n'a pas pu partir : le réseau ou Supabase ne répond pas. Réessaie dans un moment. Cet échec n'est pas compté comme un envoi. Si un message est déjà arrivé, il peut encore être valable (regarde aussi les courriers indésirables).";

export const RECOVERY_EMAIL_BUSY = "Un envoi est déjà en cours. Patiente quelques secondes pour ne pas consommer le quota.";

export function formatRecoveryWait(ms) {
  const total = Math.max(0, Math.ceil(Number(ms) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    if (minutes === 0) return hours === 1 ? "1 heure" : `${hours} heures`;
    return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  }
  if (minutes > 0) return seconds ? `${minutes} min ${seconds} s` : `${minutes} min`;
  return `${seconds} s`;
}

export function recoveryCooldownMessage(remainingMs) {
  return `Un envoi a déjà été demandé. Attends encore ${formatRecoveryWait(remainingMs)} avant un nouveau message (environ une heure entre deux envois). Le précédent peut encore être valable : vérifie la boîte et les courriers indésirables.`;
}

function storedNumber(storage, key) {
  const value = Number(storage?.getItem?.(key) || 0);
  return Number.isFinite(value) ? value : 0;
}

export function recoveryCooldownRemaining(storage, now = Date.now()) {
  return Math.max(0, storedNumber(storage, RECOVERY_EMAIL_UNTIL_KEY) - now);
}

export function recoverySendBlocked(storage, now = Date.now()) {
  const remaining = recoveryCooldownRemaining(storage, now);
  if (remaining > 0) return { blocked: true, reason: "cooldown", remaining };
  const lockRemaining = storedNumber(storage, RECOVERY_EMAIL_LOCK_KEY) - now;
  if (lockRemaining > 0) return { blocked: true, reason: "busy", remaining: lockRemaining };
  return { blocked: false, reason: "", remaining: 0 };
}

export function claimRecoverySend(storage, now = Date.now()) {
  const blocked = recoverySendBlocked(storage, now);
  if (blocked.blocked) return blocked;
  storage.setItem(RECOVERY_EMAIL_LOCK_KEY, String(now + RECOVERY_EMAIL_LOCK_MS));
  return { blocked: false, reason: "", remaining: 0 };
}

export function settleRecoverySend(storage, outcome, now = Date.now()) {
  if (outcome === "sent" || outcome === "limited") {
    storage.setItem(RECOVERY_EMAIL_UNTIL_KEY, String(now + RECOVERY_EMAIL_COOLDOWN_MS));
  }
  storage.removeItem(RECOVERY_EMAIL_LOCK_KEY);
}

export function resetEmailFailure(error) {
  const status = Number(error?.status || 0);
  const code = String(error?.code || "");
  const name = String(error?.name || "");
  const message = String(error?.message || "");
  if (
    status === 429
    || code === "over_email_send_rate_limit"
    || code === "over_request_rate_limit"
    || /rate limit/i.test(message)
  ) {
    return { ok: false, code: "over_email_send_rate_limit", message: RECOVERY_EMAIL_RATE_LIMIT };
  }
  if (code === "otp_expired" || /otp.*expired|link is invalid or has expired/i.test(message)) {
    return {
      ok: false,
      code: "otp_expired",
      message: "Ce lien a expiré. Demande un nouveau message quand le délai d'attente est passé, et vérifie les courriers indésirables.",
    };
  }
  if (code === "validation_failed" || code === "email_address_invalid" || /invalid.*email/i.test(message)) {
    return { ok: false, code: code || "validation_failed", message: "Cette adresse e-mail n'est pas valable." };
  }
  if (
    status === 0
    || name === "AuthRetryableFetchError"
    || /failed to fetch|networkerror|load failed|network request failed/i.test(message)
  ) {
    return { ok: false, code: "network", message: RECOVERY_EMAIL_NETWORK };
  }
  if (status >= 500 || code === "unexpected_failure") {
    return {
      ok: false,
      code: code || "server",
      message: "Supabase n'a pas pu préparer le message. Réessaie dans un moment. Si un message est déjà arrivé, il peut encore être valable : vérifie les courriers indésirables.",
    };
  }
  if (code) {
    return {
      ok: false,
      code,
      message: `Le message n'a pas pu être envoyé (code ${code}). Réessaie plus tard, et vérifie les courriers indésirables.`,
    };
  }
  return {
    ok: false,
    code: "unknown",
    message: "Le message n'a pas pu être envoyé. Vérifie la connexion, puis réessaie. Regarde aussi les courriers indésirables si un message est déjà parti.",
  };
}
