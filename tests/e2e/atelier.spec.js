import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { installOwner, signInAs } from "./session.js";

const spec = JSON.parse(
  readFileSync(new URL("../../data/atelier.json", import.meta.url), "utf8"),
);

test("atelier public : consignes, douze TP et archive autonome", async ({
  page,
}) => {
  await page.goto("/#/atelier");
  await expect(page.locator("h1")).toHaveText("Atelier : mon premier GPT");
  await expect(page.locator(".track-list > li")).toHaveCount(12);
  await expect(page.getByLabel("Document de l’atelier")).toContainText(
    "Installer ton atelier",
  );
  await page.getByText("Guides, installation et dossier final", {exact:true}).click();
  await page
    .getByLabel("Guide de l’atelier")
    .selectOption("atelier/PROJET_FINAL.md");
  await expect(page.getByLabel("Document de l’atelier")).toContainText(
    "relecture /20",
  );
  const [download] = await Promise.all([
    // Le nouveau guide doit aussi être proposé dans l'interface et présent dans le ZIP.
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Télécharger mon atelier (.zip)" })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("mon-llm.zip");
  await page.getByRole("button", { name: "Ouvrir le dossier final", exact: true }).click();
  await expect(page.getByLabel("Guide de l’atelier")).toHaveValue("atelier/DOSSIER_MODELE.md");
  await expect(page.getByLabel("Document de l’atelier")).toContainText("Mon dossier de modèle");
  await expect(page.getByLabel("Document de l’atelier")).toContainText("Note /4 après relecture");
  const path = await download.path();
  const bytes = readFileSync(path);
  for (const name of spec.files)
    expect(bytes.includes(Buffer.from(`mon-llm/${name.slice(8)}`))).toBe(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Projet prêt" }),
  ).toBeVisible();
});

test("la navigation applique le parcours choisi et le conserve au rechargement", async ({ page }) => {
  await page.goto("/#/lecon/4.14");
  await expect(page.locator('main a[href="#/lecon/13.3"]').last()).toBeVisible();
  await page.goto("/#/atelier");
  await page.getByLabel("Mon parcours", { exact: true }).selectOption("all");
  await page.goto("/#/lecon/4.14");
  await expect(page.locator('main a[href="#/lecon/5.1"]').last()).toBeVisible();
  await page.reload();
  await expect(page.locator('main a[href="#/lecon/5.1"]').last()).toBeVisible();
});

test("les preuves d'atelier restent distinctes de la lecture et sont sauvegardées", async ({ page }) => {
  const history = [{ prompt: "le ", text: "le chat", seconds: 1, tokens: 2 }];
  await installOwner(page, { tables: { learning_records: [{ key: "experiments", payload: history, revision: 1 }] } });
  await signInAs(page);
  await page.goto("/#/espace");
  await page.getByLabel("Rapport de contrôles de mon atelier").setInputFiles({ name: "controles.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ format: "afz-atelier-checks-v1", module: "eleve", source_sha256: "b".repeat(64), total: 1, reussis: 1, controles: [{ tp: 5, ok: true }] })) });
  await expect(page.getByText("1 contrôles publics réussis", { exact: false })).toBeVisible();
  await page.getByLabel("Je peux expliquer le TP 5 sur un exemple nouveau", { exact: true }).check();
  await expect(page.getByText("1 explications déclarées", { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Je peux expliquer le TP 5 sur un exemple nouveau", { exact: true })).toBeChecked();
  await expect(page.locator("#progress-meta")).toContainText("Aucune étape terminée");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter mes données", exact: true }).click()]);
  const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(backup.records.experiments).toEqual(history);
  expect(backup.records.preferences.project.explained["5"]).toBe(true);
});

test("atelier lisible à petit écran et accessible au clavier", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#/atelier");
  await expect(page.getByLabel("Document de l’atelier")).toContainText(
    "Installer",
  );
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.evaluate(() => (document.documentElement.style.zoom = "1"));
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("le cours renvoie au TP et à sa vraie fonction ; les bilans diffèrent", async ({
  page,
}) => {
  await page.goto("/#/lecon/13.4");
  await expect(page.locator(".callout-build")).toContainText(
    "model/export_js.py",
  );
  await expect(page.locator(".callout-build")).toContainText("export_browser");
  await page.goto("/#/niveau/4");
  await expect(page.locator(".checkpoint-criterion")).toHaveCount(4);
  await expect(page.locator(".checkpoint-criterion")).toContainText([
    /Assembler/,
    /gradient/,
    /Entraîner/,
    /validation/,
  ]);
});

test("mes rapports d’atelier et de plan SFT se comparent sans envoyer le fichier", async ({
  page,
}) => {
  await page.goto("/#/experiences");
  await expect(
    page.getByRole("cell", {
      name: "Atelier de référence · phrases synthétiques",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByLabel("Ajouter un rapport local")
    .setInputFiles({
      name: "plan-local.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "afz-training-plan-v1",
          items: [
            {
              mode: "sft",
              loss_end: 7,
              train_evaluation: { loss: 3.1 },
              validation_loss_end: 4.2,
              evaluation: "validation réservée",
            },
          ],
        }),
      ),
    });
  const row = page
    .getByRole("row")
    .filter({ hasText: "plan-local.json · phase 1" });
  await expect(row).toContainText("3,1");
  await expect(row).toContainText("4,2");
  await expect(row).toContainText("validation réservée");
});
