import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

import lighthouse from "lighthouse";

const require = createRequire(import.meta.url);
const chromeLauncher = require("chrome-launcher");

const ROOT = process.cwd();
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".md": "text/plain; charset=utf-8",
};

function startServer(port) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", "http://127.0.0.1");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(ROOT, `.${pathname}`);
      if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const body = await readFile(file);
      const headers = {
        "content-type": TYPES[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-cache",
      };
      const compressible = !file.endsWith(".png") && !file.endsWith(".webp");
      if (compressible && String(req.headers["accept-encoding"] || "").includes("gzip")) {
        headers["content-encoding"] = "gzip";
        headers.vary = "accept-encoding";
        res.writeHead(200, headers);
        res.end(gzipSync(body));
        return;
      }
      res.writeHead(200, headers);
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("introuvable");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

const desktop = {
  extends: "lighthouse:default",
  settings: {
    formFactor: "desktop",
    throttling: {
      rttMs: 40,
      throughputKbps: 10240,
      cpuSlowdownMultiplier: 1,
      requestLatencyMs: 0,
      downloadThroughputKbps: 0,
      uploadThroughputKbps: 0,
    },
    screenEmulation: { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
  },
};

const server = await startServer(4175);

try {
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  });
  try {
    const routes=JSON.parse(process.env.LIGHTHOUSE_ROUTES||'["/"]');
    if(!Array.isArray(routes)||routes.some(route=>typeof route!=="string"||!route.startsWith("/")||route.startsWith("//")))throw new Error("Routes invalides");
    const reports=[];
    for(const route of routes){
    const result = await lighthouse(`http://127.0.0.1:4175${route}`, { port: chrome.port, output: "json" }, desktop);
    const mobile = await lighthouse(`http://127.0.0.1:4175${route}`, {
      port: chrome.port,
      output: "json",
      onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    });
    const pick = (report) => Object.fromEntries(
      Object.entries(report.lhr.categories).map(([key, category]) => [key, Math.round(category.score * 100)]),
    );
    const scores = pick(result);
    const mobileScores = pick(mobile);
    const weak = Object.values(result.lhr.audits)
      .filter((audit) => typeof audit.score === "number" && audit.score < 1 && audit.scoreDisplayMode !== "informative")
      .map((audit) => ({ id: audit.id, score: audit.score, title: audit.title, display: audit.displayValue }))
      .sort((a, b) => a.score - b.score);
    const mobileWeak = Object.values(mobile.lhr.audits)
      .filter((audit) => typeof audit.score === "number" && audit.score < 1 && audit.scoreDisplayMode !== "informative")
      .map((audit) => ({ id: audit.id, score: audit.score, title: audit.title, display: audit.displayValue, details: audit.details }))
      .sort((a, b) => a.score - b.score);
    reports.push({ scores, mobileScores, url: result.lhr.requestedUrl, weak, mobileWeak });
    console.log(JSON.stringify({ desktop: scores, mobile: mobileScores }));
    const failed = Object.entries(scores).filter(([, score]) => score < 95);
    const mobileFailed = Object.entries(mobileScores).filter(([, score]) => score < 95);
    if (failed.length || mobileFailed.length) {
      console.error("Scores sous 95 :", { desktop: failed, mobile: mobileFailed });
      process.exitCode = 1;
    }
    }
    writeFileSync("lighthouse-report.json",JSON.stringify(reports,null,2));
  } finally {
    await chrome.kill();
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}
