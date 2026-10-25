/** Envoi « Mot de passe oublié » : un seul essai, puis un délai d'une heure. */

import {
  RECOVERY_EMAIL_BUSY,
  RECOVERY_EMAIL_HINT,
  formatRecoveryWait,
  recoveryCooldownMessage,
  recoveryCooldownRemaining,
} from "./auth-return.js";
import { resetPassword } from "./auth.js";
import { h } from "./dom.js";

let timer = 0;
let listening = false;

export function recoveryHint() {
  return h("p", { class: "login-hint", id: "recovery-hint", text: RECOVERY_EMAIL_HINT });
}

function tick(status, button) {
  if (!status.isConnected) return;
  const hint = status.parentElement?.querySelector("#recovery-hint");
  if (status.dataset.mode === "sending") {
    button.disabled = true;
    return;
  }
  const remaining = recoveryCooldownRemaining(window.localStorage);
  button.disabled = remaining > 0;
  if (hint) {
    hint.textContent = remaining > 0
      ? `${RECOVERY_EMAIL_HINT} Prochain envoi possible dans ${formatRecoveryWait(remaining)}.`
      : RECOVERY_EMAIL_HINT;
  }
  const hold = status.dataset.mode === "auth"
    || status.dataset.mode === "sent"
    || status.dataset.mode === "limited"
    || status.dataset.mode === "error";
  if (hold) return;
  if (remaining > 0) {
    status.dataset.mode = "cooldown";
    status.textContent = recoveryCooldownMessage(remaining);
    status.className = "quiz-feedback is-incorrect";
    return;
  }
  if (status.dataset.mode === "cooldown") {
    status.dataset.mode = "";
    status.textContent = "Tu peux demander un nouveau message.";
    status.className = "quiz-feedback";
  }
}

export function watchRecoveryCooldown(status, button) {
  if (typeof window === "undefined") return;
  if (!listening) {
    listening = true;
    window.addEventListener("hashchange", () => {
      window.clearInterval(timer);
      timer = 0;
    });
  }
  window.clearInterval(timer);
  tick(status, button);
  timer = window.setInterval(() => tick(status, button), 1000);
}

export async function sendRecoveryEmail(email, status, button) {
  if (button.disabled && (status.dataset.mode === "cooldown" || status.dataset.mode === "sending")) return;
  button.disabled = true;
  status.dataset.mode = "sending";
  status.textContent = "Envoi…";
  status.className = "quiz-feedback";
  const result = await resetPassword(email);
  status.textContent = result.message;
  status.className = result.ok ? "quiz-feedback is-correct" : "quiz-feedback is-incorrect";
  if (result.ok) status.dataset.mode = "sent";
  else if (result.code === "over_email_send_rate_limit") status.dataset.mode = "limited";
  else if (result.code === "cooldown") status.dataset.mode = "cooldown";
  else if (result.code === "busy") {
    status.dataset.mode = "error";
    status.textContent = result.message || RECOVERY_EMAIL_BUSY;
  } else status.dataset.mode = "error";
  tick(status, button);
}
