import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import AxeBuilder from "@axe-core/playwright";
const course=JSON.parse(readFileSync(new URL('../../data/harness-curriculum.json',import.meta.url)));
const lessons=course.modules.flatMap(module=>module.lessons);

for(const width of [320,390,768,1440])test(`harness : 32 leçons lisibles à ${width}px`,async({page})=>{
 test.setTimeout(180000);await page.setViewportSize({width,height:900});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/#/harness');
 await expect(page.getByRole('heading',{name:'Construis ton propre harness d’agent.'})).toBeVisible();
 const failures=[];
 for(const lesson of lessons){
  await page.goto('/#/harness/lecon/'+lesson.id);
  await expect(page.locator(`[data-harness-lesson="${lesson.id}"]`)).toBeVisible();
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))failures.push(lesson.id);
 }
 expect(failures).toEqual([]);expect(errors).toEqual([]);
});

test('le parcours, les guides et la recherche prolongent le modèle',async({page})=>{
 await page.goto('/');await page.getByRole('link',{name:'Découvrir le parcours harness de A à Z'}).click();
 await expect(page.getByRole('heading',{name:'Construis ton propre harness d’agent.'})).toBeVisible();
 await expect(page.locator('.harness-module')).toHaveCount(8);
 await page.locator('#project-link').click();await expect(page).toHaveURL(/#\/harness\/projet$/);await expect(page.locator('#harness-project')).toBeFocused();
 await page.getByRole('searchbox',{name:'Rechercher dans le parcours harness'}).fill('SQLite');
 await expect(page.getByRole('link',{name:/H4\.4/})).toBeVisible();
 expect(await page.locator('.harness-module .chapter').count()).toBeLessThan(32);
 await page.getByText('Lire les guides du harness',{exact:true}).click();
 await expect(page.locator('.rendered-guide h2').first()).toContainText('Mon harness');
 await page.getByLabel('Guide du harness').selectOption('harness/MODELE.md');
 await expect(page.locator('.rendered-guide')).toContainText('masque');
 await page.getByRole('button',{name:/Rechercher une notion/}).click();
 await page.getByRole('combobox',{name:'Rechercher une notion'}).fill('h7.3');
 await page.locator('#search-results [role=option]').first().click();
 await expect(page).toHaveURL(/#\/harness\/lecon\/h7\.3$/);
 await expect(page.getByRole('heading',{name:'Déléguer avec un budget partagé'})).toBeVisible();
 await expect(page.locator('#progress-label')).toHaveText('Mon harness · lecture');
});

test('un brouillon, un quiz et une explication se conservent sans compte, puis par export',async({page})=>{
 const sent=[];page.on('request',request=>{if(request.url().includes('supabase.co'))sent.push(request.url());});
 await page.goto('/#/harness/lecon/h1.1');
 await page.getByLabel('Code de l’exercice harness').fill('# mon brouillon');
 await page.getByLabel('Mes notes harness').fill('La décision ne produit pas encore un effet.');
 await page.getByLabel('Mon explication sur un cas nouveau').fill('Le résultat doit venir de l’outil et de son identifiant.');
 const lesson=lessons[0];await page.locator(`[data-harness-choice="${lesson.quiz.answer}"]`).click();
 await page.getByRole('button',{name:'J’ai étudié cette leçon',exact:true}).click();
 await expect(page.locator('#progress-meta')).toContainText('1 / 32');
 await page.getByRole('link',{name:'Programme du harness',exact:true}).click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Exporter mon parcours harness'}).click()]);
 const raw=readFileSync(await download.path());const data=JSON.parse(raw);
 expect(data.state.lessons['h1.1'].code).toBe('# mon brouillon');
 expect(data.state.lessons['h1.1'].studied).toBe(true);
 expect(await page.evaluate(()=>Object.keys(localStorage).filter(key=>key!=='afz-theme'))).toEqual([]);
 await page.reload();await page.getByLabel('Sauvegarde de mon parcours harness').setInputFiles({name:'parcours.json',mimeType:'application/json',buffer:raw});
 await page.goto('/#/harness/lecon/h1.1');
 await expect(page.getByLabel('Mes notes harness')).toHaveValue(data.state.lessons['h1.1'].note);
 await expect(page.getByLabel('Mon explication sur un cas nouveau')).toHaveValue(data.state.lessons['h1.1'].explanation);
 expect(sent).toEqual([]);
});

for(const theme of ['light','dark'])test(`les nouvelles pages et les laboratoires passent axe en ${theme}`,async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#/harness');
 if(await page.locator('html').getAttribute('data-theme')!==theme)await page.getByRole('button',{name:/Activer le thème/}).click();
 for(const route of ['/#/harness','/#/harness/lecon/h2.4','/#/harness/lecon/h4.2','/#/harness/lecon/h6.3','/#/harness/lecon/h7.3']){
  await page.goto(route);await expect(page.locator('.harness-module,.harness-lesson').first()).toBeVisible();
  expect((await new AxeBuilder({page}).include('main').analyze()).violations).toEqual([]);
 }
});

test('les curseurs exposent les budgets, le masque et les refus',async({page})=>{
 await page.goto('/#/harness/lecon/h6.3');
 const lab=page.locator('.harness-lab');
 await expect(lab).toHaveAttribute('data-mask','0011111');
 await lab.getByRole('slider').evaluate(n=>{n.value='5';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(lab).toHaveAttribute('data-mask','0000111');
 await page.goto('/#/harness/lecon/h7.3');
 await expect(lab).toHaveAttribute('data-tools','2');
 await lab.getByRole('slider').evaluate(n=>{n.value='1';n.dispatchEvent(new Event('input',{bubbles:true}));});await expect(lab).toHaveAttribute('data-tools','1');
 await page.goto('/#/harness/lecon/h2.4');
 await expect(lab).toHaveAttribute('data-status','approval_required');
 await lab.getByRole('checkbox').check();await expect(lab).toHaveAttribute('data-status','finished');
 await lab.getByLabel('Scénario de la boucle').selectOption('path');await expect(lab).toHaveAttribute('data-calls','0');
});

test('le catalogue et le module peuvent être retentés après une panne',async({page})=>{
 let broken=true;await page.route('**/assets/js/page-harness.js*',route=>broken?route.abort('failed'):route.continue());
 let unavailable=true;
 await page.route('**/data/harness-index.json*',route=>unavailable?route.fulfill({status:503,body:'indisponible'}):route.continue());
 await page.goto('/#/harness');await expect(page.getByRole('button',{name:'Réessayer le module harness'})).toBeVisible();
 broken=false;
 await page.getByRole('button',{name:'Réessayer le module harness'}).click();
 await expect(page.getByRole('button',{name:'Réessayer le parcours harness'})).toBeVisible();
 unavailable=false;await page.getByRole('button',{name:'Réessayer le parcours harness'}).click();
 await expect(page.locator('.harness-module')).toHaveCount(8);
});

test('une leçon isolée peut être retentée et la navigation annonce son vrai titre',async({page})=>{
 let broken=true;await page.route('**/data/harness/h1.2.json*',route=>broken?route.fulfill({status:503,body:'panne'}):route.continue());
 await page.goto('/#/harness/lecon/h1.1');await page.getByLabel('Mes notes harness').fill('conservée pendant la panne');
 await page.getByRole('link',{name:/Suivante :/}).click();
 await expect(page.getByRole('button',{name:'Réessayer le parcours harness'})).toBeVisible();
 broken=false;await page.getByRole('button',{name:'Réessayer le parcours harness'}).click();
 await expect(page.locator('[data-harness-lesson="h1.2"]')).toBeVisible();
 await page.getByRole('link',{name:/Précédente :/}).click();
 await expect(page.getByLabel('Mes notes harness')).toHaveValue('conservée pendant la panne');
 await expect(page.locator('main h1')).toBeFocused();
});


test('le ZIP téléchargé contient les sources exactes et fonctionne hors du dépôt',async({page})=>{
 await page.goto('/#/harness');
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Télécharger mon harness (.zip)'}).click()]);
 expect(download.suggestedFilename()).toBe('mon-agent.zip');
 const script=`import hashlib,json,os,pathlib,subprocess,sys,tempfile,zipfile
manifest=json.loads(pathlib.Path('data/harness-project.json').read_text())
with zipfile.ZipFile(sys.argv[1]) as archive:
 expected={}
 for path in manifest['files']:
  tail=path[8:] if path.endswith('.md') or path.endswith('LICENSE') else path
  expected['mon-agent/'+tail]=manifest['sha256'][path]
 assert set(archive.namelist())==set(expected)
 for name,sha in expected.items():assert hashlib.sha256(archive.read(name)).hexdigest()==sha,name
 with tempfile.TemporaryDirectory() as target:
  archive.extractall(target)
  for command in ['verifier','evaluer']:
   result=subprocess.run([sys.executable,'-m','harness.'+command,'--module','correction'],cwd=pathlib.Path(target)/'mon-agent',env={**os.environ,'PYTHONPATH':''},capture_output=True,text=True,timeout=30)
   assert result.returncode==0,result.stderr
print('ZIP exact et autonome')`;
 expect(execFileSync('python3',['-c',script,await download.path()],{encoding:'utf8'}).trim()).toBe('ZIP exact et autonome');
});

test('le focus suit les étapes et le compteur se met à jour dès un import',async({page})=>{
 await page.goto('/#/harness/lecon/h2.4');
 const lab=page.locator('.harness-lab'),next=lab.getByRole('button',{name:'Inspecter l’étape suivante'});
 await next.click();await expect(next).toBeFocused();
 await lab.locator('.harness-node').first().click();await expect(lab.locator('[aria-current=step]')).toBeFocused();
 await page.goto('/#/harness');
 const data={format:'afz-harness-study-v1',state:{lessons:{'h1.1':{studied:true,note:'importée'}}}};
 await page.getByLabel('Sauvegarde de mon parcours harness').setInputFiles({name:'parcours.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))});
 await expect(page.locator('main > .lead')).toContainText('1 / 32');
 await expect(page.locator('#harness-module-1 .eyebrow')).toContainText('1 / 4');
});

test.describe('Lecture hors connexion du harness',()=>{
 test.use({serviceWorkers:'allow'});
 test('le programme, les leçons et les guides sont disponibles après installation',async({page,context})=>{
  await page.goto('/#/harness');
  test.skip(!await page.evaluate(()=> 'serviceWorker' in navigator),'Service worker absent');
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await page.reload();await context.setOffline(true);
  await page.goto('/#/harness/lecon/h6.3');
  await expect(page.locator('[data-harness-lesson=h6\\.3]')).toBeVisible();
  await page.goto('/#/harness');await page.getByText('Lire les guides du harness',{exact:true}).click();
  await expect(page.locator('.rendered-guide')).toContainText('Mon harness');
  await context.setOffline(false);
 });
});
