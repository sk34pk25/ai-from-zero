import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";

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
  await page
    .getByLabel("Guide de l’atelier")
    .selectOption("atelier/PROJET_FINAL.md");
  await expect(page.getByLabel("Document de l’atelier")).toContainText(
    "relecture /20",
  );
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page
      .getByRole("button", { name: "Télécharger mon atelier (.zip)" })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("mon-llm.zip");
  const path = await download.path();
  const bytes = readFileSync(path);
  for (const name of spec.files)
    expect(bytes.includes(Buffer.from(`mon-llm/${name.slice(8)}`))).toBe(true);
  await expect(
    page.getByRole("status").filter({ hasText: "Projet prêt" }),
  ).toBeVisible();
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
