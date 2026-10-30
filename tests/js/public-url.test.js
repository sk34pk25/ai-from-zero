import test from "node:test";
import assert from "node:assert/strict";
import { publicAssetUrl } from "../../assets/js/public-url.js";
import { ASSET_VERSION } from "../../assets/js/version.js";
test("les données et guides gardent le sous-chemin GitHub Pages et invalident un ancien cache", () => {
  for (const path of ["data/curriculum-index.json", "data/curriculum.json", "data/glance.json", "atelier/DOSSIER_MODELE.md?v=ancienne"]) {
    const url = publicAssetUrl(path, "https://example.test/ai-from-zero/?recovery=1");
    assert.equal(url.origin, "https://example.test");
    assert.ok(url.pathname.startsWith("/ai-from-zero/"));
    assert.equal(url.searchParams.get("v"), ASSET_VERSION);
    assert.equal(url.searchParams.has("recovery"), false);
  }
});
