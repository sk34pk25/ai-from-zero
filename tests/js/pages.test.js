import assert from "node:assert/strict";
import test from "node:test";

/** Un DOM minimal suffit : on vérifie que les pages se construisent sans erreur et lisent leurs entrées. */
class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attrs = {};
    this.className = "";
    this.textContent = "";
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  replaceChildren(...nodes) {
    this.children = nodes;
  }
  setAttribute(key, value) {
    this.attrs[key] = value;
  }
  addEventListener() {}
  text() {
    return [this.textContent, ...this.children.map((c) => (c instanceof FakeNode ? c.text() : String(c.data ?? "")))].join(" ");
  }
}
globalThis.Node = FakeNode;
globalThis.document = {
  createElement: (tag) => new FakeNode(tag),
  createTextNode: (data) => Object.assign(new FakeNode("#text"), { textContent: data }),
  createElementNS: (_ns, tag) => new FakeNode(tag),
};

const { paintTrack } = await import("../../assets/js/page-track.js");
const { paintModel } = await import("../../assets/js/page-model.js");

test("la piste se construit et compte les étapes cochées", () => {
  const main = new FakeNode("main");
  paintTrack(main, {
    track: [
      { title: "A", step: "0.1", file: "model/a.py", summary: "a" },
      { title: "B", step: "0.2", file: "model/b.py", summary: "b" },
    ],
    done: new Set(["0.1"]),
    reports: { gptRun: null, finetuneRun: null },
    loadReports: () => new Promise(() => {}),
    isCurrent: () => true,
  });
  const text = main.text();
  assert.match(text, /Construire ton LLM/);
  assert.match(text, /1 \/ 2 étapes de la piste déjà cochées/);
  assert.match(text, /Étape 1 · cochée/);
});

test("Mon modèle allume les briques acquises et signale la sélection", () => {
  const main = new FakeNode("main");
  let picked = null;
  paintModel(main, {
    architecture: [
      { id: "x", name: "Bloc X", step: "1.1", summary: "x" },
      { id: "y", name: "Bloc Y", step: "1.2", summary: "y" },
    ],
    done: new Set(["1.2"]),
    selectedPart: "y",
    onSelect: (id) => (picked = id),
  });
  const text = main.text();
  assert.match(text, /Architecture évolutive/);
  assert.match(text, /Acquis/);
  assert.match(text, /Cette brique est débloquée/);
  assert.equal(picked, null);
});
