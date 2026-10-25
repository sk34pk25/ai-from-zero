import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

import lighthouse from "lighthouse";

const require = createRequire(import.meta.url);
const chromeLauncher = require("chrome-launcher");

const server = spawn("python3", ["-m", "http.server", "4175", "--bind", "127.0.0.1"], {
  stdio: "ignore",
});

function waitForServer() {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = async () => {
      try {
        const response = await fetch("http://127.0.0.1:4175/");
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // le serveur démarre
      }
      if (Date.now() - started > 15000) reject(new Error("serveur immobile"));
      else setTimeout(tick, 200);
    };
    tick();
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

try {
  await waitForServer();
  const chrome = await chromeLauncher.launch({
    chromePath: process.env.CHROME_PATH,
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
  });
  try {
    const result = await lighthouse("http://127.0.0.1:4175/", { port: chrome.port, output: "json" }, desktop);
    const mobile = await lighthouse("http://127.0.0.1:4175/", {
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
    writeFileSync("lighthouse-report.json", JSON.stringify({ scores, mobileScores, url: result.lhr.requestedUrl, weak }, null, 2));
    console.log(JSON.stringify({ desktop: scores, mobile: mobileScores }));
    const failed = Object.entries(scores).filter(([, score]) => score < 90);
    const mobileFailed = Object.entries(mobileScores).filter(([key, score]) => key !== "performance" && score < 90);
    if (failed.length || mobileFailed.length) {
      console.error("Scores sous 90 :", { desktop: failed, mobile: mobileFailed });
      process.exitCode = 1;
    }
  } finally {
    await chrome.kill();
  }
} finally {
  server.kill();
}
