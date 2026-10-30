import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installOwner, signInAs } from "./session.js";

const ROUTES = [
  ["/", /architecture/],
  ["/#/accueil", /architecture/],
  ["/#/parcours", /architecture|niveaux|Fondations/],
  ["/#/niveau/0", /Fondations numériques/],
  ["/#/niveau/13", /.+/],
  ["/#/lecon/0.1", /.+/],
  ["/#/lecon/4.5", /.+/],
  ["/#/modele", /Architecture évolutive/],
  ["/#/construire", /Construire ton LLM/],
  ["/#/playground", /Playground/],
  ["/#/ide", /IDE/],
  ["/#/connexion", /Compte propriétaire/],
  ["/#/changer-mot-de-passe", /Changer mon mot de passe/],
  ["/#/nouveau-mot-de-passe", /Choisir un nouveau mot de passe/],
  ["/#/donnees", /Catalogue des jeux/],
];

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (text.includes("WebSocket") || text.includes("favicon")) return;
    errors.push(text);
  });
  return errors;
}

async function headerFits(page) {
  const box = await page.locator(".topbar").evaluate((el) => {
    const name = el.querySelector(".brand-name");
    const search = el.querySelector("#search-open");
    const nameRect = name.getBoundingClientRect();
    const searchRect = search.getBoundingClientRect();
    return {
      lines: name.getClientRects().length,
      text: name.textContent.trim(),
      gap: searchRect.left - nameRect.right,
      sameRow: Math.abs(nameRect.top - searchRect.top) < 24,
    };
  });
  expect(box.text).toBe("AI From Zero");
  expect(box.lines).toBe(1);
  expect(box.sameRow).toBe(true);
  expect(box.gap).toBeGreaterThan(0);
}

test("chaque route publique s'ouvre, au bureau et sur un iPhone", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    for (const [url, title] of ROUTES) {
      await page.goto(url);
      await expect(page.locator("h1")).toBeVisible();
      await expect(page.locator("h1")).not.toHaveText("Cette adresse ne mène nulle part");
      await expect(page.locator("h1")).toHaveText(title);
      if (viewport.width === 390) await headerFits(page);
    }
  }
  await page.goto("/#/nulle-part");
  await expect(page.locator("h1")).toHaveText("Cette adresse ne mène nulle part");
  expect(errors).toEqual([]);
});

test("l'en-tête mobile reste sur une ligne", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("architecture");
  await headerFits(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: "docs/images/entete-mobile.png", animations: "disabled" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/#/connexion");
  await expect(page.locator("#recovery-hint")).toContainText("indésirables");
  await page.screenshot({ path: "docs/images/connexion-bureau.png", animations: "disabled" });
});

test("la progression, le quiz, le plan et l'IDE reviennent de Supabase", async ({ page }) => {
  await installOwner(page, {
    tables: {
      progress: [{ id: 1, done: ["0.1"] }],
      quiz_results: [{ lesson_id: "0.1", choice: 1, correct: false }],
      training_plans: [{ id: 1, dataset_ids: ["piaf"] }],
      ide_files: [{ path: "model/__init__.py", content: "print('depuis-supabase')\n" }],
    },
  });
  await signInAs(page);
  await page.goto("/#/");
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  await page.goto("/#/lecon/0.1");
  await expect(page.locator("[data-choice='1']")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/#/donnees");
  await expect(page.locator("article[data-dataset-id='piaf'] input")).toBeChecked();
  await page.goto("/#/ide");
  await page.getByRole("treeitem", { name: "__init__.py" }).click();
  await expect(page.locator(".cm-content, #ide-fallback")).toContainText("depuis-supabase", { timeout: 20000 });
});
