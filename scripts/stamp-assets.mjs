/** Aligne la version des assets sur leur contenu, et régénère l'import map. */

import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function filesIn(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === "version.js") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) filesIn(full, acc);
    else if (/\.(js|css)$/.test(name)) acc.push(full);
  }
  return acc;
}

export function assetFiles() {
  return [
    ...filesIn(join(root, "assets", "js")),
    ...filesIn(join(root, "assets", "css")),
    join(root, "assets", "config.js"),
    ...filesIn(join(root, "assets", "vendor")),
  ]
    .map((full) => relative(root, full).split("\\").join("/"))
    .sort();
}

export function assetHash() {
  const hash = createHash("sha256");
  for (const file of [
    ...assetFiles(),
    "sw.js",
    "manifest.webmanifest",
    ...JSON.parse(readFileSync(join(root, "data/atelier.json"), "utf8")).files,
    ...JSON.parse(readFileSync(join(root, "data/harness-project.json"), "utf8")).files,
    ...readdirSync(join(root, "data/harness")).filter(p=>p.endsWith('.json')).map(p=>`data/harness/${p}`),
    ...readdirSync(join(root, "data"))
      .filter((p) => p.endsWith(".json") && !p.endsWith("browser.json"))
      .map((p) => `data/${p}`),
    ...readdirSync(join(root, "model"))
      .filter((p) => p.endsWith(".py"))
      .map((p) => `model/${p}`),
  ]) {
    hash.update(file);
    hash.update("\n");
    hash.update(
      readFileSync(join(root, file)).toString("utf8").replace(/\r\n/g, "\n"),
    );
    hash.update("\n");
  }
  return hash.digest("hex").slice(0, 12);
}

export function collectSpecifiers() {
  const specifiers = new Set();
  const patterns = [
    /\bfrom\s+["'](\.[^"']+)["']/g,
    /\bimport\s*\(\s*["'](\.[^"']+)["']/g,
  ];
  for (const file of assetFiles()) {
    if (!file.startsWith("assets/js/") || !file.endsWith(".js")) continue;
    const source = readFileSync(join(root, file), "utf8");
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match = pattern.exec(source);
      while (match) {
        specifiers.add(match[1]);
        match = pattern.exec(source);
      }
    }
  }
  return [...specifiers].sort();
}

export function targetFor(specifier, version) {
  if (specifier.startsWith("./"))
    return `./assets/js/${specifier.slice(2)}?v=${version}`;
  if (specifier.startsWith("../"))
    return `./assets/${specifier.slice(3)}?v=${version}`;
  throw new Error(`spécificateur inattendu : ${specifier}`);
}

export function importMap(version) {
  const scope = {};
  for (const specifier of collectSpecifiers())
    scope[
      specifier.startsWith("./")
        ? `./assets/js/${specifier.slice(2)}`
        : `./assets/${specifier.slice(3)}`
    ] = targetFor(specifier, version);
  return { scopes: { "./assets/js/": scope } };
}

/** Empreintes des scripts inline (thème, version, import map), pour la CSP. */
export function inlineScriptHashes(html) {
  const hashes = [];
  const pattern = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  let match = pattern.exec(html);
  while (match) {
    const digest = createHash("sha256").update(match[1], "utf8").digest("base64");
    hashes.push(`'sha256-${digest}'`);
    match = pattern.exec(html);
  }
  return hashes;
}

/** Politique de sécurité du contenu. Les workers chargent Pyodide sous leur propre politique. */
export function contentSecurityPolicy(html) {
  return [
    "default-src 'self'",
    `script-src 'self' ${inlineScriptHashes(html).join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    // Tout projet Supabase (le dépôt, une copie, ou le faux serveur des tests e2e), et rien d'autre.
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function applyCsp(html) {
  return html.replace(
    /(<meta http-equiv="Content-Security-Policy" content=")[^"]*(">)/,
    `$1${contentSecurityPolicy(html)}$2`,
  );
}

function currentVersion() {
  const source = readFileSync(join(root, "assets", "js", "version.js"), "utf8");
  const match = source.match(/ASSET_VERSION = "([^"]+)"/);
  return match ? match[1] : "";
}

function stamp() {
  const previous = currentVersion();
  const next = assetHash();
  let html = readFileSync(join(root, "index.html"), "utf8");
  if (previous && previous !== next) html = html.split(previous).join(next);
  html = html.split("__AFZ_VERSION__").join(next);
  const json = JSON.stringify(importMap(next), null, 2);
  html = html.replace(
    /<script type="importmap" id="afz-importmap">[\s\S]*?<\/script>/,
    `<script type="importmap" id="afz-importmap">\n${json}\n</script>`,
  );
  html = applyCsp(html);
  writeFileSync(
    join(root, "assets", "js", "version.js"),
    `/** Version des assets statiques. Réécrite par scripts/stamp-assets.mjs. */\nexport const ASSET_VERSION = "${next}";\n`,
  );
  writeFileSync(
    join(root, "version.json"),
    `${JSON.stringify({ version: next }, null, 2)}\n`,
  );
  writeFileSync(join(root, "index.html"), html);
  const shell = [
    "offline-manifest.json",
    "index.html",
    "favicon.svg",
    "manifest.webmanifest",
    "assets/icon-192.png",
    "assets/icon-512.png",
    ...readdirSync(join(root, "assets", "fonts"))
      .filter((p) => p.endsWith(".woff2"))
      .map((p) => `assets/fonts/${p}`),
    "data/curriculum-index.json",
    "data/curriculum.json",
    "data/glance.json",
    "data/glossary.json",
    "data/glossary-core.json",
    "data/transfer-tasks.json",
    "data/capabilities.json",
    "data/harness-index.json",
    "data/harness-curriculum.json",
    "data/harness-project.json",
    ...readdirSync(join(root, "data/harness")).filter(p=>p.endsWith('.json')).map(p=>`data/harness/${p}`),
    ...assetFiles().filter((p) => !p.startsWith("assets/vendor/")),
  ];
  const course = [
    "assets/vendor/editor.js",
    "assets/vendor/supabase.js",
    "data/exercises.json",
    "data/placement_practice.json",
    "data/debug.json",
    "data/datasets.json",
    "data/gpt_run.json",
    "data/finetune_run.json",
    "data/atelier.json",
    "data/atelier_reference_run.json",
    "data/benchmark_fr_run.json",
    "data/benchmark_modern_run.json",
    "data/benchmark_literature_protocol.json",
    ...JSON.parse(readFileSync(join(root, "data/atelier.json"), "utf8")).files,
    ...JSON.parse(readFileSync(join(root, "data/harness-project.json"), "utf8")).files,
    "model/manifest.json",
    ...readdirSync(join(root, "model"))
      .filter((p) => p.endsWith(".py"))
      .map((p) => `model/${p}`),
  ];
  writeFileSync(
    join(root, "offline-manifest.json"),
    JSON.stringify(
      {
        version: next,
        shell: [...new Set(shell)],
        course,
        models: ["data/gpt_browser.json", "data/chat_browser.json"],
      },
      null,
      2,
    ),
  );
  return next;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  stamp();
