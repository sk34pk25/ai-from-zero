import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
const lessons = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url))).levels.flatMap(l => l.steps);
test.setTimeout(30000);

test("la première navigation lente annonce le titre au clavier", async ({ page }) => {
  for (const file of ["curriculum.json", "glance.json"])
    await page.route("**/data/" + file + "*", async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.continue();
    });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#continue-link").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("h1")).toHaveText(lessons[0].title);
  await expect(page.locator("h1")).toBeFocused();
});

test("une leçon arrivée plus tard ne reprend pas le focus à une recherche", async ({ page }) => {
  await page.route("**/data/curriculum.json*", async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.continue();
  });
  await page.goto("/");
  await expect(page.locator("h1")).toBeVisible();
  await page.locator("#continue-link").focus();
  await page.keyboard.press("Enter");
  await page.locator("#search-open").click();
  await page.locator("#search-input").fill("gradient");
  await expect(page.locator("h1")).toHaveText(lessons[0].title);
  await expect(page.locator("#search-input")).toBeFocused();
  await expect(page.locator("#search-input")).toHaveValue("gradient");
});

test("un résumé peut échouer puis revenir sans perdre le travail", async ({ page }) => {
  let attempts = 0;
  await page.route("**/data/glance.json*", route => ++attempts === 1
    ? route.fulfill({ status: 503, body: "indisponible" }) : route.continue());
  await page.goto("/");
  await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await page.goto("/#/lecon/0.23");
  await expect(page.locator("h1")).toHaveText(lessons.find(s => s.id === "0.23").title);
  await expect(page.locator(".lesson-deep")).toHaveAttribute("open", "");
  const code = page.getByRole("textbox", { name: "Code de l'exercice" });
  await code.fill("# brouillon conservé pendant la reprise du résumé\n");
  await page.locator('[data-choice="0"]').click();
  const feedback = await page.locator(".quiz .quiz-feedback").textContent();
  await page.getByRole("button", { name: "Réessayer le résumé visuel" }).click();
  await expect(page.locator(".glance-phrase")).toBeVisible();
  await expect(code).toHaveValue("# brouillon conservé pendant la reprise du résumé\n");
  await expect(page.locator(".quiz .quiz-feedback")).toHaveText(feedback);
  expect(attempts).toBe(2);
});

test("le texte arrive avant un résumé lent et conserve le schéma interactif", async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route("**/data/glance.json*", async route => { await gate; await route.continue(); });
  await page.goto("/#/lecon/2.4", { waitUntil: "domcontentloaded" });
  try {
    await expect(page.locator(".block-code code").first()).toBeAttached({ timeout: 2000 });
    const input = page.locator("[data-visual-input]");
    await input.fill("texte personnel");
    release();
    await expect(page.locator(".glance-phrase")).toBeVisible();
    await expect(input).toHaveValue("texte personnel");
    await expect(input).toBeFocused();
  } finally { release(); }
});

test("le mode guidé précède le quiz et la révision conserve le brouillon", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await page.goto("/#/lecon/0.23");
  const deep = page.locator(".lesson-deep");
  await expect(deep).toHaveAttribute("open", "");
  expect(await page.evaluate(() => Boolean(document.querySelector(".lesson-deep")
    .compareDocumentPosition(document.querySelector(".quiz")) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  const code = page.getByRole("textbox", { name: "Code de l'exercice" });
  await code.fill("# mode de lecture sans perte de saisie\n");
  await page.locator(".lesson-display > summary").click();
  await page.getByRole("button", { name: "Révision visuelle", exact: true }).click();
  await expect(deep).not.toHaveAttribute("open");
  await expect(code).toHaveValue("# mode de lecture sans perte de saisie\n");
  await page.reload();
  await page.locator(".lesson-display > summary").click();
  await expect(page.getByRole("button", { name: "Révision visuelle", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(deep).not.toHaveAttribute("open");
  await page.getByRole("button", { name: "Cours guidé", exact: true }).click();
  await expect(deep).toHaveAttribute("open", "");
  await expect(code).toHaveValue("# mode de lecture sans perte de saisie\n");
});

test("le texte essentiel peut être retenté et annonce le nouveau titre", async ({ page }) => {
  let attempts = 0;
  await page.route("**/data/curriculum.json*", route => ++attempts === 1
    ? route.fulfill({ status: 503, body: "indisponible" }) : route.continue());
  await page.goto("/#/lecon/4.5");
  await expect(page.locator("h1")).toHaveText("Contenu indisponible");
  await page.getByRole("button", { name: "Réessayer le cours", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("Masque causal");
  await expect(page.locator("h1")).toBeFocused();
  expect(attempts).toBe(2);
});

test("un résumé mal formé conserve le cours et son accessibilité mobile", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.route("**/data/glance.json*", route => route.fulfill({ json: { "4.5": { phrase: "incomplet" } } }));
  await page.goto("/#/lecon/4.5");
  await expect(page.locator("h1")).toHaveText("Masque causal");
  await expect(page.locator(".lesson-deep")).toHaveAttribute("open", "");
  await expect(page.locator(".block-code code").first()).toBeAttached();
  const axe = await new AxeBuilder({ page }).analyze();
  expect(axe.violations, JSON.stringify(axe.violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
