import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const open = async (page,id) => { await page.goto(`/#/lecon/${id}`); await expect(page.locator('[data-visual-host]')).toBeVisible(); return page.locator('[data-visual-host]'); };
const setRange = async (locator,value) => { await locator.evaluate((el,v)=> {el.value=String(v);el.dispatchEvent(new Event('input',{bubbles:true}));},value); };

test('matrices : une cellule et ses facteurs répondent au clic et au clavier', async ({page}) => {
  const host=await open(page,'0.18');
  await host.getByLabel('Valeur A ligne 0 colonne 0').fill('3');
  await expect(host.locator('.lab-stage')).toContainText('C[0, 0] = 3 × 2 + 2 × 1 = 6 + 2 = 8');
  const cell=host.getByRole('button',{name:'C = A @ B, ligne 1, colonne 1 : 12',exact:true});
  await cell.focus(); await page.keyboard.press('Enter');
  await expect(host.locator('.lab-stage')).toContainText('C[1, 1] = 3 × 0 + 4 × 3 = 0 + 12 = 12');
  await host.getByText('À toi de prédire',{exact:true}).click();
  const input=host.getByLabel('Avec A et B affichées, combien vaut C[0, 0] ?');
  await input.fill('7'); await input.press('Enter'); await expect(host.locator('.lab-feedback')).toHaveAttribute('data-correct','false');
  await input.fill('8'); await input.press('Enter'); await expect(host.locator('.lab-feedback')).toHaveAttribute('data-correct','true');
});

test('backprop : la ligne active suit les valeurs et un neurone bloqué reçoit zéro', async ({page}) => {
  const host=await open(page,'1.12');
  for(let i=0;i<5;i++) await host.getByRole('button',{name:'Calcul suivant',exact:true}).click();
  await expect(host.locator('.lab-code [aria-current="step"]')).toContainText('dw = dy');
  await expect(host.locator('.lab-stage')).toContainText('6 × 1 × 3 = 18');
  await setRange(host.getByLabel('Poids w du neurone'),-1);
  await expect(host.locator('.lab-stage')).toContainText('−8'.replace('−','-')+' × 0 × 3 = 0');
  await host.getByRole('button',{name:'Rejouer',exact:true}).click();
  await expect(host).toHaveAttribute('data-step','0');
});

test('ReLU en zéro utilise la convention du moteur et le point de divergence reste visible', async ({page}) => {
  let host=await open(page,'1.6'); await setRange(host.getByLabel('Entrée de ReLU'),0);
  await expect(host).toHaveAttribute('data-gradient','0'); await expect(host).toContainText('Non dérivable en zéro');
  host=await open(page,'1.13'); await setRange(host.getByLabel('Pas d’apprentissage'),1.1); await host.getByRole('button',{name:'Un pas',exact:true}).click();
  await expect(host).toHaveAttribute('data-x','-2.6400000000000006');
  const point=host.locator('[data-chart-point]');
  const cy=Number(await point.getAttribute('cy')); expect(cy).toBeGreaterThan(6); expect(cy).toBeLessThan(252);
  await expect(host).toContainText('Divergence'); await expect(host.locator('svg')).toContainText('Paramètre x');
});

test('attention : vrais scores, futur masqué, softmax et mélange des valeurs', async ({page}) => {
  const host=await open(page,'4.5');
  await expect(host.locator('.lab-stage')).toContainText('−∞');
  await host.getByRole('button',{name:'Calcul suivant',exact:true}).click();
  await expect(host.locator('.lab-stage')).toContainText('0.330'); await expect(host.locator('.lab-stage')).toContainText('0.670');
  await host.getByRole('button',{name:'Calcul suivant',exact:true}).click();
  await expect(host.locator('.lab-stage')).toContainText('0.660'); await expect(host.locator('.lab-stage')).toContainText('1.340');
  await host.getByText('À toi de prédire',{exact:true}).click(); await host.getByLabel('Pour « chat », quel poids reçoit le futur « dort » ?').fill('0');
  await host.getByRole('button',{name:'Vérifier la prédiction',exact:true}).click(); await expect(host.locator('.lab-feedback')).toHaveAttribute('data-correct','true');
});

test('MoE : k experts sélectionnés, rejets et capacité suivent les mêmes commandes', async ({page}) => {
  const host=await open(page,'7.4');
  await setRange(host.getByLabel('Facteur de capacité'),3); await setRange(host.getByLabel('Experts actifs par token (top-k)'),3);
  await expect(host).toHaveAttribute('data-top-k','3'); await expect(host).toHaveAttribute('data-dropped','0'); await expect(host.locator('.route-ok')).toHaveCount(9);
  await setRange(host.getByLabel('Facteur de capacité'),.5); await expect(host).toHaveAttribute('data-dropped','6'); await expect(host.locator('.route-drop')).toHaveCount(6);
  await expect(page.locator('[data-manipulator="7.4"]')).toHaveCount(0);
});

test('tokenizer et BPE : IDs stables, Unicode, plusieurs fusions et reconstruction', async ({page}) => {
  let host=await open(page,'2.4');
  await host.getByLabel('Texte à découper').fill('chat'); const before=await host.locator('.lab-nodes li').allTextContents();
  await host.getByLabel('Texte à découper').fill('chat🙂'); await expect(host).toContainText('hors vocabulaire caractère'); expect((await host.locator('.lab-nodes li').allTextContents()).slice(0,4)).toEqual(before);
  await host.getByLabel('Texte à découper').fill('é🙂'); await expect(host).toContainText('2 points de code Unicode ; 6 octets UTF-8');
  host=await open(page,'13.1'); await host.getByRole('button',{name:'Fusionner',exact:true}).click(); await host.getByRole('button',{name:'Fusionner',exact:true}).click();
  await expect(host).toHaveAttribute('data-tokens','4'); await expect(host).toContainText('Rang 1'); await expect(host).toContainText('Reconstruction exacte : « abab ababab »');
  await host.getByRole('button',{name:'Rejouer',exact:true}).click(); await expect(host).toHaveAttribute('data-tokens','11');
});

test('RoPE, GQA, cache, scan, patches, LoRA et masque SFT changent le calcul visible', async ({page}) => {
  let host=await open(page,'5.2'); const rope=await host.locator('svg path').getAttribute('d'); await host.getByLabel('Position RoPE').press('ArrowRight'); expect(await host.locator('svg path').getAttribute('d')).not.toBe(rope);
  host=await open(page,'5.5'); await host.getByLabel('Nombre de têtes KV').selectOption('1'); await expect(host).toContainText('MQA : 4 têtes Q, 1 tête(s) KV'); await expect(host).toContainText('128 octets');
  host=await open(page,'5.6'); await host.getByRole('button',{name:'Ajouter un token'}).click(); await expect(host.locator('.lab-nodes li')).toHaveCount(2); await expect(host).toContainText('[1,2,2,2]');
  host=await open(page,'8.6'); const scan=await host.locator('.lab-nodes').innerText(); await host.getByLabel('Sélectivité selon le signal').uncheck(); await expect(host.locator('.lab-nodes')).not.toHaveText(scan);
  host=await open(page,'9.2'); await host.getByLabel('Patch à extraire').press('ArrowRight'); await expect(host).toContainText('Patch 1 : lignes 0–1, colonnes 2–3 → [2, 3, 6, 7] → token [8, 10]');
  host=await open(page,'13.7'); await host.getByLabel('Rang LoRA').press('ArrowRight'); await expect(host).toContainText('A[4,2] @ B[2,4]');
  host=await open(page,'13.6'); await expect(host).toContainText('2 cible(s) comptée(s)'); await host.getByLabel('Inclure le prompt dans la perte').check(); await expect(host).toContainText('6 cible(s) comptée(s)');
});

test('courbe publiée : unités, légende, tirets et valeurs exactes accessibles', async ({page}) => {
  await page.goto('/#/construire'); await page.locator('.published-results > summary').click(); const host=page.locator('[data-run-host]');
  await expect(host).toContainText('Perte (nats / token)'); await expect(host).toContainText('Train, bleu, trait continu'); await expect(host).toContainText('Validation, vert, tirets');
  await expect(host.locator('polyline.is-val')).toHaveAttribute('stroke-dasharray','6 4');
  await setRange(host.getByLabel('Pas réel à inspecter'),1); await expect(host).toContainText('validation = non mesurée à ce pas');
  await host.getByText('Valeurs de validation, sans dépendre de la courbe',{exact:true}).click(); await expect(host.locator('table')).toBeVisible();
});

for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]) test(`laboratoires lisibles à ${width}px : navigation, thèmes, clavier et mouvements réduits`, async ({page}) => {
  await page.setViewportSize({width,height}); await page.emulateMedia({reducedMotion:'reduce'});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  for(const id of ['0.18','1.12','4.5','5.2','5.5','7.4','9.2','13.6','13.7']) {
    const host=await open(page,id);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),id).toBe(true);
    await expect(host).not.toHaveClass(/visual-live/);
    if(id==='4.5') {
      if(width<1200) { await host.getByRole('button',{name:'Code de l’étape',exact:true}).click(); await expect(host.locator('.lab-code')).toBeVisible(); await host.getByRole('button',{name:'Calcul et schéma',exact:true}).click(); }
      await page.getByRole('button',{name:'Observer et manipuler',exact:true}).click();
      const first=await host.locator('.lab-stage').boundingBox(); expect(first.y).toBeLessThan(width<600 ? 850 : 950);
      const axe=await new AxeBuilder({page}).analyze(); expect(axe.violations,JSON.stringify(axe.violations)).toEqual([]);
    }
  }
  expect(errors).toEqual([]);
  await page.evaluate(()=>document.documentElement.dataset.theme='light');
  const light=await new AxeBuilder({page}).analyze(); expect(light.violations,JSON.stringify(light.violations)).toEqual([]);
  await page.screenshot({path:test.info().outputPath(`laboratoire-${width}.png`),fullPage:true});
});

test('échantillonnage, modalités et protocoles illustrent des mécanismes distincts', async ({page}) => {
  let host=await open(page,'3.7'); await setRange(host.getByLabel('Top-k des tokens'),1);
  await setRange(host.getByLabel('Tirage uniforme u'),.99); await expect(host).toContainText('→ token t0');
  await setRange(host.getByLabel('Top-k des tokens'),4); await setRange(host.getByLabel('Tirage uniforme u'),.999); await expect(host).toContainText('→ token t3');
  host=await open(page,'9.4'); await expect(host).toContainText('pic dans la case k=2'); await host.getByLabel('Modalité à suivre').selectOption('image'); await expect(host).toContainText('[N,P×P×C]');
  host=await open(page,'10.6'); await setRange(host.getByLabel('Nombre de raffinements'),5); await expect(host.locator('.lab-nodes li')).toHaveCount(5);
  host=await open(page,'12.3'); await host.getByLabel('Changer aussi le jeu de validation').check(); await expect(host).toContainText('Conclusion refusée');
  host=await open(page,'6.8'); await host.getByLabel('Activer le checkpointing des activations').check(); await expect(host).toContainText('calcul supplémentaire au backward');
});

test('Mon modèle ouvre le trajet numérique sans exiger un compte', async ({page}) => {
  await page.goto('/#/modele'); await page.getByRole('button',{name:'Ouvrir le trajet numérique',exact:true}).click();
  const host=page.locator('[data-architecture-lab]'); await expect(host.locator('.lab-stage')).toContainText('T=3, D=2, V=3');
  await host.getByRole('button',{name:'Calcul suivant',exact:true}).click(); await expect(host.locator('.lab-code [aria-current="step"]')).toContainText('context =');
});
