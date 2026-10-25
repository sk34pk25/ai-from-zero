import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { bestPair, trainSteps } from "../../assets/js/bpe.js";
import { forward, loadModel } from "../../assets/js/gpt.js";
import { compatibilityWarning } from "../../assets/js/page-donnees.js";

test("le BPE JavaScript départage comme le laboratoire", () => {
  const steps = trainSteps("abab", 1);
  assert.equal(steps[0].pair.join(""), "ab");
  assert.equal(bestPair(["b", "a", "b", "a"]).pair.join(""), "ba");
});

test("une fiche trop grosse prévient le navigateur et le tokenizer", () => {
  const row = {
    sizeMb: 50,
    gated: false,
    compatibility: { char: false, bpe: true, pyodide: false, numpyCpu: true, needsGpu: false },
  };
  const notes = compatibilityWarning(row, { tokenizer: "char", runtime: "browser" });
  assert.equal(notes.some((note) => note.includes("caractère")), true);
  assert.equal(notes.some((note) => note.includes("navigateur")), true);
  assert.deepEqual(compatibilityWarning(row, { tokenizer: "bpe", runtime: "cpu" }), []);
});

test("les logits JavaScript retrouvent l'argmax du export", () => {
  const dir = mkdtempSync(join(tmpdir(), "afz-gpt-"));
  const out = join(dir, "gpt.json");
  const script = `
from pathlib import Path
from model.export_js import export_browser
from model.gpt_train import train_gpt
model, tok, _ = train_gpt("ab ab ab ab\\n" * 40, steps=2, d_model=8, n_heads=2, n_layers=1, block=8, batch=2, sample=False, eval_windows=1)
export_browser(model, tok, Path(r"""${out}"""), "ab ")
`;
  const run = spawnSync("python3", ["-c", script], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const payload = JSON.parse(readFileSync(out, "utf8"));
  const model = loadModel(payload);
  const result = forward(model, payload.reference.ids);
  const got = result.logits[result.logits.length - 1];
  const expected = payload.reference.logits;
  let bestGot = 0;
  let bestExpected = 0;
  let gap = 0;
  for (let index = 0; index < expected.length; index += 1) {
    gap = Math.max(gap, Math.abs(got[index] - expected[index]));
    if (got[index] > got[bestGot]) bestGot = index;
    if (expected[index] > expected[bestExpected]) bestExpected = index;
  }
  assert.equal(bestGot, bestExpected);
  assert.ok(gap < 1e-3, `écart ${gap}`);
});
