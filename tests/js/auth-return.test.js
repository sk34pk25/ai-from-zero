import assert from "node:assert/strict";
import test from "node:test";

import {
  cleanAuthLocation,
  isEmailAddress,
  passwordProblems,
  passwordResetRedirect,
  readAuthReturn,
  recoveryErrorMessage,
} from "../../assets/js/auth-return.js";

const site = "https://sk34pk25.github.io/ai-from-zero/";

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

test("redirectTo respecte le sous-chemin GitHub Pages", () => {
  assert.equal(passwordResetRedirect(site), `${site}#/nouveau-mot-de-passe`);
  assert.equal(
    passwordResetRedirect("https://sk34pk25.github.io/ai-from-zero/index.html"),
    `${site}#/nouveau-mot-de-passe`,
  );
  assert.equal(
    passwordResetRedirect("https://sk34pk25.github.io/ai-from-zero/?utm=1#/connexion"),
    `${site}#/nouveau-mot-de-passe`,
  );
  assert.equal(passwordResetRedirect("http://127.0.0.1:4173/"), "http://127.0.0.1:4173/#/nouveau-mot-de-passe");
});

test("le mot de passe exige 12 caractères et la même confirmation", () => {
  assert.match(passwordProblems("court", "court"), /12 caractères/);
  assert.match(passwordProblems("un-mot-de-passe", "un-autre-mot"), /correspondent/);
  assert.equal(passwordProblems("un-mot-de-passe", "un-mot-de-passe"), "");
  assert.equal(isEmailAddress("patrik@example.com"), true);
  assert.equal(isEmailAddress("patrik"), false);
  assert.equal(isEmailAddress(""), false);
});
