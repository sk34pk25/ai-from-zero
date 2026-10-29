import { readFileSync } from "node:fs";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { PLACEMENT } from "../../assets/js/placement.js";

const curriculum = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
const lesson = curriculum.levels.flatMap((level) => level.steps).find((step) => step.id === "1.6");

function watch(page) {
  const seen = { errors: [], supabase: [] };
  page.on("pageerror", (error) => seen.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") seen.errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.url().includes("supabase.co")) seen.supabase.push(request.url());
  });
  return seen;
}

const storedKeys = (page) =>
  page.evaluate(() => Object.keys(localStorage).filter((key) => key !== "afz-theme").sort());

test("un visiteur garde sa progression dans ce navigateur, l'exporte puis l'efface", async ({ page }) => {
  const seen = watch(page);
  await page.goto("/");
  expect(await storedKeys(page)).toEqual([]);
  await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await expect(page.getByRole("heading", { name: "Progression gardée dans ce navigateur" })).toBeVisible();
  const results = await new AxeBuilder({ page }).include(".local-panel").analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  await page.goto(`/#/lecon/${lesson.id}`);
  await expect(page.locator(".lock-note")).toHaveCount(0);
  const complete = page.getByRole("button", { name: "Marquer comme terminée" });
  await expect(complete).toBeDisabled();
  await page.locator(`[data-choice="${lesson.quiz.answer}"]`).click();
  await expect(page.locator(".quiz .quiz-feedback")).toContainText("Bonne réponse");
  await expect(page.getByRole("button", { name: "Voir une correction" })).toBeEnabled();
  await complete.click();
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  await page.reload();
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  const keys = await storedKeys(page);
  expect(keys).toContain("afz-local-learner");
  expect(keys.filter(key=>key.startsWith("afz-local-v2/")).length).toBeGreaterThanOrEqual(3);

  await page.goto("/");
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Exporter", exact: true }).click(),
  ]);
  const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(backup.format).toBe("ai-from-zero");
  expect(backup.records.progress.done).toEqual([lesson.id]);
  expect(backup.records.progress.quizzes[lesson.id].correct).toBe(true);

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator(".local-panel").getByRole("button", { name: "Effacer", exact: true }).click();
  await expect(page.locator("#progress-meta")).toHaveText("Aucune étape terminée");
  expect(await storedKeys(page)).toEqual([]);

  await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await page.locator(".local-panel input[type=file]").setInputFiles({
    name: "progression.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");

  expect(seen.supabase).toEqual([]);
  expect(seen.errors).toEqual([]);
});

test("le positionnement conseille des étapes puis garde le résultat sur demande", async ({ page }) => {
  const seen = watch(page);
  await page.route("**/assets/js/pyworker.js*",route=>route.fulfill({contentType:"text/javascript",body:'self.onmessage=()=>self.postMessage({type:"done"});'}));
  await page.goto("/");
  await page.getByRole("button", { name: "J'ai déjà les bases" }).click();
  await expect(page).toHaveURL(/#\/positionnement$/);
  await expect(page.locator("h1")).toHaveText("As-tu déjà les bases ?");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);

  const [missed, ...rest] = PLACEMENT;
  await page.locator(`input[name="placement-${missed.id}"][value="${(missed.answer + 1) % 4}"]`).check();
  for (const q of rest) await page.locator(`input[name="placement-${q.id}"][value="${q.answer}"]`).check();
  await page.getByRole("button", { name: "Voir mon résultat" }).click();
  await expect(page.locator(".placement-result h2")).toHaveText(`${PLACEMENT.length - 1} / ${PLACEMENT.length}`);
  for (const id of missed.steps)
    await expect(page.locator(`.placement-result a[href="#/lecon/${id}"]`)).toBeVisible();
  expect(await storedKeys(page)).toEqual([]);

  const levelZero = curriculum.levels[0].steps.length;
  const expected = levelZero - missed.steps.length;
  await expect(page.getByRole("button", { name: `Garder ce résultat sur cet appareil (${expected} étapes)` })).toBeDisabled();
  await page.getByRole("button", { name: "Vérifier mon programme" }).click();
  await expect(page.locator(".placement-practice")).toContainText("Cas publics réussis");
  await page.getByRole("button", { name: `Garder ce résultat sur cet appareil (${expected} étapes)` }).click();
  await expect(page.locator("#progress-meta")).toContainText(`${expected} étapes terminées`);
  await page.goto(`/#/lecon/${missed.steps[0]}`);
  await expect(page.getByRole("button", { name: "Marquer comme terminée" })).toBeVisible();
  expect(seen.supabase).toEqual([]);
  expect(seen.errors).toEqual([]);
});
