import { defineConfig } from "@playwright/test";
import base from "./playwright.config.js";

export default defineConfig({
  ...base,
  testDir: "tests/runtime",
  timeout: 180_000,
  expect: { timeout: 90_000 },
  outputDir: "test-results-runtime",
  reporter: process.env.CI
    ? [["github"], ["list"], ["html", { open: "never", outputFolder: "playwright-runtime-report" }]]
    : [["list"]],
});
