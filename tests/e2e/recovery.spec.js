import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installOwner, OTHER_ID } from "./session.js";

const IMPLICIT = "/#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=refresh-1&token_type=bearer&type=recovery";

/** Même chaîne que GoTrue : redirect_to (avec fragment) + "#" + query triée, `sb` vide inclus. */
function gotrueImplicitRedirect(redirectTo, fields) {
  const query = Object.keys(fields)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(fields[key]).replace(/%20/g, "+")}`)
    .join("&");
  return `${redirectTo}#${query}`;
}

const DOUBLE_HASH = gotrueImplicitRedirect("http://127.0.0.1:4173/#/nouveau-mot-de-passe", {
  access_token: "aaa.bbb.ccc",
  expires_at: "1700000000",
  expires_in: "3600",
  refresh_token: "refresh-1",
  sb: "",
  token_type: "bearer",
  type: "recovery",
});

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("WebSocket") || text.includes("realtime")) return;
    errors.push(text);
  });
  return errors;
}

test("le fragment de récupération ouvre le formulaire puis l'IDE", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  await page.goto(IMPLICIT);
  await expect(page.locator("h1")).toHaveText("Choisir un nouveau mot de passe");
  await expect(page.locator("main")).not.toContainText("ne mène nulle part");
  await expect(page.locator("body")).not.toContainText("aaa.bbb.ccc");
  await expect(page).toHaveURL(/#\/nouveau-mot-de-passe$/);
  await expect(page).not.toHaveURL(/access_token|refresh_token/);

  await page.getByLabel("Nouveau mot de passe").fill("court");
  await page.getByLabel("Confirmer le mot de passe").fill("court");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.locator(".quiz-feedback")).toContainText("12 caractères");

  await page.getByLabel("Nouveau mot de passe").fill("un-mot-de-passe-solide");
  await page.getByLabel("Confirmer le mot de passe").fill("un-autre-mot-de-passe");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.locator(".quiz-feedback")).toContainText("ne correspondent pas");

  await page.getByRole("button", { name: "Afficher les mots de passe" }).click();
  await expect(page.locator("#new-password")).toHaveAttribute("type", "text");
  await expect(page.locator("#confirm-password")).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Masquer les mots de passe" }).click();
  await expect(page.locator("#new-password")).toHaveAttribute("type", "password");

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByLabel("Confirmer le mot de passe").fill("un-mot-de-passe-solide");
  await page.getByRole("button", { name: "Enregistrer le mot de passe" }).click();
  await expect(page.getByRole("status")).toContainText("Mot de passe mis à jour");
  await expect(page).toHaveURL(/#\/ide$/, { timeout: 5000 });
  await expect(page).not.toHaveURL(/access_token/);
  expect(errors).toEqual([]);
});

test("otp_expired explique le lien et permet d'en demander un autre", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  let redirectTo = "";
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/auth/v1/recover")) {
      redirectTo = new URL(request.url()).searchParams.get("redirect_to") || "";
    }
  });
  await page.goto("/#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
  await expect(page.locator("h1")).toHaveText("Choisir un nouveau mot de passe");
  await expect(page.locator("main")).toContainText("Ce lien a expiré");
  await expect(page).toHaveURL(/#\/nouveau-mot-de-passe$/);
  await expect(page).not.toHaveURL(/error_code/);
  await expect(page.locator("#new-password")).toHaveCount(0);

  await page.goto("/?error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired#/connexion");
  await expect(page.locator("main")).toContainText("Ce lien a expiré");
  await expect(page).not.toHaveURL(/otp_expired/);

  await page.getByLabel("Adresse e-mail").fill("patrik@example.com");
  await page.getByRole("button", { name: "Envoyer un nouveau lien" }).click();
  await expect(page.locator(".quiz-feedback")).toContainText("message de réinitialisation");
  expect(decodeURIComponent(redirectTo)).toBe("http://127.0.0.1:4173/?recovery=1");
  expect(errors).toEqual([]);
});

test("le double fragment réel de Supabase ouvre le formulaire", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  await page.addInitScript(() => {
    window.__arrivalHref = location.href;
  });
  expect(DOUBLE_HASH).toContain("#/nouveau-mot-de-passe#access_token=aaa.bbb.ccc");
  expect(new URL(DOUBLE_HASH).hash.slice(1).includes("#")).toBe(true);
  expect(new URLSearchParams(new URL(DOUBLE_HASH).hash.slice(1)).get("access_token")).toBeNull();

  await page.goto(DOUBLE_HASH);
  const arrival = await page.evaluate(() => window.__arrivalHref);
  expect(arrival).toContain("#/nouveau-mot-de-passe#access_token=aaa.bbb.ccc");
  expect(arrival).toContain("refresh_token=refresh-1");
  await expect(page.locator("h1")).toHaveText("Choisir un nouveau mot de passe");
  await expect(page.locator("#new-password")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("n'a pas pu servir");
  await expect(page.locator("main")).not.toContainText("n'a pas fonctionné");
  await expect(page.locator("body")).not.toContainText("aaa.bbb.ccc");
  await expect(page).toHaveURL(/#\/nouveau-mot-de-passe$/);
  await expect(page).not.toHaveURL(/access_token|refresh_token/);
  expect(errors).toEqual([]);
});

test("un token_hash n'est échangé qu'au clic", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  const verifies = [];
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/auth/v1/verify")) {
      verifies.push(request.postDataJSON());
    }
  });
  await page.goto("/?token_hash=hash-1&type=recovery");
  await expect(page.getByRole("button", { name: "Vérifier le lien" })).toBeVisible();
  await expect(page.locator("#new-password")).toHaveCount(0);
  await expect(page).not.toHaveURL(/token_hash/);
  expect(verifies).toEqual([]);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  await page.getByRole("button", { name: "Vérifier le lien" }).click();
  await expect(page.locator("#new-password")).toBeVisible();
  expect(verifies).toHaveLength(1);
  expect(verifies[0].token_hash).toBe("hash-1");
  expect(verifies[0].type).toBe("recovery");
  await expect(page).not.toHaveURL(/token_hash/);
  expect(errors).toEqual([]);
});

test("un token_hash expiré ou d'un autre compte n'ouvre pas le formulaire", async ({ page }) => {
  await installOwner(page);
  await page.goto("/?token_hash=expired-token&type=recovery");
  await page.getByRole("button", { name: "Vérifier le lien" }).click();
  await expect(page.locator("main")).toContainText("Ce lien a expiré");
  await expect(page.locator("#new-password")).toHaveCount(0);

  await installOwner(page, { userId: OTHER_ID });
  await page.goto("/?token_hash=hash-1&type=recovery");
  await page.getByRole("button", { name: "Vérifier le lien" }).click();
  await expect(page.locator("main")).toContainText("pas le propriétaire");
  await expect(page.locator("#new-password")).toHaveCount(0);
});

test("le code PKCE ouvre la même page sans être avalé par la route", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  await page.addInitScript(() => {
    localStorage.setItem(
      "sb-example-auth-token-code-verifier",
      JSON.stringify("verifier-secret/recovery"),
    );
  });
  await page.goto("/?code=the-code#/connexion");
  await expect(page.locator("h1")).toHaveText("Choisir un nouveau mot de passe", { timeout: 15000 });
  await expect(page.locator("#new-password")).toBeVisible();
  await expect(page).toHaveURL(/#\/nouveau-mot-de-passe$/);
  await expect(page).not.toHaveURL(/[?&]code=/);
  await expect(page.locator("body")).not.toContainText("the-code");
  expect(errors).toEqual([]);
});

test("un autre compte ne choisit pas le mot de passe du propriétaire", async ({ page }) => {
  await installOwner(page, { userId: OTHER_ID });
  await page.goto(IMPLICIT);
  await expect(page.locator("main")).toContainText("pas le propriétaire");
  await expect(page.locator("#new-password")).toHaveCount(0);
});

test("mot de passe oublié envoie le redirectTo de la route dédiée", async ({ page }) => {
  await installOwner(page);
  let redirectTo = "";
  page.on("request", (request) => {
    if (request.method() === "POST" && request.url().includes("/auth/v1/recover")) {
      redirectTo = new URL(request.url()).searchParams.get("redirect_to") || "";
    }
  });
  await page.goto("/#/connexion");
  await page.getByRole("button", { name: "Mot de passe oublié" }).click();
  await expect(page.locator(".quiz-feedback")).toContainText("adresse du compte");
  await page.getByLabel("Adresse e-mail").fill("patrik@example.com");
  await page.getByRole("button", { name: "Mot de passe oublié" }).click();
  await expect(page.locator(".quiz-feedback")).toContainText("message de réinitialisation");
  const target = decodeURIComponent(redirectTo);
  expect(target).toBe("http://127.0.0.1:4173/?recovery=1");
  expect(target.includes("#")).toBe(false);
});
