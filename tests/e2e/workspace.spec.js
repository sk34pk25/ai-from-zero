import { test, expect } from "@playwright/test";
import { installOwner, signInAs } from "./session.js";

test("notes, favoris et code sont conservés après navigation", async ({
  page,
}) => {
  await installOwner(page);
  await signInAs(page);
  await page.goto("/#/lecon/0.9");
  const note = page.getByLabel("Mes notes pour cette leçon");
  await note.fill("Comprendre return avant print");
  await page.getByRole("button", { name: "Ajouter aux favoris" }).click();
  await page.goto("/#/espace");
  await expect(
    page.getByText("Comprendre return avant print", { exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Comprendre return avant print", { exact: true }).first(),
  ).toBeVisible();
  await page.goto("/#/ide");
  const editor = page.locator(".cm-content");
  await expect(editor).toBeVisible();
  await editor.fill("print('brouillon sauvegardé')");
  await page.waitForTimeout(800);
  await page.goto("/#/accueil");
  await page.goto("/#/ide");
  await expect(page.locator(".cm-content")).toContainText(
    "brouillon sauvegardé",
  );
});

test("un brouillon divergent ne remplace pas silencieusement la version distante", async ({
  page,
}) => {
  await installOwner(page, {
    tables: {
      learning_records: [
        {
          key: "ide/model/__init__.py",
          revision: 2,
          payload: { content: 'print("distant")' },
        },
      ],
    },
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "afz-workspace-v1",
      JSON.stringify({
        "ide/model/__init__.py": {
          payload: { content: 'print("local")' },
          revision: 1,
          dirty: true,
        },
      }),
    ),
  );
  await signInAs(page);
  await page.goto("/#/espace");
  await expect(
    page.getByRole("heading", { name: "Deux versions à départager" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Utiliser la version distante" })
    .click();
  await page.goto("/#/ide");
  await expect(page.locator(".cm-content")).toContainText("distant");
});

test("le visiteur peut lire chaque fichier sans ouvrir de session", async ({
  page,
}) => {
  await page.goto("/#/ide");
  await page
    .getByRole("treeitem", { name: "autograd.py", exact: true })
    .click();
  await expect(page.locator("#ide-readonly")).toContainText("class Tensor");
});

test("glossaire, séances et bilans sont navigables à 200 %", async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/#/glossaire");
  await page.getByRole("searchbox").fill("gradient");
  await expect(page.locator("main article").first()).toBeVisible();
  await page.goto("/#/niveau/0");
  await expect(
    page.getByRole("heading", { name: "Bilan pratique du niveau" }),
  ).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.zoom = "2"));
  const layout=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth,offenders:[...document.querySelectorAll('body *')].map(e=>({tag:e.tagName,cls:String(e.className),right:e.getBoundingClientRect().right})).filter(e=>e.right>innerWidth+1).slice(0,12)}));
  expect(layout.scroll<=layout.width+1,JSON.stringify(layout)).toBe(true);
});

test.describe("Cache public réel", () => {
  test.use({ serviceWorkers: "allow" });
  test("lecture des cours après coupure réseau, sans cache des sessions", async ({
    page,
    context,
  }) => {
    await page.goto("/");
    const supported = await page.evaluate(() => "serviceWorker" in navigator);
    test.skip(!supported, "Service worker absent de ce navigateur");
    await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active) throw new Error("not active");
    });
    await page.reload();
    await context.setOffline(true);
    await page.goto("/#/lecon/0.9");
    await expect(page.locator("h1")).toHaveText("Fonctions");
    expect(
      await page.evaluate(async () => {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          for (const request of await cache.keys())
            if (request.url.includes("supabase.co")) return false;
        }
        return true;
      }),
    ).toBe(true);
    await context.setOffline(false);
  });
});

test("stockage indisponible : les cours restent lisibles", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("QuotaExceededError");
    };
  });
  await page.goto("/#/lecon/0.9");
  await expect(page.locator("h1")).toHaveText("Fonctions");
});

test("la synchronisation initiale conserve la note active et son focus", async ({ page }) => {
  const sharedLearning = new Map([["progress", {
    key: "progress", revision: 1,
    payload: { v: 1, done: [], quizzes: {}, exercises: {} },
  }]]);
  await installOwner(page, { sharedLearning });
  let release;
  const initialSync = new Promise(resolve => { release = resolve; });
  await page.route("https://example.supabase.co/rest/v1/learning_records**", async route => {
    await initialSync;
    await route.fallback();
  });
  await signInAs(page);
  await page.goto("/#/lecon/0.9");
  const note = page.getByLabel("Mes notes pour cette leçon");
  await note.fill("Note commencée pendant le chargement");
  const activeNote = await note.elementHandle();
  release();
  await expect.poll(() => sharedLearning.get("lesson/0.9")?.payload.note)
    .toBe("Note commencée pendant le chargement");
  expect(await activeNote.evaluate(node => node.isConnected)).toBe(true);
  await expect(note).toBeFocused();
  await expect(note).toHaveValue("Note commencée pendant le chargement");
});

test("deux appareils voient les notes et détectent une modification concurrente", async ({
  browser,
}) => {
  const sharedLearning = new Map();
  const first = await browser.newContext({ baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" });
  const second = await browser.newContext({ baseURL: "http://127.0.0.1:4173", serviceWorkers: "block" });
  let releasePc;
  const resumePc = new Promise(resolve => { releasePc = resolve; });
  try {
    const pc = await first.newPage(),
      tablet = await second.newPage();
    await installOwner(pc, { sharedLearning });
    await signInAs(pc);
    await pc.goto("/#/lecon/0.9");
    await pc.getByLabel("Mes notes pour cette leçon").fill("Note du PC");
    await expect
      .poll(() => sharedLearning.get("lesson/0.9")?.payload.note)
      .toBe("Note du PC");
    // Le PC garde volontairement la révision 1 pendant la saisie tablette.
    // Sans ce contrôle, un rafraîchissement lié au scroll peut déjà lui
    // apporter la révision 2 : ce ne serait alors plus un conflit.
    await pc.route("https://example.supabase.co/rest/v1/learning_records**", async route => {
      await resumePc;
      await route.fallback();
    });
    await installOwner(tablet, { sharedLearning });
    await signInAs(tablet);
    await tablet.goto("/#/lecon/0.9");
    await expect(tablet.getByLabel("Mes notes pour cette leçon")).toHaveValue(
      "Note du PC",
    );
    await tablet
      .getByLabel("Mes notes pour cette leçon")
      .fill("Version tablette");
    await expect
      .poll(() => sharedLearning.get("lesson/0.9")?.payload.note)
      .toBe("Version tablette");
    await pc
      .getByLabel("Mes notes pour cette leçon")
      .fill("Brouillon PC concurrent");
    await pc.goto("/#/espace");
    releasePc();
    await expect(
      pc.getByRole("heading", { name: "Deux versions à départager" }).first(),
    ).toBeVisible();
    expect(sharedLearning.get("lesson/0.9").payload.note).toBe(
      "Version tablette",
    );
  } finally {
    releasePc();
    await first.close();
    await second.close();
  }
});

test("une restauration est vérifiée avant application et refuse les jetons", async ({
  page,
}) => {
  await installOwner(page);
  await signInAs(page);
  await page.goto("/#/espace");
  const input = page.getByLabel("Sauvegarde à importer");
  await input.setInputFiles({
    name: "interdit.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "ai-from-zero",
        version: 1,
        records: { "sb-token": "secret" },
      }),
    ),
  });
  await expect(
    page.getByRole("button", { name: "Confirmer la restauration" }),
  ).toBeDisabled();
  await input.setInputFiles({
    name: "carnet.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: "ai-from-zero",
        version: 1,
        records: { "lesson/0.9": { note: "Note restaurée" } },
      }),
    ),
  });
  await expect(
    page.getByRole("button", { name: "Confirmer la restauration" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Confirmer la restauration" }).click();
  await page.goto("/#/lecon/0.9");
  await expect(page.getByLabel("Mes notes pour cette leçon")).toHaveValue(
    "Note restaurée",
  );
});

test('saisie tactile conservée lors du passage portrait/paysage et du clavier réduit',async({browser})=>{
 const context=await browser.newContext({baseURL:'http://127.0.0.1:4173',viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
 try{const page=await context.newPage();await installOwner(page);await signInAs(page);await page.goto('/#/lecon/0.9');const note=page.getByLabel('Mes notes pour cette leçon');await note.fill('Note saisie sur mobile');await page.setViewportSize({width:844,height:390});await expect(note).toHaveValue('Note saisie sur mobile');await page.setViewportSize({width:390,height:300});await expect(note).toHaveValue('Note saisie sur mobile');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);}finally{await context.close();}
});
