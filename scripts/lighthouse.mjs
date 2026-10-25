import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

import chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

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
    const scores = Object.fromEntries(
      Object.entries(result.lhr.categories).map(([key, category]) => [key, Math.round(category.score * 100)]),
    );
    writeFileSync("lighthouse-report.json", JSON.stringify({ scores, url: result.lhr.requestedUrl }, null, 2));
    console.log(JSON.stringify(scores));
    const failed = Object.entries(scores).filter(([, score]) => score < 90);
    if (failed.length) {
      console.error("Scores sous 90 :", failed);
      process.exitCode = 1;
    }
  } finally {
    await chrome.kill();
  }
} finally {
  server.kill();
}
