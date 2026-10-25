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

const listeners = new Set();
let client = null;
let user = null;

export function publicConfig() {
  return {
    url: String(SUPABASE_URL || "").trim(),
    anonKey: String(SUPABASE_ANON_KEY || "").trim(),
    ownerId: String(OWNER_ID || "").trim(),
  };
}

export function isConfigured(config = publicConfig()) {
  return config.url.startsWith("https://") && config.anonKey.length >= 20 && config.ownerId.length >= 8;
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

async function clientOf() {
  if (!isConfigured()) return null;
  if (!client) {
    const { createClient } = await import("../vendor/supabase.js");
    const config = publicConfig();
    client = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
    });
  }
  return client;
}

export async function restoreSession() {
  if (!isConfigured()) {
    user = null;
    return null;
  }
  const supabase = await clientOf();
  const { data } = await supabase.auth.getSession();
  const next = data.session?.user ?? null;
  if (next && next.id !== publicConfig().ownerId) {
    await supabase.auth.signOut();
    user = null;
  } else {
    user = next;
  }
  emit();
  return user;
}

export async function signIn(email, password) {
  if (!isConfigured()) {
    return { ok: false, message: "Supabase n'est pas configuré. Le site reste en lecture seule." };
  }
  const supabase = await clientOf();
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data?.user) {
    user = null;
    emit();
    return { ok: false, message: "Connexion refusée. Vérifie l'adresse et le mot de passe." };
  }
  if (data.user.id !== publicConfig().ownerId) {
    await supabase.auth.signOut();
    user = null;
    emit();
    return { ok: false, message: "Ce compte n'est pas le propriétaire. L'accès reste en lecture seule." };
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

export async function resetPassword(email, redirectTo) {
  if (!isConfigured()) {
    return { ok: false, message: "Supabase n'est pas configuré : le message de réinitialisation ne peut pas partir." };
  }
  const supabase = await clientOf();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  if (error) return { ok: false, message: "Le message n'a pas pu être envoyé." };
  return { ok: true, message: "Si ce compte existe, un message de réinitialisation a été envoyé." };
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
