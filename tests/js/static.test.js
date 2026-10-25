import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ASSET_VERSION } from "../../assets/js/version.js";
import { assetHash, importMap } from "../../scripts/stamp-assets.mjs";

const root = new URL("../..", import.meta.url);

function read(relative) {
  return readFileSync(new URL(relative, root), "utf8");
}

test("le script de thème est bloquant et précède la feuille de style", () => {
  const html = read("index.html");
  const scriptAt = html.indexOf('localStorage.getItem("afz-theme")');
  const cssAt = html.indexOf('href="assets/css/style.css?v=');
  assert.ok(scriptAt > 0);
  assert.ok(cssAt > scriptAt);
  assert.match(html, /lang="fr"/);
  assert.match(html, /favicon\.svg/);
  assert.doesNotMatch(html, /assets\/app\.js|assets\/lessons\.js|assets\/style\.css/);
});

test("le JavaScript du site ne passe pas par innerHTML", () => {
  const dir = new URL("assets/js/", root);
  const files = readdirSync(dir).filter((name) => name.endsWith(".js"));
  assert.ok(files.includes("app.js"));
  for (const name of files) {
    const source = readFileSync(new URL(name, dir), "utf8");
    assert.equal(source.includes("innerHTML"), false, name);
    assert.equal(source.includes("insertAdjacentHTML"), false, name);
  }
});

test("la version des assets est tamponnée partout", () => {
  const html = read("index.html");
  const versionFile = JSON.parse(read("version.json"));
  assert.equal(versionFile.version, ASSET_VERSION);
  assert.equal(ASSET_VERSION, assetHash());
  assert.equal(html.includes("__AFZ_VERSION__"), false);
  assert.match(html, new RegExp(`href="assets/css/style\\.css\\?v=${ASSET_VERSION}"`));
  assert.match(html, new RegExp(`src="assets/js/app\\.js\\?v=${ASSET_VERSION}"`));
  assert.match(html, /var arrival = location\.href/);
  assert.match(html, /cache:\s*"no-store"/);
  const mapText = html.match(/<script type="importmap" id="afz-importmap">([\s\S]*?)<\/script>/)[1];
  assert.deepEqual(JSON.parse(mapText), importMap(ASSET_VERSION));
  assert.match(read("assets/js/pybridge.js"), /pyworker\.js\?v=/);
});

test("les anciens fichiers monolithiques ne sont plus servis", () => {
  assert.equal(existsSync(join(root.pathname, "assets/app.js")), false);
  assert.equal(existsSync(join(root.pathname, "assets/lessons.js")), false);
  assert.equal(existsSync(join(root.pathname, "assets/style.css")), false);
});
