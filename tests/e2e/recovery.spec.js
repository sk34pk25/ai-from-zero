import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installOwner, OTHER_ID } from "./session.js";

const IMPLICIT = "/#access_token=aaa.bbb.ccc&expires_in=3600&refresh_token=refresh-1&token_type=bearer&type=recovery";

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
  expect(decodeURIComponent(redirectTo)).toContain("#/nouveau-mot-de-passe");
  expect(errors).toEqual([]);
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
  expect(target).toBe("http://127.0.0.1:4173/#/nouveau-mot-de-passe");
});
