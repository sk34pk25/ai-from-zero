/** Worker Pyodide. Le fil principal reste libre : un pas d'entraînement = un message. */

let pyodide = null;
let booting = null;

async function ensure() {
  if (pyodide) return pyodide;
  if (!booting) {
    booting = (async () => {
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
      const python = await loadPyodide();
      await python.loadPackage("numpy");
      python.runPython("import numpy");
      pyodide = python;
      return pyodide;
    })().catch((error) => {
      booting = null;
      throw error;
    });
  }
  return booting;
}

function writeFiles(files) {
  const root = "/course";
  if (!pyodide.FS.analyzePath(root).exists) pyodide.FS.mkdir(root);
  const model = `${root}/model`;
  if (!pyodide.FS.analyzePath(model).exists) pyodide.FS.mkdir(model);
  for (const file of files || []) {
    const parts = file.path.split("/");
    let cursor = root;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor += `/${parts[index]}`;
      if (!pyodide.FS.analyzePath(cursor).exists) pyodide.FS.mkdir(cursor);
    }
    pyodide.FS.writeFile(`${root}/${file.path}`, file.content);
  }
  pyodide.runPython(`
import sys
if "/course" not in sys.path:
    sys.path.insert(0, "/course")
for name in list(sys.modules):
    if name == "model" or name.startswith("model."):
        del sys.modules[name]
`);
}

const DEBUG_SCRIPT = `
import json, sys
import numpy as np
snaps = []
def _trace(frame, event, arg):
    if event == "line" and frame.f_code.co_filename == "<string>" and len(snaps) < 80:
        local = {}
        for key, value in list(frame.f_locals.items()):
            if str(key).startswith("_"):
                continue
            if isinstance(value, np.ndarray):
                local[str(key)] = {"kind": "array", "shape": [int(v) for v in value.shape], "preview": [float(v) for v in value.ravel()[:12]]}
            else:
                local[str(key)] = {"kind": "text", "text": repr(value)[:160]}
        snaps.append({"line": int(frame.f_lineno), "locals": local})
        if len(snaps) >= 80:
            sys.settrace(None)
    return _trace
sys.settrace(_trace)
try:
    exec(user_code, {"np": np, "numpy": np})
finally:
    sys.settrace(None)
json.dumps(snaps)
`;

self.onmessage = async (event) => {
  const msg = event.data || {};
  let phase = "loading";
  try {
    const python = await ensure();
    self.postMessage({ type: "booted" });
    phase = "dependencies";
    if (msg.files?.length) writeFiles(msg.files);
    phase = "execution";
    if (msg.type === "boot") {
      self.postMessage({ type: "ready" });
      return;
    }
    python.setStdout({ batched: (text) => self.postMessage({ type: "stdout", text: String(text) }) });
    python.setStderr({ batched: (text) => self.postMessage({ type: "stdout", text: String(text) }) });
    if (msg.type === "run" || msg.type === "exercise") {
      // L'IDE garde sa session. Un contrôle ne doit jamais réutiliser une ancienne fonction.
      const namespace = msg.type === "exercise" ? python.runPython('{"__name__": "__exercise__"}') : null;
      try {
        const value = await python.runPythonAsync(msg.code || "", namespace ? { globals: namespace, locals: namespace } : undefined);
        self.postMessage({ type: "done", text: value == null ? "" : String(value) });
      } finally { namespace?.destroy(); }
      return;
    }
    if (msg.type === "train-init") {
      python.globals.set("train_text", msg.text || "le chat dort. ");
      python.globals.set("train_steps", Number(msg.steps || 8));
      await python.runPythonAsync(`
from model.live import LiveTrainer
trainer = LiveTrainer(train_text * 40, steps=int(train_steps), lr=0.08, batch=2, block=12, d_model=16, n_heads=2, n_layers=1, seed=0)
`);
      self.postMessage({ type: "ready" });
      return;
    }
    if (msg.type === "train-step") {
      const raw = await python.runPythonAsync("import json\njson.dumps(trainer.step())");
      self.postMessage({ type: "loss", payload: JSON.parse(String(raw)) });
      return;
    }
    if (msg.type === "train-sample") {
      const raw = await python.runPythonAsync("trainer.sample('le chat ', 16, temperature=0.0, top_k=1, seed=0)");
      self.postMessage({ type: "sample", text: String(raw) });
      return;
    }
    if (msg.type === "debug") {
      python.globals.set("user_code", msg.code || "");
      const raw = await python.runPythonAsync(DEBUG_SCRIPT);
      self.postMessage({ type: "done", snapshots: JSON.parse(String(raw)) });
      return;
    }
    self.postMessage({ type: "error", text: "message inconnu" });
  } catch (error) {
    self.postMessage({ type: "error", phase, text: String(error && error.message ? error.message : error) });
  }
};
