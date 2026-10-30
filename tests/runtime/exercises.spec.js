import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

const exercises = JSON.parse(readFileSync(new URL("../../data/exercises.json", import.meta.url)));
const tasks = exercises.map(row => ({ ...row, files: (row.files || []).map(path => ({ path, content: readFileSync(new URL(`../../${path}`, import.meta.url), "utf8") })) }));

test("66 corrigés passent dans Python réel avec un espace neuf ; un code vide échoue ensuite", async ({ page }) => {
  await page.goto("/");
  const results = await page.evaluate(async tasks => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    const results = [];
    for (const task of tasks) {
      const result = await bridge.request({ type: "exercise", code: `${task.solution}\n${task.check}`, files: task.files });
      results.push({ id: task.lessonId, type: result.type, ...(result.type === "error" ? { text: result.text } : {}) });
    }
    const check = tasks.find(task => task.lessonId === "0.18").check;
    const blank = await bridge.request({ type: "exercise", code: check });
    const recovery = await bridge.request({ type: "exercise", code: "6 * 7" });
    return { results, blank, recovery };
  }, tasks);
  expect(results.results.filter(row => row.type !== "done")).toEqual([]);
  expect(results.results).toHaveLength(66);
  expect(results.blank.type).toBe("error");
  expect(results.blank.text).toContain("NameError");
  expect(results.recovery).toMatchObject({ type: "done", text: "42" });
});

test("4.14 fournit son autograd dans une session neuve et le contrôle ne réutilise pas la solution", async ({ page }) => {
  await page.goto("/#/lecon/4.14");
  const panel = page.locator('[data-exercise="4.14"]');
  const area = panel.getByRole("textbox", { name: "Code de l'exercice" });
  const run = panel.getByRole("button", { name: "Lancer le contrôle" });
  await area.fill(tasks.find(row => row.lessonId === "4.14").solution);
  await run.click();
  await expect(panel.getByRole("status")).toHaveText("Contrôle passé.");
  await expect(page.locator("[data-exercise-summary]")).toContainText("contrôle passé");
  await area.fill("");
  await run.click();
  await expect(panel.getByRole("status")).toContainText("NameError");
  await expect(page.locator("[data-exercise-summary]")).toContainText("à corriger");
});

test("une panne du téléchargement WASM expire et permet un redémarrage complet", async ({ page, context }) => {
  let broken = true;
  await context.route("**/pyodide.asm.wasm", route => broken ? route.abort("failed") : route.continue());
  await page.goto("/");
  const first = await page.evaluate(async () => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    return bridge.request({ type: "exercise", code: "1+1" }, undefined, { bootTimeoutMs: 1500 });
  });
  expect(first.type).toBe("error");
  broken = false;
  const recovered = await page.evaluate(async () => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    return bridge.request({ type: "exercise", code: "import numpy as np\nint(np.array([2,3]) @ np.array([5,7]))" });
  });
  expect(recovered).toMatchObject({ type: "done", text: "31" });
});
