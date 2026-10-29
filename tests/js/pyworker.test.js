import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../assets/js/pyworker.js", import.meta.url), "utf8");

function harness({ scriptFailures = 0, packageFailures = 0 } = {}) {
  const calls = { script: 0, engine: 0, numpy: 0 };
  const messages = [];
  const self = { postMessage: message => messages.push(structuredClone(message)) };
  runInNewContext(source, {
    self,
    importScripts() {
      if (++calls.script <= scriptFailures) throw new Error("réseau indisponible");
    },
    async loadPyodide() {
      calls.engine += 1;
      let ready = false;
      return {
        async loadPackage() {
          if (++calls.numpy <= packageFailures) throw new Error("NumPy indisponible");
          ready = true;
        },
        runPython() { assert.equal(ready, true, "NumPy doit être chargé"); },
        async runPythonAsync() {
          if (!ready) throw new Error("NumPy absent du moteur partiel");
          return 31;
        },
        setStdout() {}, setStderr() {},
      };
    },
  });
  return {
    calls,
    async run() {
      await self.onmessage({ data: { type: "run", code: "calcul" } });
      return messages.at(-1);
    },
  };
}

test("le moteur retente le téléchargement après une erreur réseau", async () => {
  const worker = harness({ scriptFailures: 1 });
  assert.equal((await worker.run()).type, "error");
  assert.deepEqual(await worker.run(), { type: "done", text: "31" });
  assert.equal(worker.calls.script, 2);
});

test("un chargement NumPy interrompu ne publie pas un moteur partiel", async () => {
  const worker = harness({ packageFailures: 1 });
  assert.equal((await worker.run()).type, "error");
  assert.deepEqual(await worker.run(), { type: "done", text: "31" });
  assert.equal(worker.calls.numpy, 2);
});

test("un moteur prêt est réutilisé sans recharger Python ou NumPy", async () => {
  const worker = harness();
  assert.equal((await worker.run()).type, "done");
  assert.equal((await worker.run()).type, "done");
  assert.deepEqual(worker.calls, { script: 1, engine: 1, numpy: 1 });
});
