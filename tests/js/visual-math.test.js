import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { attentionTrace, matmul, graphTrace, normalize, rotate, gelu, silu, routeExperts, scanTrace, loraTrace, descentStep, softmax, quantize } from '../../assets/js/visual-math.js';
import { hasVisualLab } from '../../assets/js/visual-labs.js';
const root = fileURLToPath(new URL('../..', import.meta.url));
const run = spawnSync('python3', ['tests/visual_reference.py'], { cwd: root, encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr);
const reference = JSON.parse(run.stdout);
function close(got, expected, path = '') {
  if (Array.isArray(expected)) { assert.equal(got.length, expected.length, path); expected.forEach((v,i)=>close(got[i],v,`${path}[${i}]`)); }
  else assert.ok(Math.abs(got-expected)<1e-10, `${path}: ${got} != ${expected}`);
}
test('attention visuelle = attention NumPy, lignes normalisées et futur exactement nul', () => {
  const t = attentionTrace(); close(t.weights, reference.weights); close(t.output, reference.output);
  t.weights.forEach((row, i) => { close(row.reduce((a,b)=>a+b),1); row.forEach((n,j)=>{ if(j>i) assert.equal(n,0); }); });
  close(t.weights[1], [.33023845067334306,.6697615493266569,0]);
});
test('matmul accepte les rectangles et refuse des formes internes incompatibles', () => {
  assert.deepEqual(matmul([[1,2,3]],[[1,2],[3,4],[5,6]]),[[22,28]]);
  assert.throws(()=>matmul([[1,2]],[[1,2]]),RangeError);
});
test('backprop du graphe visuel = autograd du cours, y compris la convention en zéro', () => {
  [-2,-1/3,0,2,3].forEach((w,i) => { const t=graphTrace(w); close([t.loss,t.dw],reference.backward[i]); });
  assert.equal(graphTrace(-1/3).dw,0);
});
test('le gradient affiché concorde avec une différence finie hors du coude ReLU', () => {
  for(const w of [-2,0,2,3]) { const e=1e-6; assert.ok(Math.abs(graphTrace(w).dw - (graphTrace(w+e).loss-graphTrace(w-e).loss)/(2*e)) < 1e-6); }
});
test('LayerNorm, RMSNorm, GELU et SiLU retrouvent les primitives du laboratoire', () => {
  close(normalize([1,2,3,4]),reference.layer); close(normalize([1,2,3,4],true),reference.rms);
  close([-3,-1,0,1,3].map(gelu),reference.gelu); close([-3,-1,0,1,3].map(silu),reference.silu);
  assert.deepEqual(normalize([0,0,0],true),[0,0,0]);
});
test('rotation RoPE = NumPy et conserve la norme', () => {
  [0,1,2].forEach((angle,i) => { const p=rotate([1,0],angle); close(p,reference.rope[i]); close(Math.hypot(...p),1); });
});
test('top-k et capacité reproduisent les choix et rejets du vrai MoE', () => {
  for (const r of reference.routes) { const t=routeExperts(undefined,r.k,r.factor); assert.deepEqual(t.choices,r.choices); assert.equal(t.capacity,r.capacity); assert.equal(t.dropped,r.dropped); close(t.aux,r.aux); }
  for(const k of [0,4,1.5]) assert.throws(()=>routeExperts(undefined,k),RangeError);
});
test('état caché = scan séquentiel = scan parallèle du dépôt', () => {
  const out=scanTrace().map(t=>t.state); close(out,reference.scan); close(out,reference.parallel);
  assert.notDeepEqual(scanTrace(undefined,.7,true).map(t=>t.state),out);
});
test('LoRA applique A@B avec la convention du dépôt sans modifier W0', () => {
  for (let rank=1;rank<=4;rank++) { const t=loraTrace(rank); close(t.weight,reference.lora[rank-1]); assert.deepEqual(t.base,[[1,0,0,0],[0,1,0,0],[0,0,1,0],[0,0,0,1]]); }
});
test('le pas 1.1 diverge : le prochain point doit rester inspectable', () => { close(descentStep(2.2,1.1),-2.64); assert.ok(Math.abs(descentStep(-2.64,1.1))>2.64); });
test('softmax reste stable à grande amplitude, quantification bornée', () => {
  close(softmax([10000,10000]),[.5,.5]); close(softmax([0,-Infinity]),[1,0]);
  const q=quantize([-1,-.4,.1,.8],4); assert.ok(q.integers.every(n=>n>=-7&&n<=7));
  q.restored.forEach((n,i)=>assert.ok(Math.abs(n-[-1,-.4,.1,.8][i])<=q.scale/2+1e-12));
});
test('couverture explicite : chaque variante moderne et le tronc mathématique ont un laboratoire', () => {
  const course=JSON.parse(readFileSync(new URL('../../data/curriculum.json',import.meta.url))).levels.flatMap(l=>l.steps);
  for(const id of ['0.15','0.17','0.18','1.5','1.11','1.12','2.6','2.11','4.2','4.5','4.8','4.9',...Array.from({length:10},(_,i)=>`5.${i+1}`),'7.4','8.5','9.2','12.8','13.6','13.7']) assert.equal(hasVisualLab(course.find(l=>l.id===id)),true,id);
});
