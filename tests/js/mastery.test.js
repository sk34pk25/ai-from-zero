import test from "node:test";
import assert from "node:assert/strict";
import { codeFingerprint, normalizeExerciseResult, exerciseState } from "../../assets/js/exercise-result.js";
import { normalizeProgress } from "../../assets/js/progress.js";
import { activeMilliseconds, validateAssessmentFile } from "../../assets/js/assessment.js";
import { readLocalProgress, writeLocalProgress, enableLocalLearner, localToken } from "../../assets/js/local-records.js";

const version = "a".repeat(64), newVersion = "b".repeat(64);
test("une réussite ne valide ni un code modifié ni un autre contrat ; les anciennes données restent lisibles", async () => {
  const source = "def prediction(x,w,b): return w*x+b";
  const codeHash = await codeFingerprint(source);
  const receipt = { ok: true, codeHash, validatorVersion: version, checkedAt: 1000 };
  assert.equal(exerciseState(receipt, await codeFingerprint(source), version), "passed");
  assert.equal(exerciseState(receipt, await codeFingerprint("def prediction(x,w,b): return 7"), version), "modified");
  assert.equal(exerciseState(receipt, codeHash, newVersion), "outdated");
  assert.equal(exerciseState({ok:true}, codeHash, version), "legacy");
  assert.equal(exerciseState({...receipt,ok:false},codeHash,version),"failed");
  assert.equal(exerciseState(receipt,null,version),"modified");
  assert.deepEqual(normalizeProgress({exercises:{"1.4":receipt}}).exercises["1.4"],receipt);
  assert.deepEqual(normalizeExerciseResult({ok:true, codeHash:"invalid", validatorVersion:4, checkedAt:-1}),{ok:true});
});
test("les reçus conservent leurs empreintes après sauvegarde locale et lecture", async () => {
  const data = new Map();
  const storage = {get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};
  enableLocalLearner(storage);
  const receipt = {ok:false,codeHash:await codeFingerprint("return 7"),validatorVersion:version,checkedAt:1000};
  assert.equal(writeLocalProgress(storage,{exercises:{"1.4":receipt}},null,localToken(storage)),true);
  assert.deepEqual(readLocalProgress(storage).exercises["1.4"],receipt);
});
const attempt = () => ({id:"test-attempt",taskId:"task-A",code:"pass",diagnosis:"",explanation:"",alias:"",device:"",siteVersion:"v1",taskVersion:version,events:[{type:"start",at:1000},{type:"pause",at:3000},{type:"resume",at:4000},{type:"finish",at:7000}],assistance:[],checks:[],origin:"local"});
const file = row => ({format:"afz-comprehension-v1",attempts:[row]});
const tasks = [{id:"task-A"}];
test("le chronomètre exclut la pause et conserve les abandons", () => {
  assert.equal(activeMilliseconds(attempt().events,9000),5000);
  assert.equal(activeMilliseconds([{type:"start",at:1000},{type:"abandon",at:2500}],9000),1500);
  assert.equal(activeMilliseconds([{type:"start",at:1000}],3000),2000);
});
test("aucun dossier vide ne déclare une observation ; un import reste déclaré et n’exécute rien", () => {
  assert.deepEqual(validateAssessmentFile({format:"afz-comprehension-v1",attempts:[]},tasks).attempts,[]);
  assert.equal(validateAssessmentFile(file(attempt()),tasks).attempts[0].origin,"imported");
  assert.equal(validateAssessmentFile(file(attempt()),tasks,{imported:false}).attempts[0].origin,"local");
  assert.equal(validateAssessmentFile(file(attempt()),tasks).attempts[0].review,undefined);
});
test("l’import rejette résultats sans empreinte, fausses chronologies et observation sans faits", () => {
  for(const patch of [{taskId:"missing"},{events:[{type:"start",at:3000},{type:"finish",at:2000}]},{events:[{type:"start",at:1000},{type:"resume",at:2000}]},{checks:[{ok:true}]},{review:{type:"observer",by:"",scores:[2,2,2],evidence:"",contentHash:version}}])
    assert.throws(()=>validateAssessmentFile(file({...attempt(),...patch}),tasks));
  assert.throws(()=>validateAssessmentFile({format:"afz-comprehension-v1",attempts:[attempt(),attempt()]},tasks));
});
