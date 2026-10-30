/** Une réussite appartient à un programme et à un contrat précis. */
const HASH = /^[a-f0-9]{64}$/;
export async function codeFingerprint(code) {
  if (!globalThis.crypto?.subtle) return null;
  const bytes = new TextEncoder().encode(String(code));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
}
export function normalizeExerciseResult(row) {
  if (!row || typeof row.ok !== "boolean") return null;
  const result = { ok: row.ok };
  for (const field of ["codeHash", "validatorVersion"])
    if (HASH.test(row[field] || "")) result[field] = row[field];
  if (Number.isFinite(row.checkedAt) && row.checkedAt > 0) result.checkedAt = row.checkedAt;
  return result;
}
export function exerciseState(receipt, codeHash, validatorVersion) {
  if (!receipt) return "untried";
  if (!receipt.codeHash || !receipt.validatorVersion) return "legacy";
  if (receipt.validatorVersion !== validatorVersion) return "outdated";
  if (!codeHash || receipt.codeHash !== codeHash) return "modified";
  return receipt.ok ? "passed" : "failed";
}
export const EXERCISE_LABELS = {
  untried: "non lancé", legacy: "ancien contrôle à refaire", outdated: "contrôle mis à jour, à relancer",
  modified: "code modifié, contrôle à relancer", passed: "contrôle passé", failed: "à corriger",
};
