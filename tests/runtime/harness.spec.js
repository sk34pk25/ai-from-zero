import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const course=JSON.parse(readFileSync(new URL('../../data/harness-curriculum.json',import.meta.url)));
const lessons=course.modules.flatMap(module=>module.lessons);
const files=course.browserFiles.map(path=>({path,content:readFileSync(new URL('../../'+path,import.meta.url),'utf8')}));

test('les 32 exemples et 32 reconstructions passent dans Python réel, sans fonction résiduelle',async({page})=>{
 await page.goto('/#/harness');
 const failures=await page.evaluate(async({lessons,files})=>{
  const map=JSON.parse(document.querySelector('#afz-importmap').textContent);
  const bridge=await import(map.scopes['./assets/js/']['./assets/js/pybridge.js']);
  const errors=[];
  for(const row of lessons){
   for(const [kind,code]of [['exemple',row.code],['solution',row.exercise.solution+'\n'+row.exercise.check]]){
    const result=await bridge.request({type:'exercise',code,files});
    if(result.type!=='done')errors.push({id:row.id,kind,result});
   }
  }
  const blank=await bridge.request({type:'exercise',code:lessons[0].exercise.check,files});
  if(blank.type!=='error')errors.push({kind:'isolation',blank});
  return errors;
 },{lessons,files});
 expect(failures).toEqual([]);
});

test('le code modifié invalide le contrôle, l’arrêt conserve le brouillon et Python redémarre',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/#/harness/lecon/h1.1');
 const code=page.getByLabel('Code de l’exercice harness'),check=page.getByRole('button',{name:'Lancer le contrôle harness'}),status=page.locator('[data-harness-result]');
 await code.fill(lessons[0].exercise.solution);await check.click();await expect(status).toContainText('contrôle passé');
 await code.fill(lessons[0].exercise.solution+'\n# nouveau brouillon');await expect(status).toContainText('code modifié');
 await check.click();await expect(status).toContainText('contrôle passé');
 await code.fill('while True:\n    pass');await check.click();await page.getByRole('button',{name:'Arrêter Python',exact:true}).click();
 await expect(status).toContainText('Exécution arrêtée');await expect(code).toHaveValue('while True:\n    pass');
 await code.fill(lessons[0].exercise.solution);await check.click();await expect(status).toContainText('contrôle passé');
 await page.getByRole('button',{name:'Exécuter cet exemple Python'}).click();
 await expect(page.getByText('Exemple exécuté dans Python.',{exact:false})).toBeVisible();
 await page.goto('/#/harness');await page.getByRole('button',{name:'Exécuter la boucle Python de référence'}).click();
 await expect(page.locator('[data-harness-demo]')).toContainText('finished · réponse 36 · 2 tours · 1 outil');
 await expect(page.locator('[data-harness-demo]')).toContainText('scenario-scripted');
});

test('une panne du moteur ne fabrique aucun résultat et le même code peut être retenté',async({page,context})=>{
 let broken=true;
 await context.route('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js',route=>broken?route.abort('failed'):route.continue());
 await page.goto('/#/harness/lecon/h1.1');
 const code=page.getByLabel('Code de l’exercice harness'),check=page.getByRole('button',{name:'Lancer le contrôle harness'}),status=page.locator('[data-harness-result]');
 await code.fill(lessons[0].exercise.solution);await check.click();await expect(status).toContainText('Python n’est pas prêt');
 await expect(code).toHaveValue(lessons[0].exercise.solution);
 broken=false;await check.click();await expect(status).toContainText('contrôle passé');
});
