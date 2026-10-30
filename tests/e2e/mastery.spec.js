import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import AxeBuilder from "@axe-core/playwright";
const exercises = JSON.parse(readFileSync(new URL("../../data/exercises.json", import.meta.url)));
const tasks = JSON.parse(readFileSync(new URL("../../data/transfer-tasks.json", import.meta.url))).tasks;
const stubPython = page => page.route("**/assets/js/pyworker.js*", route => route.fulfill({ contentType: "text/javascript", body: 'self.onmessage=()=>{self.postMessage({type:"booted"});setTimeout(()=>self.postMessage({type:"done",text:""}),100)};' }));

for (const persisted of [false, true]) test(`le bilan public et les collections fonctionnent ${persisted ? "avec" : "sans"} suivi local`, async ({ page }) => {
  await page.goto("/");
  if (persisted) await page.getByRole("button", { name: "Suivre ma progression sur cet appareil" }).click();
  await page.goto("/#/niveau/0");
  const box = page.locator(".checkpoint-criterion input").first();
  await box.check(); await page.getByLabel("Compte-rendu du projet").fill("Contre-exemple : valeur négative.");
  await page.goto("/#/lecon/0.18");
  await page.getByText("Mon carnet local", { exact: true }).click();
  await page.getByRole("button", { name: "Ajouter aux favoris", exact: true }).click();
  await page.getByLabel("Mes notes pour cette leçon").fill("Une ligne fois un vecteur.");
  await page.getByRole("link", { name: "Mon espace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Mes favoris", exact: true })).toBeVisible();
  const favorites = page.locator("section").filter({ has: page.getByRole("heading", { name: "Mes favoris", exact: true }) });
  await expect(favorites.getByRole("link", { name: /0.18/ })).toBeVisible();
  await page.getByRole("searchbox", { name: "Rechercher dans mes notes et favoris" }).fill("introuvable");
  await expect(favorites.getByRole("link")).toHaveCount(0);
  await page.goto("/#/niveau/0"); await expect(box).toBeChecked();
  await expect(page.getByLabel("Compte-rendu du projet")).toHaveValue("Contre-exemple : valeur négative.");
  if (persisted) { await page.reload(); await expect(box).toBeChecked(); }
  else expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key !== "afz-theme"))).toEqual([]);
});

test("un module de glossaire indisponible affiche une reprise qui recharge réellement le module", async ({ page }) => {
  const errors = []; page.on("pageerror", error => errors.push(error.message));
  let broken = true;
  await page.route("**/assets/js/glossary.js*", route => broken ? route.abort("failed") : route.continue());
  await page.goto("/#/glossaire");
  await expect(page.getByRole("button", { name: "Réessayer le glossaire" })).toBeVisible();
  broken = false; await page.getByRole("button", { name: "Réessayer le glossaire" }).click();
  await expect(page.getByRole("searchbox", { name: "Rechercher un terme" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("le niveau partagé par deux parcours n’a qu’une entrée courante", async ({ page }) => {
  await page.goto("/#/lecon/13.7");
  await expect(page.locator('#course-nav [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('.nav-explorations [aria-current="page"]')).toHaveCount(1);
});

test("modifier le code invalide le succès et conserve la tentative, y compris après navigation", async ({ page }) => {
  await stubPython(page);
  await page.goto("/#/lecon/0.18");
  const panel = page.locator('[data-exercise="0.18"]'), code = panel.getByLabel("Code de l'exercice");
  const solution = exercises.find(row => row.lessonId === "0.18").solution;
  await code.fill(solution); await panel.getByRole("button", { name: "Lancer le contrôle" }).click();
  await expect(page.locator("[data-exercise-summary]")).toHaveText("contrôle passé");
  await code.fill("def matvec(a,x): return 0");
  await expect(page.locator("[data-exercise-summary]")).toContainText("code modifié");
  await panel.getByText("Mes dernières tentatives").click();
  await expect(panel.locator(".exercise-history li")).toHaveCount(1);
  await page.getByRole("link", { name: "Mon espace", exact: true }).click();
  await page.goto("/#/lecon/0.18");
  await expect(page.locator("[data-exercise-summary]")).toContainText("code modifié");
  await code.fill(solution);
  await expect(page.locator("[data-exercise-summary]")).toHaveText("contrôle passé");
});

test("une ancienne validation sans version ne vaut pas un contrôle du code courant", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("afz-local-learner", "1");
    localStorage.setItem("afz-local-progress-v1", JSON.stringify({exercises:{"0.18":{ok:true}}}));
  });
  await page.goto("/#/lecon/0.18");
  await expect(page.locator("[data-exercise-summary]")).toContainText("ancien contrôle à refaire");
});

test("une édition pendant le téléchargement ne reçoit pas le succès de l’ancien code", async ({ page }) => {
  let dependency;
  await stubPython(page);
  await page.route("**/model/autograd.py*", route => { dependency = route; });
  await page.goto("/#/lecon/4.14");
  const panel = page.locator('[data-exercise="4.14"]'), code = panel.getByLabel("Code de l'exercice");
  await code.fill(exercises.find(row => row.lessonId === "4.14").solution);
  await panel.getByRole("button", { name: "Lancer le contrôle" }).click();
  await expect.poll(() => !!dependency).toBe(true);
  await code.fill("def entrainer(w,n,lr): return 0");
  await dependency.fulfill({ contentType: "text/plain", body: "# fixture de contrôle UI" });
  await expect(page.locator("[data-exercise-summary]")).toContainText("code modifié");
});

test("les preuves démarrent vides, enregistrent les aides, exportent et reprennent sans certifier", async ({ page }) => {
  await stubPython(page);
  await page.goto("/#/preuves");
  await expect(page.getByText("Aucune tentative réalisée.", { exact: false })).toBeVisible();
  await page.getByLabel("Alias de l’apprenant").fill("eleve-01");
  await page.getByRole("button", { name: "Démarrer une tentative" }).click();
  await page.getByLabel("Code du cas nouveau").fill(tasks[0].solution);
  await page.getByLabel("Diagnostic et contre-exemple").fill("Le carré après la moyenne annule +2 et −2.");
  await page.getByLabel("Explication sur le cas nouveau").fill("La moyenne des deux carrés vaut 4.");
  await page.getByRole("button", { name: "Demander un indice", exact: true }).click();
  await page.getByRole("button", { name: "Contrôler le cas nouveau" }).click();
  await expect(page.locator("[data-transfer-result]")).toContainText("contrôle passé");
  await page.getByLabel("Code du cas nouveau").fill("pass");
  await expect(page.locator("[data-transfer-result]")).toContainText("code modifié");
  await page.getByRole("button", { name: "Mettre en pause" }).click();
  await expect(page.getByLabel("Code du cas nouveau")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "Reprendre le chronomètre" }).click();
  await page.getByRole("button", { name: "Terminer et garder cette tentative" }).click();
  await expect(page.getByLabel("Type de relecture")).toHaveValue("");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exporter mes preuves de compréhension" }).click()]);
  const file = readFileSync(await download.path()); const report = JSON.parse(file);
  expect(report.attempts[0].assistance).toContain("indice");
  expect(report.attempts[0].review).toBeUndefined();
  expect(report.attempts[0].checks).toHaveLength(1);
  expect(report.attempts[0].origin).toBe("local");
  expect(report.attempts[0].events.map(row => row.type)).toEqual(["start","pause","resume","finish"]);
  await page.reload();
  await page.getByLabel("Dossier de compréhension à importer").setInputFiles({ name: "preuves.json", mimeType: "application/json", buffer: file });
  await expect(page.getByRole("button", { name: /fondations-A.*importée/ })).toBeVisible();
  await page.getByRole("button", { name: /fondations-A.*importée/ }).click();
  await expect(page.getByLabel("Code du cas nouveau")).toHaveValue("pass");
  await expect(page.getByLabel("Type de relecture")).toHaveValue("");
});

for (const width of [320, 768, 1440]) test(`les épreuves restent lisibles et accessibles à ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/#/preuves");
  await page.getByRole("button", { name: "Démarrer une tentative" }).click();
  await page.getByRole("button", { name: "Terminer et garder cette tentative" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  const result = await new AxeBuilder({ page }).include("main").analyze();
  expect(result.violations).toEqual([]);
});

test("une panne Python ne devient pas un échec de code et la reprise produit le premier reçu", async ({ page }) => {
  await page.route("**/assets/js/pyworker.js*", route => route.fulfill({ contentType:"text/javascript", body:'let n=0;self.onmessage=()=>self.postMessage(++n===1?{type:"error",phase:"loading",text:"réseau indisponible"}:{type:"done",text:""});' }));
  await page.goto("/#/lecon/0.18");
  const panel=page.locator("[data-exercise]");
  await panel.getByRole("button",{name:"Lancer le contrôle"}).click();
  await expect(panel.getByRole("status")).toContainText("Aucune nouvelle tentative de code n’a été évaluée");
  await expect(page.locator("[data-exercise-summary]")).toHaveText("non lancé");
  await expect(panel.locator(".exercise-history")).toBeHidden();
  await panel.getByRole("button",{name:"Lancer le contrôle"}).click();
  await expect(page.locator("[data-exercise-summary]")).toHaveText("contrôle passé");
  await expect(panel.locator(".exercise-history li")).toHaveCount(1);
});
