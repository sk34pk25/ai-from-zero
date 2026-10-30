import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../../data/curriculum-index.json", import.meta.url)));
const ids = data.levels.flatMap(level => level.steps.map(lesson => lesson.id));

for (const width of [320, 390, 768, 1440]) {
  test(`161 leçons sans débordement global et objectifs avant activité à ${width}px`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 844 });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    const failures = [];
    for (const id of ids) {
      await page.goto(`/#/lecon/${id}`);
      await expect(page.locator(`[data-lesson-id="${id}"]`)).toBeVisible();
      await expect(page.locator(".glance-phrase")).toBeVisible();
      const result = await page.evaluate(() => {
        const objective = document.querySelector(".lesson-objectives");
        const activity = document.querySelector(".lesson-overview");
        return { width: document.documentElement.scrollWidth, viewport: innerWidth,
          objectivesBefore: Boolean(objective.compareDocumentPosition(activity) & Node.DOCUMENT_POSITION_FOLLOWING) };
      });
      if (result.width > result.viewport + 1 || !result.objectivesBefore) failures.push({ id, ...result });
    }
    expect(failures).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("accueil visiteur : pas de null, deux progressions et planificateur sans compte", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mes repères de progression" })).toBeVisible();
  expect(await page.locator("main").evaluate(main => [...main.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent.trim()).filter(Boolean))).toEqual([]);
  await expect(page.locator(".course-progress")).toContainText("0 / 86");
  await expect(page.locator(".course-progress")).toContainText("0 / 75");
  await page.getByLabel("Durée de la séance").selectOption("120");
  await expect(page.locator(".session-planner li").first()).toContainText("0.1");
  await page.locator(".home-catalogue > summary").click();
  expect(await page.locator(".legend").evaluate(node => node.getBoundingClientRect().width)).toBeGreaterThan(150);
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations).toEqual([]);
});

test("la pratique précède le quiz et la sortie ; les objectifs restent en lecture sans distraction", async ({ page }) => {
  await page.goto("/#/lecon/4.5");
  await expect(page.locator("[data-exercise]")).toBeVisible();
  const order = await page.evaluate(() => {
    const follows = (a, b) => Boolean(document.querySelector(a).compareDocumentPosition(document.querySelector(b)) & Node.DOCUMENT_POSITION_FOLLOWING);
    return [follows("[data-exercise]", ".quiz"), follows(".quiz", ".lesson-actions")];
  });
  expect(order).toEqual([true, true]);
  await page.locator(".lesson-display > summary").click();
  await page.getByRole("button", { name: "Lecture sans distraction" }).click();
  await expect(page.locator(".lesson-objectives")).toBeVisible();
  await page.getByRole("button", { name: "Coder et vérifier", exact: true }).click();
  await expect(page.locator("#lesson-practice")).toBeFocused();
  await expect(page.getByRole("link", { name: /^Leçon suivante :/ })).toBeVisible();
});

test("une leçon conduit au TP exact et le bouton retour conserve la route", async ({ page }) => {
  await page.goto("/#/lecon/2.1");
  await page.getByRole("link", { name: "Pratiquer : TP 1", exact: true }).click();
  await expect(page).toHaveURL(/#\/atelier\/tp\/1$/);
  await expect(page.locator("#tp-1")).toBeFocused();
  expect(await page.locator("#tp-1").evaluate(node => node.getBoundingClientRect().top)).toBeLessThan(200);
  await expect(page.getByLabel("Guide de l’atelier")).not.toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-lesson-id="2.1"]')).toBeVisible();
});

test("le parcours premier GPT se termine par le projet, avant les explorations", async ({ page }) => {
  await page.goto("/#/lecon/12.12");
  await expect(page.getByRole("link", { name: "Préparer le bilan du projet", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Leçon suivante :/ })).toHaveCount(0);
});
