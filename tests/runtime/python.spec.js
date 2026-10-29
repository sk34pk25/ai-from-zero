import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { PLACEMENT } from "../../assets/js/placement.js";

async function run(page, code) {
  return page.evaluate(async source => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    return bridge.request({ type: "run", code: source, files: [] });
  }, code);
}

const numpyCode = "import numpy as np\nint(np.array([2, 3]) @ np.array([5, 7]))";
const modelFiles = JSON.parse(readFileSync(new URL("../../model/manifest.json", import.meta.url)))
  .files.map(path => ({ path, content: readFileSync(new URL(`../../${path}`, import.meta.url), "utf8") }));

test("Python réel : reprise réseau, NumPy, erreur, arrêt et redémarrage", async ({ page, context }) => {
  let failFirst = true;
  let loads = 0;
  const networkErrors = [];
  context.on("requestfailed", request => {
    if (request.url().startsWith("https://cdn.jsdelivr.net/"))
      networkErrors.push({ url: request.url(), error: request.failure()?.errorText });
  });
  await context.route("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js", async route => {
    loads += 1;
    if (failFirst) {
      failFirst = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await page.goto("/");
  expect((await run(page, numpyCode)).type).toBe("error");
  const recovered = await run(page, numpyCode);
  expect(loads).toBe(2);
  expect(recovered, JSON.stringify({ recovered, networkErrors })).toMatchObject({ type: "done", text: "31" });

  const error = await run(page, "raise ValueError('cas volontaire')");
  expect(error.type).toBe("error");
  expect(error.text).toContain("ValueError: cas volontaire");
  expect(await run(page, "6 * 7")).toMatchObject({ type: "done", text: "42" });

  const trained = await page.evaluate(async files => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    const initialized = await bridge.request({ type: "train-init", text: "le chat dort. ", steps: 2, files });
    if (initialized.type !== "ready") return { initialized };
    const first = await bridge.request({ type: "train-step" });
    const second = await bridge.request({ type: "train-step" });
    const sample = await bridge.request({ type: "train-sample" });
    return { initialized, first, second, sample };
  }, modelFiles);
  expect(trained.initialized).toMatchObject({ type: "ready" });
  expect(trained.first).toMatchObject({ type: "loss", payload: { step: 1, done: false } });
  expect(trained.second).toMatchObject({ type: "loss", payload: { step: 2, done: true } });
  expect(Number.isFinite(trained.first.payload.loss)).toBe(true);
  expect(Number.isFinite(trained.second.payload.loss)).toBe(true);
  expect(trained.sample.type).toBe("sample");
  expect(trained.sample.text.startsWith("le chat ")).toBe(true);

  const stopped = await page.evaluate(async () => {
    const map = JSON.parse(document.querySelector("#afz-importmap").textContent);
    const bridge = await import(map.scopes["./assets/js/"]["./assets/js/pybridge.js"]);
    let started;
    const active = new Promise(resolve => { started = resolve; });
    const infinite = bridge.request({
      type: "run", code: "print('boucle active', flush=True)\nwhile True:\n    pass", files: [],
    }, event => {
      if (event.type === "stdout" && event.text.includes("boucle active")) started();
    });
    await active;
    const busy = await bridge.request({ type: "run", code: "1 + 1", files: [] });
    bridge.stopWorker();
    return { busy, cancelled: await infinite };
  });
  expect(stopped.busy.type).toBe("error");
  expect(stopped.busy.text).toContain("occupé");
  expect(stopped.cancelled).toMatchObject({ type: "error", cancelled: true });
  expect(await run(page, numpyCode)).toMatchObject({ type: "done", text: "31" });
});

test("le positionnement exécute réellement les cas Python sur petit écran", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto("/#/positionnement");
  for (const q of PLACEMENT)
    await page.locator(`input[name="placement-${q.id}"][value="${q.answer}"]`).check();
  await page.getByRole("button", { name: "Voir mon résultat" }).click();
  const panel = page.locator(".placement-practice");
  const code = page.getByRole("textbox", { name: "Code de l’épreuve pratique" });
  const check = page.getByRole("button", { name: "Vérifier mon programme" });
  const save = page.getByRole("button", { name: /Garder ce résultat/ });
  await check.click();
  await expect(panel.getByRole("status")).toContainText("NotImplementedError");
  await expect(save).toBeDisabled();
  const solution = `def analyser(texte, seuil):
    valeurs = [float(ligne) for ligne in texte.splitlines() if ligne.strip()]
    if not valeurs:
        raise ValueError("aucune mesure")
    return {"nombre": len(valeurs), "total": sum(valeurs),
            "moyenne": sum(valeurs) / len(valeurs),
            "au_dessus": [v for v in valeurs if v > seuil]}
`;
  await code.fill(solution);
  await check.click();
  await expect(panel.getByRole("status")).toContainText("Cas publics réussis");
  await expect(save).toBeEnabled();
  await code.fill("while True:\n    pass");
  await check.click();
  const stop = page.getByRole("button", { name: "Arrêter le contrôle" });
  await expect(stop).toBeEnabled();
  await stop.click();
  await expect(panel.getByRole("status")).toContainText("Contrôle arrêté");
  await expect(stop).toBeDisabled();
  await expect(save).toBeDisabled();
  await code.fill(solution);
  await check.click();
  await expect(panel.getByRole("status")).toContainText("Cas publics réussis");
  await expect(save).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
