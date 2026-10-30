import assert from 'node:assert/strict';
import test from 'node:test';
import { request, getWorker, stopWorker } from '../../assets/js/pybridge.js';
class WorkerMock {
  handlers = new Map();
  addEventListener(type, fn) { this.handlers.set(type, fn); }
  postMessage() {}
  terminate() {}
  emit(data) { this.handlers.get('message')({ data }); }
}
test('worker : concurrence refusée, résultat conservé, arrêt et panne libèrent les attentes', async () => {
  globalThis.Worker = WorkerMock;
  try {
    const first = request({type: 'run'});
    assert.equal((await request({type: 'debug'})).type, 'error');
    getWorker().emit({type: 'done', text: 'premier'});
    assert.equal((await first).text, 'premier');
    const cancelled = request({type: 'run'});
    stopWorker();
    assert.equal((await cancelled).cancelled, true);
    const broken = request({type: 'run'});
    getWorker().handlers.get('error')();
    assert.equal((await broken).type, 'error');
    const next = request({type: 'run'});
    getWorker().emit({type: 'done', text: 'repris'});
    assert.equal((await next).text, 'repris');
  } finally { stopWorker(); delete globalThis.Worker; }
});

test('un démarrage bloqué expire, libère le worker et permet de réessayer', async () => {
  globalThis.Worker = WorkerMock;
  try {
    const expired = await request({ type: 'exercise' }, undefined, { bootTimeoutMs: 10 });
    assert.equal(expired.type, 'error');
    assert.match(expired.text, /délai/);
    const next = request({ type: 'exercise' });
    getWorker().emit({ type: 'done', text: 'repris après panne' });
    assert.equal((await next).text, 'repris après panne');
  } finally { stopWorker(); delete globalThis.Worker; }
});

test('le délai de chargement ne coupe pas un calcul déjà démarré', async () => {
  globalThis.Worker = WorkerMock;
  try {
    const task = request({ type: 'run' }, undefined, { bootTimeoutMs: 10 });
    getWorker().emit({ type: 'booted' });
    await new Promise(resolve => setTimeout(resolve, 25));
    getWorker().emit({ type: 'done', text: 'calcul terminé' });
    assert.equal((await task).text, 'calcul terminé');
  } finally { stopWorker(); delete globalThis.Worker; }
});
