/** Session propriétaire via Supabase Auth.
 *
 * Le cadenas affiché dans l'interface est une commodité. La protection
 * des fichiers, de la progression et des plans est faite par les
 * politiques RLS : seul auth.uid() du propriétaire peut écrire.
 * Un visiteur qui contourne l'interface exécute du code dans son
 * navigateur, il ne modifie pas le dépôt ni les données du propriétaire.
 * Le jeton de session n'est jamais écrit dans la console.
 */

import { OWNER_ID, SUPABASE_ANON_KEY, SUPABASE_URL } from "../config.js";
import {
  RECOVERY_EMAIL_BUSY,
  RECOVERY_EMAIL_SENT,
  RECOVERY_HASH,
  claimRecoverySend,
  cleanAuthLocation,
  normalizeImplicitHref,
  passwordResetRedirect,
  readAuthReturn,
  recoveryCooldownMessage,
  recoveryErrorMessage,
  resetEmailFailure,
  settleRecoverySend,
} from "./auth-return.js";

const listeners = new Set();
let client = null;
let user = null;
let recoveryNotice = null;
let passwordRecovery = false;
let passwordSaved = false;
let accountPasswordNoticeText = "";
let holdRecoveryRoute = false;

export function publicConfig() {
  return {
    url: String(SUPABASE_URL || "").trim(),
    anonKey: String(SUPABASE_ANON_KEY || "").trim(),
    ownerId: String(OWNER_ID || "").trim(),
  };
}

export function isConfigured(config = publicConfig()) {
  return (
    config.url.startsWith("https://") &&
    config.anonKey.length >= 20 &&
    config.ownerId.length >= 8
  );
}

const RECOVERY_TOKEN_KEY = "afz-recovery-token";
let pendingRecoveryToken = "";

function rememberTokenHash(value) {
  pendingRecoveryToken = String(value || "");
  if (!pendingRecoveryToken || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(RECOVERY_TOKEN_KEY, pendingRecoveryToken);
  } catch {
    /* navigation privée : le jeton reste en mémoire pour cet onglet */
  }
}

function readStoredTokenHash() {
  if (pendingRecoveryToken) return pendingRecoveryToken;
  if (typeof window === "undefined") return "";
  try {
    pendingRecoveryToken =
      window.sessionStorage.getItem(RECOVERY_TOKEN_KEY) || "";
  } catch {
    pendingRecoveryToken = "";
  }
  return pendingRecoveryToken;
}

function forgetTokenHash() {
  pendingRecoveryToken = "";
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RECOVERY_TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function getPendingRecoveryToken() {
  return readStoredTokenHash();
}

export function dismissRecoveryToken() {
  forgetTokenHash();
}

/** Vrai seulement si une session, un vérificateur PKCE ou un retour Auth
 * est déjà là. Un visiteur anonyme ne charge pas le client : le bundle
 * pèse trop lourd pour Lighthouse, et l'initialisation irait interroger
 * Supabase à chaque page. */
export function shouldOpenAuthClient(config, href, storage) {
  try {
    if (readAuthReturn(href).kind !== "none") return true;
    const ref = new URL(config.url).hostname.split(".")[0];
    const prefix = `sb-${ref}-`;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function hasAuthWork() {
  try {
    if (typeof window === "undefined") return false;
    if (readAuthReturn(window.location.href).kind !== "none") return true;
    if (!window.localStorage) return false;
    return shouldOpenAuthClient(publicConfig(), window.location.href, window.localStorage);
  } catch { return false; }
}

export function currentUser() {
  return user;
}

export function isOwner() {
  const { ownerId } = publicConfig();
  return Boolean(ownerId) && user?.id === ownerId;
}

export function onAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener(user);
}

function pinRecoveryRoute() {
  if (typeof window === "undefined") return;
  const auth = readAuthReturn(window.location.href);
  if (auth.kind === "implicit") return;
  if (auth.kind === "pkce") {
    if (window.location.hash !== RECOVERY_HASH) {
      const url = new URL(window.location.href);
      url.hash = RECOVERY_HASH;
      window.history.replaceState(window.history.state, "", url.toString());
    }
    return;
  }
  const hash = window.location.hash;
  const blank = hash === "" || hash === "#" || hash === "#/";
  if (!holdRecoveryRoute && !blank && hash.startsWith("#/")) return;
  const target = cleanAuthLocation(window.location.href, RECOVERY_HASH);
  if (target !== window.location.href) {
    window.history.replaceState(window.history.state, "", target);
  }
}

/** Le client Supabase vide le fragment après avoir lu les jetons.
 * On remet la route dédiée sans baisser le drapeau : la session n'est pas
 * encore tranchée, et un fragment vide ne doit pas redevenir l'accueil. */
export function preserveRecoveryHash() {
  if (!holdRecoveryRoute) return;
  pinRecoveryRoute();
}

/** À appeler une fois la session lue. Le drapeau retombe, la navigation reprend. */
export function settleRecoveryLocation() {
  if (!holdRecoveryRoute) return;
  pinRecoveryRoute();
  if (typeof window === "undefined") {
    holdRecoveryRoute = false;
    return;
  }
  const auth = readAuthReturn(window.location.href);
  if (auth.kind !== "implicit" && auth.kind !== "pkce")
    holdRecoveryRoute = false;
}

export function isPasswordRecovery() {
  return passwordRecovery;
}

export function isPasswordSaved() {
  return passwordSaved;
}

export function accountPasswordNotice() {
  return accountPasswordNoticeText;
}

export function isRecoveryPending() {
  return holdRecoveryRoute && !recoveryNotice && !isOwner();
}

export function getRecoveryNotice() {
  return recoveryNotice;
}

function rememberRecoveryFailure(message) {
  recoveryNotice = { message };
  passwordRecovery = false;
  holdRecoveryRoute = false;
}

async function clientOf(flowType = "implicit") {
  if (!isConfigured()) return null;
  if (!client) {
    const { createClient } = await import("../vendor/supabase.js");
    const config = publicConfig();
    let storage;
    try { storage = window.localStorage; } catch { /* session en mémoire */ }
    client = createClient(config.url, config.anonKey, {
      global: {
        fetch: async (input, init = {}) => {
          const controller = new AbortController();
          const abort = () => controller.abort();
          if (init.signal?.aborted) controller.abort();
          init.signal?.addEventListener("abort", abort, { once: true });
          const timer = setTimeout(abort, 20000);
          try {
            return await fetch(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timer);
            init.signal?.removeEventListener("abort", abort);
          }
        },
      },
      auth: {
        persistSession: Boolean(storage),
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType,
        storage,
      },
    });
    client.auth.onAuthStateChange((event, session) => {
      if (event !== "PASSWORD_RECOVERY") return;
      const next = session?.user ?? null;
      if (!next || next.id !== publicConfig().ownerId) {
        rememberRecoveryFailure(
          "Ce compte n'est pas le propriétaire. L'accès reste en lecture seule.",
        );
        queueMicrotask(() => {
          signOut();
        });
        return;
      }
      user = next;
      passwordRecovery = true;
      pinRecoveryRoute();
      emit();
    });
  }
  return client;
}

function rejectForeignUser(next) {
  return Boolean(next) && next.id !== publicConfig().ownerId;
}

function replaceAuthLocation(next) {
  if (typeof window === "undefined" || next === window.location.href) return;
  window.history.replaceState(window.history.state, "", next);
}

export async function restoreSession() {
  const auth =
    typeof window === "undefined"
      ? { kind: "none", params: {} }
      : readAuthReturn(window.location.href);
  if (auth.kind === "implicit") {
    // Avant createClient : supabase-js lit window.location et ignore un second fragment.
    replaceAuthLocation(normalizeImplicitHref(window.location.href));
    holdRecoveryRoute = true;
  } else if (auth.kind === "token_hash") {
    // Le GET du scanner ne doit pas échanger le jeton. On le garde pour le bouton.
    rememberTokenHash(auth.params.token_hash);
    replaceAuthLocation(cleanAuthLocation(window.location.href, RECOVERY_HASH));
  } else if (auth.kind === "error") {
    rememberRecoveryFailure(
      recoveryErrorMessage(
        auth.params.error_code,
        auth.params.error_description,
      ),
    );
    replaceAuthLocation(cleanAuthLocation(window.location.href, RECOVERY_HASH));
  } else if (auth.kind === "pkce") {
    holdRecoveryRoute = true;
  }
  if (!isConfigured() || !hasAuthWork()) {
    user = null;
    emit();
    return null;
  }
  try {
    const supabase = await clientOf(auth.flowType || "implicit");
    const { data } = await supabase.auth.getSession();
    const next = data.session?.user ?? null;
    if (rejectForeignUser(next)) {
      await supabase.auth.signOut();
      user = null;
      if (auth.kind === "implicit" || auth.kind === "pkce") {
        rememberRecoveryFailure(
          "Ce compte n'est pas le propriétaire. L'accès reste en lecture seule.",
        );
      }
    } else {
      user = next;
    }
    if (
      (auth.kind === "implicit" || auth.kind === "pkce") &&
      !user &&
      !recoveryNotice
    ) {
      rememberRecoveryFailure(
        auth.kind === "pkce"
          ? "Ce lien n'a pas pu être vérifié dans ce navigateur. Demande un nouveau message, puis ouvre-le ici."
          : "Ce lien de réinitialisation n'a pas pu ouvrir de session. Demande un nouveau message.",
      );
      replaceAuthLocation(
        cleanAuthLocation(window.location.href, RECOVERY_HASH),
      );
    }
  } catch {
    user = null;
    if (auth.kind !== "none") {
      rememberRecoveryFailure(
        "Ce lien de réinitialisation n'a pas pu être vérifié. Demande un nouveau message.",
      );
    }
  }
  settleRecoveryLocation();
  emit();
  return user;
}

export async function signIn(email, password) {
  if (!isConfigured()) {
    return {
      ok: false,
      message: "Supabase n'est pas configuré. Le site reste en lecture seule.",
    };
  }
  const supabase = await clientOf();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error || !data?.user) {
    user = null;
    emit();
    return {
      ok: false,
      message: "Connexion refusée. Vérifie l'adresse et le mot de passe.",
    };
  }
  if (data.user.id !== publicConfig().ownerId) {
    await supabase.auth.signOut();
    user = null;
    emit();
    return {
      ok: false,
      message:
        "Ce compte n'est pas le propriétaire. L'accès reste en lecture seule.",
    };
  }
  user = data.user;
  emit();
  return { ok: true, message: "Session propriétaire ouverte." };
}

export async function signOut() {
  if (client) await client.auth.signOut();
  user = null;
  emit();
}

export function leaveRecovery(hash) {
  if (typeof window === "undefined") return;
  holdRecoveryRoute = false;
  const target = cleanAuthLocation(window.location.href, hash);
  window.location.replace(target);
}

async function assertCurrentSession(supabase, recovery) {
  try {
    const { data, error } = await supabase.auth.getUser();
    const sessionUser = data?.user ?? null;
    if (error || !sessionUser || sessionUser.id !== publicConfig().ownerId) {
      return {
        ok: false,
        message: recovery
          ? "La session de réinitialisation a expiré. Demande un nouveau lien."
          : "La session a expiré. Reconnecte-toi pour changer le mot de passe.",
      };
    }
    user = sessionUser;
    return { ok: true };
  } catch {
    return {
      ok: false,
      message: recovery
        ? "La session de réinitialisation n'a pas pu être vérifiée. Demande un nouveau lien."
        : "La session n'a pas pu être vérifiée. Reconnecte-toi, puis réessaie. Aucun e-mail n'est envoyé.",
    };
  }
}

function passwordWriteFailure(error, recovery) {
  const code = error?.code || "";
  const text = error?.message || "";
  if (code === "same_password" || /different from the old/i.test(text)) {
    return {
      ok: false,
      code,
      message: "Le nouveau mot de passe doit être différent de l'ancien.",
    };
  }
  if (
    code === "weak_password" ||
    /weak password/i.test(text) ||
    /at least/i.test(text)
  ) {
    return {
      ok: false,
      code,
      message: "Ce mot de passe est refusé. Utilise au moins 12 caractères.",
    };
  }
  if (
    code === "reauthentication_needed" ||
    code === "reauthentication_required" ||
    /reauthentication/i.test(text)
  ) {
    return {
      ok: false,
      code: code || "reauthentication_needed",
      message: recovery
        ? "La session de réinitialisation n'est plus assez récente. Demande un nouveau lien."
        : "Supabase demande une session toute récente. Déconnecte-toi, reconnecte-toi, puis réessaie ici. Aucun e-mail n'est envoyé.",
    };
  }
  if (
    /session/i.test(text) ||
    code === "session_not_found" ||
    code === "session_expired"
  ) {
    return {
      ok: false,
      code: code || "session",
      message: recovery
        ? "La session de réinitialisation a expiré. Demande un nouveau lien."
        : "La session a expiré. Reconnecte-toi pour changer le mot de passe.",
    };
  }
  if (
    error?.name === "AuthRetryableFetchError" ||
    error?.status === 0 ||
    /failed to fetch|network/i.test(text)
  ) {
    return {
      ok: false,
      code: "network",
      message:
        "Le mot de passe n'a pas pu être enregistré : le réseau ou Supabase ne répond pas. Réessaie dans un moment.",
    };
  }
  if (code) {
    return {
      ok: false,
      code,
      message: `Le mot de passe n'a pas pu être enregistré (code ${code}).`,
    };
  }
  return {
    ok: false,
    code: "unknown",
    message: "Le mot de passe n'a pas pu être enregistré.",
  };
}

async function writePassword(password, { recovery }) {
  if (!isOwner()) {
    return { ok: false, message: "Réservé au propriétaire." };
  }
  const supabase = await clientOf();
  const session = await assertCurrentSession(supabase, recovery);
  if (!session.ok) return session;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return passwordWriteFailure(error, recovery);
  } catch (error) {
    return passwordWriteFailure(error, recovery);
  }
  if (recovery) passwordSaved = true;
  else
    accountPasswordNoticeText =
      "Mot de passe mis à jour. L'ancien ne fonctionne plus. Aucun e-mail n'a été envoyé.";
  emit();
  return {
    ok: true,
    message: recovery ? "Mot de passe mis à jour." : accountPasswordNoticeText,
  };
}

export async function updatePassword(password) {
  return writePassword(password, { recovery: true });
}

export async function changePassword(password) {
  return writePassword(password, { recovery: false });
}

export { passwordResetRedirect };

export async function confirmRecoveryLink() {
  const tokenHash = readStoredTokenHash();
  if (!tokenHash) {
    const message =
      "Ce lien ne contient pas de jeton à vérifier. Demande un nouveau message.";
    rememberRecoveryFailure(message);
    emit();
    return { ok: false, message };
  }
  if (!isConfigured()) {
    return {
      ok: false,
      message:
        "Supabase n'est pas configuré : le lien ne peut pas être vérifié.",
    };
  }
  try {
    const supabase = await clientOf("implicit");
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    const next = data?.session?.user ?? null;
    if (error || !next) {
      const message = recoveryErrorMessage(error?.code, error?.message);
      rememberRecoveryFailure(message);
      forgetTokenHash();
      emit();
      return { ok: false, message };
    }
    if (rejectForeignUser(next)) {
      const message =
        "Ce compte n'est pas le propriétaire. L'accès reste en lecture seule.";
      rememberRecoveryFailure(message);
      forgetTokenHash();
      user = null;
      try {
        await supabase.auth.signOut();
      } catch {
        /* le refus est déjà affiché */
      }
      emit();
      return { ok: false, message };
    }
    user = next;
    passwordRecovery = true;
    recoveryNotice = null;
    forgetTokenHash();
    pinRecoveryRoute();
    emit();
    return { ok: true, message: "" };
  } catch {
    const message =
      "Ce lien de réinitialisation n'a pas pu être vérifié. Demande un nouveau message.";
    rememberRecoveryFailure(message);
    forgetTokenHash();
    emit();
    return { ok: false, message };
  }
}

export async function resetPassword(email, redirectTo) {
  if (!isConfigured()) {
    return {
      ok: false,
      code: "config",
      message:
        "Supabase n'est pas configuré : le message de réinitialisation ne peut pas partir.",
    };
  }
  const storage = window.localStorage;
  const target = redirectTo || passwordResetRedirect(document.baseURI);
  const claim = claimRecoverySend(storage);
  if (claim.blocked) {
    return {
      ok: false,
      code: claim.reason === "busy" ? "busy" : "cooldown",
      message:
        claim.reason === "busy"
          ? RECOVERY_EMAIL_BUSY
          : recoveryCooldownMessage(claim.remaining),
    };
  }
  try {
    const supabase = await clientOf();
    const { error } = await supabase.auth.resetPasswordForEmail(
      String(email || "").trim(),
      { redirectTo: target },
    );
    if (error) {
      const failure = resetEmailFailure(error);
      settleRecoverySend(
        storage,
        failure.code === "over_email_send_rate_limit" ? "limited" : "failed",
      );
      return failure;
    }
    settleRecoverySend(storage, "sent");
    return { ok: true, code: "sent", message: RECOVERY_EMAIL_SENT };
  } catch (error) {
    settleRecoverySend(storage, "failed");
    return resetEmailFailure(error);
  }
}

async function requireOwnerClient() {
  if (!isOwner()) throw new Error("réservé au propriétaire");
  return clientOf();
}

export async function upsertRow(table, values, onConflict) {
  const supabase = await requireOwnerClient();
  const { error } = await supabase.from(table).upsert(values, { onConflict });
  if (error) throw new Error("enregistrement refusé");
}

export async function insertRow(table, values) {
  const supabase = await requireOwnerClient();
  const { error } = await supabase.from(table).insert(values);
  if (error) throw new Error("enregistrement refusé");
}

export async function selectRows(table) {
  const supabase = await requireOwnerClient();
  const { data, error } = await supabase.from(table).select("*");
  if (error) throw new Error("lecture refusée");
  return data || [];
}

/** Écriture atomique : le serveur refuse d'écraser une révision plus récente. */
export async function saveLearningRecord(key, payload, revision) {
  const supabase = await requireOwnerClient();
  const { data, error } = await supabase.rpc("save_learning_record", {
    p_key: key,
    p_payload: payload,
    p_revision: revision,
  });
  if (error) {
    const failure = new Error("Synchronisation refusée");
    failure.code = error.code;
    throw failure;
  }
  if (!data?.[0]) throw new Error("Réponse de synchronisation absente");
  return data[0];
}
