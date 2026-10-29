import { test, expect } from '@playwright/test';
import { installOwner, signInAs } from './session.js';

for (const viewport of [
  {width: 320, height: 568}, {width: 390, height: 844},
  {width: 768, height: 1024}, {width: 1024, height: 768},
  {width: 1280, height: 800}, {width: 1920, height: 1080},
  {width: 844, height: 390},
]) {
  test(`les pages restent dans l'écran ${viewport.width}×${viewport.height}`, async ({page}) => {
    await page.setViewportSize(viewport);
    for (const route of ['accueil', 'parcours', 'lecon/4.5', 'donnees', 'playground', 'ide', 'connexion']) {
      await page.goto(`/#/${route}`);
      await expect(page.locator('h1')).toBeVisible();
      if (route === 'playground') await expect(page.locator('#play-generate')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), route).toBe(true);
    }
  });
}

test('invite vide et caractères inconnus : message puis reprise possible', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/playground');
  await expect(page.locator('#play-generate')).toBeEnabled();
  await page.locator('#play-prompt').fill('');
  await page.locator('#play-generate').click();
  await expect(page.getByRole('status').filter({hasText: 'Écris une invite'})).toBeVisible();
  await expect(page.locator('#play-generate')).toBeEnabled();
  await page.locator('#play-prompt').fill('😀');
  await page.locator('#play-generate').click();
  await expect(page.getByRole('status').filter({hasText: 'caractères absents'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('IDE : rétablir remplace le code modifié par le fichier du dépôt', async ({page}) => {
  await installOwner(page);
  await signInAs(page);
  await page.goto('/#/ide');
  const editor = page.locator('.cm-content');
  await expect(editor).toBeVisible();
  const original = await editor.innerText();
  await editor.fill("print('modification temporaire')");
  await page.locator('#ide-reset').click();
  await expect(page.locator('#ide-output')).toContainText('Fichier rétabli');
  await expect.poll(() => page.locator('.cm-content').innerText()).toBe(original);
});


test('le calcul du playground produit des tokens et peut être interrompu', async ({page}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/#/playground');
  await expect(page.locator('#play-generate')).toBeEnabled();
  await page.locator('#play-generate').click();
  await expect(page.locator('#play-tokens .token-chip').first()).toBeVisible();
  await page.locator('#play-stop').click();
  await expect(page.locator('#play-generate')).toBeEnabled();
  expect(errors).toEqual([]);
});
