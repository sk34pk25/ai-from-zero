import { expect } from "@playwright/test";

export const OWNER_ID = "11111111-1111-4111-8111-111111111111";
export const OTHER_ID = "22222222-2222-4222-8222-222222222222";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "content-type": "application/json",
};

function sessionFor(id, email) {
  return {
    access_token: `token-${id}`,
    refresh_token: `refresh-${id}`,
    expires_in: 3600,
    token_type: "bearer",
    user: { id, aud: "authenticated", role: "authenticated", email },
  };
}

function tableName(url) {
  const match = new URL(url).pathname.match(/\/rest\/v1\/([^/]+)/);
  return match ? match[1] : "";
}

export async function installOwner(page, { userId = OWNER_ID, tables = {} } = {}) {
  const writes = [];
  await page.route(/\/assets\/config\.js(?:\?.*)?$/, (route) => route.fulfill({
    contentType: "text/javascript",
    body: `export const SUPABASE_URL = "https://example.supabase.co";
export const SUPABASE_ANON_KEY = "abcdefghijklmnopqrstuvwxyz012345";
export const OWNER_ID = "${OWNER_ID}";
`,
  }));
  await page.route("https://example.supabase.co/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    const url = request.url();
    if (request.method() === "POST" && url.includes("/rest/v1/")) writes.push(request);
    if (request.method() === "GET" && url.includes("/rest/v1/")) {
      const rows = tables[tableName(url)] || [];
      await route.fulfill({ status: 200, headers: CORS, json: rows });
      return;
    }
    if (url.includes("/auth/v1/token")) {
      const body = request.postDataJSON() || {};
      const email = body.email || "patrik@example.com";
      const id = email.startsWith("autre") ? OTHER_ID : userId;
      await route.fulfill({ status: 200, headers: CORS, json: sessionFor(id, email) });
      return;
    }
    if (url.includes("/auth/v1/user") && request.method() === "PUT") {
      await route.fulfill({
        status: 200,
        headers: CORS,
        json: { id: userId, aud: "authenticated", email: "patrik@example.com" },
      });
      return;
    }
    if (url.includes("/auth/v1/recover") && request.method() === "POST") {
      await route.fulfill({ status: 200, headers: CORS, json: {} });
      return;
    }
    if (url.includes("/auth/v1/verify") && request.method() === "POST") {
      const body = request.postDataJSON() || {};
      if (body.token_hash === "expired-token") {
        await route.fulfill({
          status: 403,
          headers: CORS,
          json: {
            code: "otp_expired",
            error_code: "otp_expired",
            msg: "Email link is invalid or has expired",
          },
        });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: CORS,
        json: sessionFor(userId, "patrik@example.com"),
      });
      return;
    }
    if (url.includes("/auth/v1/user")) {
      await route.fulfill({ status: 200, headers: CORS, json: { id: userId, aud: "authenticated", email: "patrik@example.com" } });
      return;
    }
    await route.fulfill({ status: 201, headers: CORS, json: [] });
  });
  return writes;
}

export async function signInAs(page, email = "patrik@example.com", password = "secret-secret") {
  await page.goto("/#/connexion");
  await expect(page.locator("h1")).toHaveText("Compte propriétaire");
  await page.getByLabel("Adresse e-mail").fill(email);
  await page.getByLabel("Mot de passe").fill(password);
  await page.getByRole("button", { name: "Se connecter" }).click();
  if (email.startsWith("autre")) {
    await expect(page.locator("p.quiz-feedback")).toContainText("pas le propriétaire");
  } else {
    await expect(page.locator("p.quiz-feedback")).toContainText("Session propriétaire ouverte");
  }
}
