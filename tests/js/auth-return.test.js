import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanAuthLocation,
  isEmailAddress,
  normalizeImplicitHref,
  passwordProblems,
  passwordResetRedirect,
  readAuthReturn,
  recoveryErrorMessage,
} from "../../assets/js/auth-return.js";

const site = "https://sk34pk25.github.io/ai-from-zero/";

/** Même concaténation que GoTrue `AccessTokenResponse.AsRedirectURL` : `redirect + "#" + Encode()`. */
function gotrueImplicitRedirect(redirectTo, fields) {
  const query = Object.keys(fields)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key]).replace(/%20/g, "+")}`)
    .join("&");
  return `${redirectTo}#${query}`;
}

const GO_FIELDS = {
  access_token: "aaa.bbb.ccc",
  expires_at: "1700000000",
  expires_in: "3600",
  refresh_token: "refresh-1",
  sb: "",
  token_type: "bearer",
  type: "recovery",
};

test("le fragment implicite n'est pas une route, le code PKCE reste lisible", () => {
  const implicit = readAuthReturn(`${site}#access_token=aaa&refresh_token=bbb&expires_in=3600&token_type=bearer&type=recovery`);
  assert.equal(implicit.kind, "implicit");
  assert.equal(implicit.type, "recovery");
  assert.equal(implicit.flowType, "implicit");
  assert.equal(implicit.params.refresh_token, "bbb");

  const beside = readAuthReturn(`${site}#/nouveau-mot-de-passe&access_token=aaa&refresh_token=bbb&type=recovery`);
  assert.equal(beside.kind, "implicit");
  assert.equal(beside.route, "/nouveau-mot-de-passe");

  const pkce = readAuthReturn(`${site}?code=auth-code&sb_flow_id=flow#/nouveau-mot-de-passe`);
  assert.equal(pkce.kind, "pkce");
  assert.equal(pkce.flowType, "pkce");
  assert.equal(pkce.params.code, "auth-code");
  assert.equal(pkce.route, "/nouveau-mot-de-passe");

  const route = readAuthReturn(`${site}#/connexion`);
  assert.equal(route.kind, "none");
  assert.equal(route.route, "/connexion");

  const lesson = readAuthReturn(`${site}#/lecon/0.10`);
  assert.equal(lesson.kind, "none");
  assert.equal(lesson.route, "/lecon/0.10");
});

test("otp_expired a un message français et l'URL nettoyée ne garde pas le jeton", () => {
  assert.match(recoveryErrorMessage("otp_expired", "Email link is invalid or has expired"), /expiré/);
  assert.match(recoveryErrorMessage("", "Email link is invalid or has expired"), /expiré/);
  assert.match(recoveryErrorMessage("access_denied"), /plus valable/);
  const dirty = `${site}?code=abc&error_code=otp_expired#error=access_denied&error_code=otp_expired`;
  const clean = cleanAuthLocation(dirty);
  assert.equal(clean, `${site}#/nouveau-mot-de-passe`);
  assert.equal(clean.includes("otp_expired"), false);
  assert.equal(clean.includes("code="), false);
});

test("redirectTo n'a pas de fragment, le sous-chemin GitHub Pages reste", () => {
  assert.equal(passwordResetRedirect(site), `${site}?recovery=1`);
  assert.equal(passwordResetRedirect(site).includes("#"), false);
  assert.equal(
    passwordResetRedirect("https://sk34pk25.github.io/ai-from-zero/index.html"),
    `${site}?recovery=1`,
  );
  assert.equal(
    passwordResetRedirect("https://sk34pk25.github.io/ai-from-zero/?utm=1#/connexion"),
    `${site}?recovery=1`,
  );
  assert.equal(passwordResetRedirect("http://127.0.0.1:4173/"), "http://127.0.0.1:4173/?recovery=1");
});

test("le double fragment de GoTrue garde access_token, URLSearchParams non", () => {
  const redirectTo = `${site}#/nouveau-mot-de-passe`;
  const built = gotrueImplicitRedirect(redirectTo, GO_FIELDS);
  assert.equal(
    built,
    `${site}#/nouveau-mot-de-passe#access_token=aaa.bbb.ccc&expires_at=1700000000&expires_in=3600&refresh_token=refresh-1&sb=&token_type=bearer&type=recovery`,
  );
  const hash = new URL(built).hash.slice(1);
  assert.equal(hash.includes("#"), true);
  assert.equal(new URLSearchParams(hash).get("access_token"), null);
  assert.equal(new URLSearchParams(hash).get("refresh_token"), "refresh-1");

  const parsed = readAuthReturn(built);
  assert.equal(parsed.kind, "implicit");
  assert.equal(parsed.type, "recovery");
  assert.equal(parsed.params.access_token, "aaa.bbb.ccc");
  assert.equal(parsed.params.refresh_token, "refresh-1");
  assert.equal(parsed.params.expires_in, "3600");
  assert.equal(parsed.params.token_type, "bearer");
  assert.equal(parsed.route, "/nouveau-mot-de-passe");
  assert.notEqual(parsed.kind, "error");

  const encoded = `${site}#/nouveau-mot-de-passe%23access_token=aaa.bbb.ccc&expires_at=1700000000&expires_in=3600&refresh_token=refresh-1&sb=&token_type=bearer&type=recovery`;
  const fromEncoded = readAuthReturn(encoded);
  assert.equal(fromEncoded.kind, "implicit");
  assert.equal(fromEncoded.params.access_token, "aaa.bbb.ccc");

  const normalized = normalizeImplicitHref(built);
  const normalizedHash = new URL(normalized).hash.slice(1);
  assert.equal(normalizedHash.includes("#"), false);
  const readable = new URLSearchParams(normalizedHash);
  assert.equal(readable.get("access_token"), "aaa.bbb.ccc");
  assert.equal(readable.get("refresh_token"), "refresh-1");
  assert.equal(readable.get("expires_in"), "3600");
  assert.equal(readable.get("token_type"), "bearer");
  assert.equal(readable.get("type"), "recovery");

  const single = gotrueImplicitRedirect(`${site}?recovery=1`, GO_FIELDS);
  assert.equal(new URL(single).hash.slice(1).includes("#"), false);
  assert.equal(new URLSearchParams(new URL(single).hash.slice(1)).get("access_token"), "aaa.bbb.ccc");
  assert.equal(readAuthReturn(single).kind, "implicit");
  assert.equal(normalizeImplicitHref(single), single);

  const half = readAuthReturn(`${site}#refresh_token=refresh-1&type=recovery`);
  assert.equal(half.kind, "error");
  assert.equal(
    recoveryErrorMessage(half.params.error_code, half.params.error_description),
    "Ce lien de réinitialisation n'a pas fonctionné. Demande un nouveau message.",
  );
});

test("token_hash reste un jeton à confirmer, pas une session", () => {
  const href = `${site}?token_hash=hash-1&type=recovery`;
  const parsed = readAuthReturn(href);
  assert.equal(parsed.kind, "token_hash");
  assert.equal(parsed.params.token_hash, "hash-1");
  assert.equal(parsed.type, "recovery");
  assert.equal(cleanAuthLocation(href).includes("token_hash"), false);
  assert.equal(cleanAuthLocation(`${site}?recovery=1#access_token=aaa`), `${site}#/nouveau-mot-de-passe`);
});

test("le mot de passe exige 12 caractères et la même confirmation", () => {
  assert.match(passwordProblems("court", "court"), /12 caractères/);
  assert.match(passwordProblems("un-mot-de-passe", "un-autre-mot"), /correspondent/);
  assert.equal(passwordProblems("un-mot-de-passe", "un-mot-de-passe"), "");
  assert.equal(isEmailAddress("patrik@example.com"), true);
  assert.equal(isEmailAddress("patrik"), false);
  assert.equal(isEmailAddress(""), false);
});
