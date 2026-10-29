import test from "node:test";
import assert from "node:assert/strict";
import { localToken, enableLocalLearner, forgetLocalLearner, readLocalProgress, writeLocalProgress, readLocalDrafts, writeLocalDraft } from "../../assets/js/local-records.js";
import { localBackup, draftsFromBackup } from "../../assets/js/learner.js";
import { validateBackup } from "../../assets/js/workspace.js";
function storage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { get length() { return data.size; }, key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: (k) => data.delete(k) };
}
test("deux onglets conservent leurs différences et les retraits", () => {
  const s = storage(); enableLocalLearner(s); const token = localToken(s);
  const a = readLocalProgress(s), b = readLocalProgress(s);
  writeLocalProgress(s, {done:["1.6"], quizzes:{"1.6":{correct:true,choice:1}}}, a, token);
  writeLocalProgress(s, {done:["1.3"], exercises:{"1.3":{ok:true}}}, b, token);
  const both = readLocalProgress(s);
  assert.deepEqual(new Set(both.done), new Set(["1.6","1.3"]));
  assert.equal(both.quizzes["1.6"].correct, true);
  const stale = structuredClone(both);
  writeLocalProgress(s, {...both, done:["1.3"]}, both, token);
  writeLocalProgress(s, {...stale, exercises:{"1.3":{ok:false}}}, stale, token);
  assert.deepEqual(readLocalProgress(s).done, ["1.3"]);
  assert.equal(readLocalProgress(s).exercises["1.3"].ok, false);
});
test("effacer puis réactiver invalide les écritures d'un ancien onglet", () => {
  const s = storage(); enableLocalLearner(s); const old = localToken(s), before = readLocalProgress(s);
  writeLocalDraft(s, "0.23", "mon code", old);
  forgetLocalLearner(s); enableLocalLearner(s);
  assert.notEqual(localToken(s), old);
  assert.equal(writeLocalProgress(s, {done:["1.6"]}, before, old), false);
  assert.equal(writeLocalDraft(s, "0.23", "ancien code", old), false);
  assert.deepEqual(readLocalProgress(s).done, []);
  assert.deepEqual(readLocalDrafts(s), {});
});
test("la progression v1 reste lisible et peut être décochée", () => {
  const s=storage({"afz-local-learner":"1","afz-local-progress-v1":JSON.stringify({done:["0.1"],quizzes:{"0.1":{correct:true}}})});
  const before=readLocalProgress(s);
  assert.deepEqual(before.done,["0.1"]);
  writeLocalProgress(s,{...before,done:[]},before,localToken(s));
  assert.deepEqual(readLocalProgress(s).done,[]);
});
test("les brouillons s'exportent sans perdre le code vide", () => {
  const s=storage(); enableLocalLearner(s); const token=localToken(s);
  writeLocalDraft(s,"0.23","",token);
  const backup=validateBackup(localBackup(readLocalProgress(s),new Date(),readLocalDrafts(s)));
  assert.deepEqual(draftsFromBackup(backup,["0.23"]),{"0.23":""});
  assert.throws(()=>validateBackup({...backup,records:{"lesson/0.23":{exerciseCode:5}}}));
});
