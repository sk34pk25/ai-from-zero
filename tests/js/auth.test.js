import assert from "node:assert/strict";
import test from "node:test";

import { publicConfig, shouldOpenAuthClient } from "../../assets/js/auth.js";

function storageOf(keys) {
  return {
    length: keys.length,
    key(index) {
      return keys[index] ?? null;
    },
  };
}

const config = publicConfig();

test("un visiteur sans session n'ouvre pas le client Supabase", () => {
  assert.equal(config.url, "https://qffcqvwndnpdbrmqbjpz.supabase.co");
  assert.equal(config.ownerId, "b339f605-c00c-456c-a68f-d273969f086d");
  assert.equal(config.anonKey.includes("service_role"), false);
  assert.ok(config.anonKey.length >= 20);
  const storage = storageOf(["afz-theme", "afz-progress"]);
  assert.equal(shouldOpenAuthClient(config, "http://127.0.0.1:4173/#/connexion", storage), false);
  assert.equal(shouldOpenAuthClient(config, "http://127.0.0.1:4173/#/lecon/1.6", storage), false);
});

test("une session stockée ou un retour Auth ouvre le client", () => {
  const ref = "sb-qffcqvwndnpdbrmqbjpz-auth-token";
  assert.equal(shouldOpenAuthClient(config, "http://127.0.0.1:4173/#/", storageOf([ref])), true);
  assert.equal(
    shouldOpenAuthClient(config, "http://127.0.0.1:4173/#/", storageOf(["sb-qffcqvwndnpdbrmqbjpz-auth-token-code-verifier"])),
    true,
  );
  assert.equal(shouldOpenAuthClient(config, "http://127.0.0.1:4173/#/", storageOf(["sb-autre-auth-token"])), false);
  assert.equal(
    shouldOpenAuthClient(config, "https://sk34pk25.github.io/ai-from-zero/#access_token=jeton&type=recovery", storageOf([])),
    true,
  );
  assert.equal(shouldOpenAuthClient(config, "https://sk34pk25.github.io/ai-from-zero/?code=abc", storageOf([])), true);
  assert.equal(
    shouldOpenAuthClient(
      config,
      "https://sk34pk25.github.io/ai-from-zero/#/nouveau-mot-de-passe#access_token=jeton&refresh_token=autre&type=recovery",
      storageOf([]),
    ),
    true,
  );
  assert.equal(
    shouldOpenAuthClient(config, "https://sk34pk25.github.io/ai-from-zero/?token_hash=hash&type=recovery", storageOf([])),
    true,
  );
});
