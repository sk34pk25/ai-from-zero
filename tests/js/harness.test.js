import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {replyMask,childBudget,memoryMerge,keptGroups,flowTrace} from '../../assets/js/harness-lab.js';
import {validateHarnessChecks,validateHarnessStudy} from '../../assets/js/harness-state.js';
import {parseHash,hrefFor} from '../../assets/js/router.js';
const run=spawnSync('python3',['tests/harness_reference.py'],{cwd:fileURLToPath(new URL('../..',import.meta.url)),encoding:'utf8'});
assert.equal(run.status,0,run.stderr);
const reference=JSON.parse(run.stdout);
test('les adresses du harness gardent programme, projet, module et leçon distincts',()=>{
 for(const hash of ['#/harness','#/harness/projet','#/harness/module/8','#/harness/lecon/h6.3'])assert.equal(hrefFor(parseHash(hash)),hash);
 assert.equal(parseHash('#/harness/lecon/h9.1').name,'notfound');
});
test('le masque illustré reprend exactement les cibles décalées du SFT réel',()=>{
 for(const row of reference.masks)assert.deepEqual(replyMask(row.prompt,row.total),row.mask);
});
test('les budgets enfants et les versions mémoire suivent les fonctions livrées',()=>{
 assert.deepEqual(childBudget(reference.parent,reference.requested),reference.child);
 assert.deepEqual(memoryMerge(reference.memories),reference.merged);
});
test('la compaction garde les mêmes groupes récents, avec leur coût sérialisé',()=>{
 const groups=reference.group_sizes.map((size,i)=>'ABC'[i].repeat(size));
 for(const row of reference.windows)assert.deepEqual(keptGroups(groups,row.budget).map(group=>group[0]),row.kept);
});
test('les refus, accords et limites affichés concordent avec de vraies boucles Python',()=>{
 for(const row of reference.flows){const trace=flowTrace(row.name,2,row.approved);assert.equal(trace.status,row.status,row.name);assert.equal(trace.calls,row.calls,row.name);}
});
const checks={format:'afz-harness-checks-v1',module:'eleve',source_sha256:'a'.repeat(64),total:2,passed:1,checks:[{tp:1,ok:true},{tp:2,ok:false}]};
test('un rapport contradictoire ou dupliqué ne peut pas déclarer les TP réussis',()=>{
 assert.equal(validateHarnessChecks(checks).passed,1);
 for(const patch of [{passed:2},{checks:[{tp:1,ok:true},{tp:1,ok:false}]},{module:'scenario'},{source_sha256:'x'},{total:8}])assert.throws(()=>validateHarnessChecks({...checks,...patch}));
});
test('une sauvegarde garde les 20 dernières tentatives et leur version sans exécuter de code',()=>{
 const receipt={ok:true,codeHash:'b'.repeat(64),validatorVersion:'c'.repeat(64),checkedAt:123};
 const row={studied:true,code:'raise RuntimeError()',note:'ma note',receipt,attempts:Array.from({length:25},(_,i)=>({...receipt,checkedAt:123+i}))};
 const file={format:'afz-harness-study-v1',state:{lessons:{'h1.1':row,'inconnue':row},checks}};
 const saved=validateHarnessStudy(file,['h1.1']);
 assert.deepEqual(Object.keys(saved.lessons),['h1.1']);assert.equal(saved.lessons['h1.1'].attempts.length,20);assert.equal(saved.lessons['h1.1'].attempts[0].checkedAt,128);
 assert.equal(saved.lessons['h1.1'].imported,true);assert.deepEqual(saved.lessons['h1.1'].receipt,receipt);
 assert.throws(()=>validateHarnessStudy({...file,state:{lessons:{'h1.1':{note:5}}}},['h1.1']));
});
