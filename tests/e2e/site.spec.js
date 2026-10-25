import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const curriculum = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
const lessons = curriculum.levels.flatMap((level) => level.steps);

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function axe(page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

test("l'accueil s'affiche et la navigation ouvre un niveau", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("architecture");
  await expect(page.locator("#progress-meta")).toHaveText("Aucune étape terminée");
  await page.locator("#course-nav a", { hasText: "Fondations numériques" }).click();
  await expect(page).toHaveURL(/#\/niveau\/0$/);
  await expect(page.locator("h1")).toHaveText("Fondations numériques");
  await expect(page.locator(".chapter")).toHaveCount(20);
  expect(errors).toEqual([]);
});

test("chaque leçon s'ouvre sans erreur de console", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/#/lecon/0.1");
  await expect(page.locator("[data-lesson-id='0.1']")).toBeVisible();
  for (const lesson of lessons) {
    await page.evaluate((id) => {
      location.hash = `#/lecon/${id}`;
    }, lesson.id);
    await expect(page.locator(`[data-lesson-id="${lesson.id}"]`)).toBeVisible();
    await expect(page.locator("h1")).toHaveText(lesson.title);
    await expect(page.getByRole("heading", { name: "Fil rouge" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Quiz" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("le quiz refuse une mauvaise réponse puis enregistre la bonne", async ({ page }) => {
  const lesson = lessons.find((item) => item.id === "1.6");
  const wrong = (lesson.quiz.answer + 1) % 4;
  await page.goto(`/#/lecon/${lesson.id}`);
  const complete = page.getByRole("button", { name: "Marquer comme terminée" });
  await expect(complete).toBeDisabled();
  await page.locator(`[data-choice="${wrong}"]`).click();
  await expect(page.locator(".quiz-feedback")).toContainText("Ce n'est pas la bonne réponse");
  await expect(complete).toBeDisabled();
  await expect(page.locator(".quiz-feedback")).not.toContainText(lesson.quiz.explanation);
  await page.locator(`[data-choice="${lesson.quiz.answer}"]`).click();
  await expect(page.locator(".quiz-feedback")).toContainText("Bonne réponse");
  await complete.click();
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  await page.reload();
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  await expect(page.getByRole("button", { name: "Retirer des étapes terminées" })).toBeVisible();
});

test("la recherche se pilote au clavier", async ({ page }) => {
  await page.goto("/");
  await page.locator("#search-kbd").waitFor();
  await expect(page.locator("#search-kbd")).toHaveText("Ctrl K");
  await page.keyboard.press("Control+k");
  const input = page.locator("#search-input");
  await expect(input).toBeFocused();
  await input.fill("selectivite");
  await expect(page.locator("#search-results [role='option']").first()).toContainText("sélectivité");
  await input.fill("attention");
  await expect.poll(async () => page.locator("#search-results [role='option']").count()).toBeGreaterThan(1);
  const before = await input.getAttribute("aria-activedescendant");
  await input.press("ArrowDown");
  const after = await input.getAttribute("aria-activedescendant");
  expect(after).not.toBe(before);
  await input.press("Enter");
  await expect(page).toHaveURL(/#\/lecon\//);
  await expect(page.locator("#search-dialog")).toBeHidden();
});

test("Échap ferme la recherche et le thème survit au rechargement", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Rechercher dans le parcours" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#search-dialog")).toBeHidden();
  await page.getByRole("button", { name: "Activer le thème clair" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("le bouton retour revient à l'accueil", async ({ page }) => {
  await page.goto("/");
  await page.goto("/#/lecon/4.5");
  await expect(page.locator("[data-lesson-id='4.5']")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator("h1")).toContainText("architecture");
});

test("le menu mobile s'ouvre", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const menu = page.getByRole("button", { name: "Ouvrir le menu du parcours" });
  await expect(menu).toBeVisible();
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await page.locator("#course-nav a", { hasText: "Multimodal" }).click();
  await expect(page).toHaveURL(/#\/niveau\/9$/);
  await expect(page.locator(".chapter")).toHaveCount(9);
});

test("axe ne signale rien sur les écrans principaux", async ({ page }) => {
  await page.goto("/");
  await axe(page);
  await page.goto("/#/lecon/4.5");
  await axe(page);
  await page.goto("/#/modele");
  await axe(page);
  await page.getByRole("button", { name: "Rechercher dans le parcours" }).click();
  await axe(page);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await axe(page);
});

test("captures bureau et mobile, clair et sombre", async ({ page }) => {
  await mkdir(new URL("../../docs/images/", import.meta.url), { recursive: true });
  const shots = [
    ["accueil-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/"],
    ["accueil-bureau-clair.png", { width: 1440, height: 900 }, "light", "/"],
    ["accueil-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/"],
    ["lecon-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/lecon/4.5"],
    ["lecon-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/#/lecon/8.7"],
  ];
  for (const [name, viewport, theme, url] of shots) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate((value) => localStorage.setItem("afz-theme", value), theme);
    await page.goto(url);
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("h1")).toBeVisible();
    await page.screenshot({ path: `docs/images/${name}`, animations: "disabled" });
  }
});
