import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";

const lessons = JSON.parse(readFileSync(new URL("../../data/curriculum.json", import.meta.url))).levels.flatMap(level => level.steps);

test("une ancienne réponse de catalogue sans version ne masque pas les nouvelles activités", async ({ page }) => {
  // Simule les réponses encore présentes pour les anciennes URL dans le cache d'un visiteur.
  await page.route(/\/data\/(?:exercises|debug|glossary|glossary-core)\.json$/, route => route.fulfill({ contentType: "application/json", body: "[]" }));
  await page.goto("/#/lecon/4.14");
  await expect(page.locator('[data-exercise="4.14"]')).toBeVisible();
  await page.goto("/#/glossaire");
  await page.getByRole("searchbox", { name: "Rechercher un terme" }).fill("backpropagation");
  await expect(page.getByRole("heading", { name: "Rétropropagation", exact: true })).toBeVisible();
});

for (const catalog of ["exercises", "debug"]) test(`un catalogue ${catalog} indisponible peut être retenté sans dupliquer les activités`, async ({ page }) => {
  let first = true;
  await page.route(`**/data/${catalog}.json*`, route => {
    if (first) { first = false; return route.fulfill({ status: 503, body: "Temporairement indisponible" }); }
    return route.continue();
  });
  await page.goto("/#/lecon/0.18");
  await page.getByRole("button", { name: "Réessayer les activités" }).click();
  await expect(page.locator('[data-exercise="0.18"]')).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Réessayer les activités" })).toHaveCount(0);
});

test("le code précède sa manipulation ; le bilan distingue exercice Python et explication", async ({ page }) => {
  await page.goto("/#/lecon/0.18");
  const order = await page.locator(".lesson-deep-body").evaluate(body => {
    const code = body.querySelector(".block-code"), last = body.lastElementChild;
    return Boolean(code.compareDocumentPosition(last) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(order).toBe(true);
  await expect(page.locator("[data-exercise-summary]")).toContainText("non lancé");
  await page.goto("/#/lecon/0.1");
  await expect(page.locator("#lesson-summary")).toContainText("Aucun contrôle Python automatique");
  await expect(page.locator("#lesson-summary")).not.toContainText("non validé");
});

test("la perte quadratique affiche les mêmes carrés et moyennes que le calcul", async ({ page }) => {
  await page.goto("/#/lecon/1.9");
  const lab = page.locator('[data-lab="mse"]');
  await expect(lab).toHaveAttribute("data-loss", "4");
  for (const [label, value] of [["Prédiction du premier exemple", 10], ["Cible du premier exemple", 6]])
    await lab.getByLabel(label).evaluate((node, v) => { node.value = v; node.dispatchEvent(new Event("input", { bubbles: true })); }, value);
  await expect(lab).toHaveAttribute("data-loss", "16");
  await lab.getByLabel("Ajouter un second exemple exact et calculer la moyenne").check();
  await expect(lab).toHaveAttribute("data-loss", "8");
});

test("les TP ont leur énoncé, un contrôle individuel et des guides HTML accessibles", async ({ page }) => {
  await page.goto("/#/atelier/tp/5");
  const tp = page.locator("#tp-5");
  await expect(tp).toContainText("python verifier.py --tp 5");
  await expect(tp.locator("[data-tp-content] h3")).toContainText("TP 5");
  await expect(tp.locator("[data-tp-content] pre code").first()).toBeVisible();
  await expect(tp).toContainText("1.12");
  await page.getByRole("button", { name: "Ouvrir le dossier final", exact: true }).click();
  const doc = page.getByLabel("Document de l’atelier");
  await expect(doc.getByRole("heading", { name: "Mon dossier de modèle" })).toBeVisible();
  await expect(doc.getByRole("table").first()).toBeVisible();
  await expect(doc.locator("p").first()).not.toContainText("# Mon dossier");
  const result = await new AxeBuilder({ page }).include(".atelier-document").analyze();
  expect(result.violations).toEqual([]);
});

test("glossaire regroupé, recherche anglaise et définition accessible dans le cours", async ({ page }) => {
  await page.goto("/#/glossaire");
  await page.getByRole("searchbox", { name: "Rechercher un terme" }).fill("Baseline");
  const baseline = page.locator(".glossary-list article").filter({ has: page.getByRole("heading", { name: "Baseline", exact: true }) });
  await expect(baseline).toHaveCount(1);
  await expect(baseline).toContainText("Exemple :");
  await expect(baseline.locator("summary")).toContainText("contexte(s)");
  await page.getByRole("searchbox", { name: "Rechercher un terme" }).fill("backpropagation");
  await expect(page.getByRole("heading", { name: "Rétropropagation", exact: true })).toBeVisible();
  await page.goto("/#/lecon/1.12");
  const definition = page.locator(".term-help").first();
  await definition.click();
  await expect(definition).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(definition).toHaveAttribute("aria-expanded", "false");
});

test("notes et progression de session survivent au consentement puis à un export et import", async ({ page }) => {
  const requests = [];
  page.on("request", request => { if (request.url().includes("supabase.co")) requests.push(request.url()); });
  await page.goto("/#/lecon/0.18");
  await page.getByText("Mon carnet local", { exact: true }).click();
  await page.getByLabel("Mes notes pour cette leçon").fill("Le produit utilise une ligne de la matrice.");
  await page.getByRole("textbox", { name: "Code de l'exercice" }).fill("# mon brouillon");
  await page.locator(`[data-choice="${lessons.find(row => row.id === "0.18").quiz.answer}"]`).click();
  await page.getByRole("button", { name: "Marquer comme terminée" }).click();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "afz-theme"))).toEqual([]);
  await page.getByRole("button", { name: "Garder ma progression sur cet appareil", exact: true }).click();
  await page.reload();
  await page.getByText("Mon carnet local", { exact: true }).click();
  await expect(page.getByLabel("Mes notes pour cette leçon")).toHaveValue("Le produit utilise une ligne de la matrice.");
  await expect(page.getByRole("textbox", { name: "Code de l'exercice" })).toHaveValue("# mon brouillon");
  await expect(page.locator("#progress-meta")).toContainText("1 étape terminée");
  await page.goto("/");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter", exact: true }).click()]);
  const backup = JSON.parse(readFileSync(await download.path(), "utf8"));
  expect(backup.records["lesson/0.18"].note).toContain("une ligne");
  page.once("dialog", d => d.accept());
  await page.locator(".local-panel").getByRole("button", { name: "Effacer", exact: true }).click();
  await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await page.locator(".local-panel input[type=file]").setInputFiles({ name: "sauvegarde.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
  await page.goto("/#/lecon/0.18");
  await page.getByText("Mon carnet local", { exact: true }).click();
  await expect(page.getByLabel("Mes notes pour cette leçon")).toHaveValue(backup.records["lesson/0.18"].note);
  expect(requests).toEqual([]);
});

test("un dossier de preuves exporté sans compte se restaure sans certifier l’autonomie", async ({ page }) => {
  await page.goto("/#/espace");
  const checkbox = page.getByLabel("Je peux expliquer le TP 5 sur un exemple nouveau", { exact: true });
  await checkbox.check();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter mon dossier de preuves" }).click()]);
  const content = readFileSync(await download.path());
  await page.reload();
  await expect(checkbox).not.toBeChecked();
  await page.getByLabel("Rapport de contrôles de mon atelier").setInputFiles({ name: "preuves.json", mimeType: "application/json", buffer: content });
  await expect(checkbox).toBeChecked();
  await expect(page.locator(".project-evidence")).toContainText("ne certifie ni l’exécution ni l’autonomie");
});

test("le rendu des guides conserve les titres et tableaux sans exécuter du HTML", async ({ page }) => {
  await page.goto("/");
  const result = await page.evaluate(async () => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const { renderMarkdown } = await import(map.scopes["./assets/js/"]["./assets/js/markdown.js"]);
    const doc = renderMarkdown("# Guide\n\n<img src=x onerror=alert(1)>\n\n[Aide](javascript:alert(1))\n\n| Nom | Valeur |\n| --- | --- |\n| Test | 42 |", { baseURL: "https://example.org/guide.md" });
    return { heading: doc.querySelector("h2").textContent, image: doc.querySelector("img") !== null, link: doc.querySelector("a") !== null, cells: [...doc.querySelectorAll("td")].map(td => td.textContent) };
  });
  expect(result).toEqual({ heading: "Guide", image: false, link: false, cells: ["Test", "42"] });
});

test("arrêter le chargement d’une dépendance empêche un démarrage Python tardif", async ({ page }) => {
  let held, starts = 0;
  await page.route("**/model/autograd.py*", route => { held = route; });
  await page.route("**/assets/js/pyworker.js*", route => {
    starts++;
    return route.fulfill({ contentType: "text/javascript", body: 'self.onmessage=()=>self.postMessage({type:"done"});' });
  });
  await page.goto("/#/lecon/4.14");
  const panel = page.locator("[data-exercise]");
  await panel.getByRole("button", { name: "Lancer le contrôle" }).click();
  await expect.poll(() => !!held).toBe(true);
  await panel.getByRole("button", { name: "Arrêter le contrôle" }).click();
  await expect(panel.getByRole("status")).toContainText("Contrôle arrêté");
  await held.fulfill({ contentType: "text/plain", body: "# téléchargement arrivé après annulation" }).catch(() => {});
  await page.unroute("**/model/autograd.py*");
  expect(starts).toBe(0);
  await panel.getByRole("button", { name: "Lancer le contrôle" }).click();
  await expect(panel.getByRole("status")).toHaveText("Contrôle passé.");
  expect(starts).toBe(1);
});
