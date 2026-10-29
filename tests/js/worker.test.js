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
