import { expect, test } from "@playwright/test";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "../../assets/config.js";

const TABLES = ["ide_files", "progress", "quiz_results", "training_runs", "training_plans", "learning_records"];

test("l'anonyme est refusé sur le projet réel et les inscriptions sont fermées", async ({ request }) => {
  expect(SUPABASE_URL).toBe("https://qffcqvwndnpdbrmqbjpz.supabase.co");
  expect(SUPABASE_ANON_KEY.includes("service_role")).toBe(false);
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const settings = await request.get(`${SUPABASE_URL}/auth/v1/settings`, { headers });
  expect(settings.ok()).toBeTruthy();
  const body = await settings.json();
  expect(body.disable_signup).toBe(true);
  expect(body.external?.email).toBe(true);

  for (const table of TABLES) {
    const read = await request.get(`${SUPABASE_URL}/rest/v1/${table}?select=*`, { headers });
    expect(read.status(), table).toBe(401);
    const write = await request.post(`${SUPABASE_URL}/rest/v1/${table}`, {
      headers: { ...headers, "content-type": "application/json", prefer: "return=minimal" },
      data: {},
    });
    expect([401, 403], `${table} ${write.status()}`).toContain(write.status());
  }
});
