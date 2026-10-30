import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { installOwner, signInAs } from "./session.js";

const curriculum = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url), "utf8"));
const glances = JSON.parse(readFileSync(new URL("../../data/glance.json", import.meta.url), "utf8"));
const lessons = curriculum.levels.flatMap((level) => level.steps).map((step) => ({ ...step, glance: glances[step.id] }));

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
  await expect(page.locator(".chapter")).toHaveCount(curriculum.levels[0].steps.length);
  expect(errors).toEqual([]);
});

test("chaque leçon s'ouvre sans erreur de console", async ({ page }) => {
  test.setTimeout(180_000);
  const errors = trackErrors(page);
  await page.goto("/#/lecon/0.1");
  await expect(page.locator("[data-lesson-id='0.1']")).toBeVisible();
  for (const lesson of lessons) {
    await page.evaluate((id) => {
      location.hash = `#/lecon/${id}`;
    }, lesson.id);
    await expect(page.locator(`[data-lesson-id="${lesson.id}"]`)).toBeVisible();
    await expect(page.locator("h1")).toHaveText(lesson.title);
    await expect(page.locator("figure[data-visual]")).toHaveAttribute("data-visual", lesson.visual);
    await expect(page.locator("[data-visual-host]")).toBeVisible();
    await expect(page.locator(".glance-phrase")).toHaveText(lesson.glance.phrase);
    await expect(page.getByRole("heading", { name: "En image" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Piège" })).toBeVisible();
    await expect(page.locator(".glance-step")).toHaveCount(3);
    await expect(page.locator("details.lesson-deep")).toHaveCount(1);
    await expect(page.locator("details.lesson-deep")).toHaveAttribute("open", "");
    expect(await page.evaluate(() => Boolean(document.querySelector(".lesson-deep")
      .compareDocumentPosition(document.querySelector(".quiz")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
    await expect(page.getByRole("heading", { name: "Quiz" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("le quiz refuse une mauvaise réponse puis enregistre la bonne", async ({ page }) => {
  const lesson = lessons.find((item) => item.id === "1.6");
  const wrong = (lesson.quiz.answer + 1) % 4;
  await installOwner(page);
  await signInAs(page);
  await page.goto(`/#/lecon/${lesson.id}`);
  const complete = page.getByRole("button", { name: "Marquer comme terminée" });
  await expect(complete).toBeDisabled();
  await page.locator(`[data-choice="${wrong}"]`).click();
  await expect(page.locator(".quiz .quiz-feedback")).toContainText("Ce n'est pas la bonne réponse");
  await expect(complete).toBeDisabled();
  await expect(page.locator(".quiz .quiz-feedback")).not.toContainText(lesson.quiz.explanation);
  await page.locator(`[data-choice="${lesson.quiz.answer}"]`).click();
  await expect(page.locator(".quiz .quiz-feedback")).toContainText("Bonne réponse");
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
  await page.getByRole("button", { name: "Rechercher une notion" }).click();
  await page.keyboard.press("Escape");
  await expect(page.locator("#search-dialog")).toBeHidden();
  await page.getByRole("button", { name: "Activer le thème clair" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});

test("le bouton retour revient à l'accueil", async ({ page }) => {
  await page.goto("/#/");
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

test("les indices survivent au quiz et la piste LLM s'affiche", async ({ page }) => {
  const errors = trackErrors(page);
  await installOwner(page);
  await signInAs(page);
  await page.goto("/#/lecon/1.14");
  await page.getByRole("button", { name: "Indice suivant" }).click();
  await page.getByRole("button", { name: "Indice suivant" }).click();
  await expect(page.locator("#hint-list li")).toHaveCount(2);
  await page.locator("[data-choice='0']").click();
  await expect(page.locator("#hint-list li")).toHaveCount(2);
  await page.getByRole("button", { name: "Voir une correction" }).click();
  await expect(page.locator("#solution")).toBeVisible();
  await page.getByRole("button", { name: "Masquer la correction" }).click();
  await expect(page.locator("#solution")).toBeHidden();
  await page.goto("/#/construire");
  await expect(page.locator("h1")).toHaveText("Construire ton LLM");
  await expect(page.getByRole("heading", { name: "Entraînement réel" })).toBeVisible();
  await expect(page.locator("[data-run-host]")).toContainText("Validation");
  await expect(page.locator(".track-step")).toHaveCount(curriculum.track.length);
  await expect(page.getByRole("link", { name: "4.4" })).toBeVisible();
  await page.getByRole("link", { name: "4.4" }).click();
  await expect(page.locator("[data-lesson-id='4.4']")).toBeVisible();
  expect(errors).toEqual([]);
});

test("chaque famille de visuel interactif répond", async ({ page }) => {
  const errors = trackErrors(page);
  const seen = new Set();
  for (const lesson of lessons) {
    if (!lesson.interactive || seen.has(lesson.visual)) continue;
    seen.add(lesson.visual);
    await page.goto(`/#/lecon/${lesson.id}`);
    const host = page.locator("[data-visual-host]");
    await expect(host).toBeVisible();
    const before = (await host.locator(".visual-readout").count())
      ? await host.locator(".visual-readout").innerText()
      : await host.locator("li").first().innerText();
    if (lesson.visual === "descent") await host.getByRole("button", { name: "Un pas" }).click();
    else if (lesson.visual === "loss") await host.getByRole("button", { name: "Un pas d'entraînement" }).click();
    else if (lesson.visual === "transformer") await host.getByRole("button", { name: "Étape suivante" }).click();
    else if (lesson.visual === "patches") await host.getByRole("button", { name: "Rappeler l'ordre" }).click();
    else if (lesson.visual === "attention") await host.getByRole("button", { name: "ici" }).click();
    else if (lesson.visual === "embed") await host.getByRole("button", { name: "code" }).click();
    else if (lesson.visual === "bigram") await host.getByRole("button", { name: "b", exact: true }).click();
    else if (lesson.visual === "moe") await host.getByRole("button").first().click();
    else if (lesson.visual === "tokenize") await host.getByLabel("Texte à découper").fill("bonjour");
    else if (lesson.visual === "retrieve") await host.getByLabel("Question à comparer aux documents").fill("tokenizer");
    else if (lesson.visual === "bpe") await host.getByRole("button", { name: "Fusionner" }).click();
    else await host.locator("input[type=range]").press("ArrowRight");
    if (lesson.visual === "retrieve") await expect(host.locator("li").first()).toContainText("tokenizer");
    else await expect(host.locator(".visual-readout")).not.toHaveText(before);
  }
  expect([...seen].sort()).toEqual(
    ["attention", "bigram", "bpe", "descent", "embed", "lora", "loss", "moe", "patches", "relu", "retrieve", "scan", "softmax", "tokenize", "transformer"].sort(),
  );
  expect(errors).toEqual([]);
});

test("axe ne signale rien sur les écrans principaux", async ({ page }) => {
  await page.goto("/");
  await axe(page);
  await page.goto("/#/lecon/4.5");
  await axe(page);
  await page.goto("/#/construire");
  await expect(page.locator("[data-run-host]")).toContainText("Validation");
  await expect(page.locator("[data-chat-host]")).toContainText("LoRA");
  await axe(page);
  await page.goto("/#/modele");
  await axe(page);
  await page.getByRole("button", { name: "Rechercher une notion" }).click();
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
    ["accueil-mobile-clair.png", { width: 390, height: 844 }, "light", "/"],
    ["parcours-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/parcours"],
    ["parcours-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/parcours"],
    ["parcours-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/parcours"],
    ["parcours-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/#/parcours"],
    ["lecon-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/lecon/1.14"],
    ["lecon-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/lecon/1.14"],
    ["lecon-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/lecon/1.14"],
    ["lecon-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/#/lecon/1.14"],
    ["interactif-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/lecon/4.5"],
    ["interactif-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/lecon/4.5"],
    ["interactif-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/lecon/4.5"],
    ["interactif-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/#/lecon/4.5"],
    ["piste-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/construire"],
    ["piste-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/construire"],
    ["piste-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/construire"],
    ["piste-mobile-sombre.png", { width: 390, height: 844 }, "dark", "/#/construire"],
    ["donnees-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/donnees"],
    ["donnees-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/donnees"],
    ["donnees-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/donnees"],
    ["playground-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/playground"],
    ["playground-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/playground"],
    ["propos-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/a-propos"],
    ["ide-bureau-sombre.png", { width: 1440, height: 900 }, "dark", "/#/ide"],
    ["ide-mobile-clair.png", { width: 390, height: 844 }, "light", "/#/ide"],
    ["connexion-bureau-clair.png", { width: 1440, height: 900 }, "light", "/#/connexion"],
  ];
  for (const [name, viewport, theme, url] of shots) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await page.evaluate((value) => localStorage.setItem("afz-theme", value), theme);
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    await expect(page.locator("h1")).toBeVisible();
    if (url.includes("/lecon/")) {
      await page.locator("figure.visual").evaluate((node) => node.scrollIntoView({ block: "center", behavior: "instant" }));
    }
    if (url.includes("/parcours")) {
      await page.locator("#roadmap").evaluate((node) => node.scrollIntoView({ block: "start", behavior: "instant" }));
    }
    if (url.includes("/construire")) {
      await expect(page.locator("[data-run-host]")).toContainText("Validation");
      await expect(page.locator("[data-chat-host]")).toContainText("LoRA");
    }
    await page.screenshot({ path: `docs/images/${name}`, animations: "disabled" });
  }
});
