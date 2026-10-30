import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installOwner, OWNER_ID, signInAs } from "./session.js";

test("le visiteur reste en lecture seule", async ({ page }) => {
  const hits = [];
  const errors = [];
  page.on("request", (request) => {
    if (request.url().includes("supabase.co")) hits.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/#/connexion");
  await expect(page.locator("h1")).toHaveText("Compte propriétaire");
  await expect(page.locator("#login-email")).toBeVisible();
  await expect(page.locator("#login-password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Se connecter" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Mot de passe oublié" })).toBeVisible();
  await page.goto("/#/lecon/1.6");
  await expect(page.locator(".lock-note")).toContainText("Réservé au propriétaire");
  await expect(page.locator("[data-choice='0']")).toBeDisabled();
  await expect(page.getByRole("button", { name: "Ouvrir dans l'IDE" })).toHaveCount(0);
  await page.getByRole("button", { name: "Activer le thème clair" }).click();
  await page.goto("/#/ide");
  await expect(page.locator("#ide-lock")).toContainText("Réservé au propriétaire");
  await expect(page.locator("#ide-run")).toBeDisabled();
  const storage = await page.evaluate(async () => ({
    keys: Object.keys(localStorage),
    databases: (await indexedDB.databases()).map((item) => item.name),
  }));
  expect(storage.keys.filter((key) => key !== "afz-theme")).toEqual([]);
  expect(storage.databases).not.toContain("afz-ide");
  expect(hits).toEqual([]);
  expect(errors).toEqual([]);
});

test("un autre compte ne déverrouille pas, le propriétaire oui", async ({ page }) => {
  const writes = await installOwner(page);
  await signInAs(page, "autre@example.com");
  await page.goto("/#/ide");
  await expect(page.locator("#ide-run")).toBeDisabled();
  await signInAs(page);
  await page.goto("/#/donnees");
  await expect(page.locator("h1")).toHaveText("Catalogue des jeux");
  await page.locator("#stage-filter").selectOption("6");
  await expect(page.locator("article[data-dataset-id='piaf']")).toBeVisible();
  await expect(page.locator("article[data-dataset-id='tinystories']")).toHaveCount(0);
  await page.locator("#stage-filter").selectOption("tous");
  await page.locator("#language-filter").selectOption("fr");
  await expect(page.locator("article[data-dataset-id='tinystories']")).toHaveCount(0);
  await expect(page.locator("article[data-dataset-id='pg-candide']")).toBeVisible();
  await page.locator("#language-filter").selectOption("tous");
  await page.locator("#config-tokenizer").selectOption("char");
  await page.locator("#config-runtime").selectOption("browser");
  await expect(page.locator("article[data-dataset-id='frwiki'] .compat-warning")).toContainText("navigateur");
  await expect(page.locator("article[data-dataset-id='piaf'] .compat-warning")).toContainText("caractère");
  await page.locator("article[data-dataset-id='jouet-francais'] input").check();
  await page.locator("#save-plan").click();
  await expect(page.locator("#plan-status")).toContainText("Plan enregistré");
  const saved = writes.filter((request) => request.url().includes("/rest/v1/training_plans"));
  expect(saved.length).toBeGreaterThan(0);
  const request = saved.at(-1);
  expect(request.url()).toContain("on_conflict=id");
  expect(request.headers().prefer || "").toContain("merge-duplicates");
  expect(request.headers().authorization || "").toContain("token-");
  expect(request.postDataJSON().dataset_ids).toContain("jouet-francais");
  expect(OWNER_ID.length).toBeGreaterThan(8);
});

test("la déconnexion referme la session", async ({ page }) => {
  await installOwner(page);
  await signInAs(page);
  await page.goto("/#/connexion");
  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page.locator("h1")).toHaveText("Compte propriétaire");
  await page.goto("/#/lecon/1.6");
  await expect(page.locator("[data-choice='0']")).toBeDisabled();
});

test("le catalogue, le playground, l'à propos et une figure passent axe", async ({ page }) => {
  await page.goto("/#/donnees");
  await expect(page.locator("h1")).toHaveText("Catalogue des jeux");
  await page.locator("#size-filter").selectOption("petit");
  await expect(page.locator("article[data-dataset-id='jouet-francais']")).toBeVisible();
  let results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/#/a-propos");
  await expect(page.locator("h1")).toHaveText("Patrik Skala");
  await expect(page.locator("main")).toContainText("ENI");
  await expect(page.locator("main")).toContainText("23 novembre 2026");
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/#/playground");
  await expect(page.locator("h1")).toHaveText("Playground");
  results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.goto("/#/lecon/2.5");
  const tokenizer = page.locator('[data-lab="tokenizer"]');
  await tokenizer.getByLabel('Texte à découper').fill('chat chat');
  await expect(tokenizer).toContainText('Le vocabulaire reste fixe');
  await expect(tokenizer.locator('.visual-readout').last()).toContainText('Décodage : « chat chat »');
  await page.goto('/#/lecon/0.1');
  const program = page.locator('[data-lab="program"]');
  await expect(program.locator('.lab-stage')).toContainText('texte chargé');
  await program.getByRole('button', { name: 'Étape suivante', exact: true }).click();
  await expect(program.locator('.lab-stage')).toContainText('texte + IDs');
});

test("le propriétaire ouvre l'IDE, importe le modèle, entraîne et s'arrête", async ({ page }) => {
  test.setTimeout(240_000);
  const writes = await installOwner(page);
  await signInAs(page);
  await page.goto("/#/lecon/13.1");
  await page.getByRole("button", { name: "Ouvrir dans l'IDE" }).click();
  await expect(page).toHaveURL(/#\/ide$/);
  await expect(page.locator(".cm-content, #ide-fallback")).toBeVisible();
  const editor = page.locator(".cm-content");
  if (await editor.count()) {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("print('bonjour ide')\n");
  } else {
    await page.locator("#ide-fallback").fill("print('bonjour ide')\n");
  }
  await page.locator("#ide-run").click();
  await expect(page.locator("#ide-output")).toContainText("bonjour ide", { timeout: 180_000 });
  if (await editor.count()) {
    await editor.click();
    await page.keyboard.press("Control+A");
    await page.keyboard.insertText("import model\nprint(model.__version__)\n");
  } else {
    await page.locator("#ide-fallback").fill("import model\nprint(model.__version__)\n");
  }
  await page.locator("#ide-run").click();
  await expect(page.locator("#ide-output")).toContainText("1.0.0", { timeout: 180_000 });
  await page.locator("#ide-train").click();
  await expect(page.locator("#ide-loss")).toContainText("Pas", { timeout: 180_000 });
  await expect(page.locator("#ide-chart .loss-bar").first()).toBeVisible();
  await page.locator("#ide-train-stop").click();
  await page.locator("#ide-save").click();
  const codeWrites=()=>writes.filter(request=>request.url().includes('/rpc/save_learning_record')&&request.postDataJSON().p_key.startsWith('ide/'));
  await expect.poll(()=>codeWrites().length).toBeGreaterThan(0);
  const saved=codeWrites().at(-1);
  expect(saved.postDataJSON().p_payload.content.length).toBeGreaterThan(0);
});
