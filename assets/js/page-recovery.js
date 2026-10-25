/** Choix d'un nouveau mot de passe après le lien Supabase. */

import {
  getRecoveryNotice,
  isOwner,
  isPasswordSaved,
  isRecoveryPending,
  leaveRecovery,
  resetPassword,
  updatePassword,
} from "./auth.js";
import { isEmailAddress, passwordProblems, passwordResetRedirect } from "./auth-return.js";
import { h } from "./dom.js";

let leaveTimer = 0;

function statusNode(text, tone) {
  const node = h("p", { class: tone ? `quiz-feedback is-${tone}` : "quiz-feedback", role: "status", text });
  return node;
}

function requestForm(status, label) {
  const email = h("input", {
    id: "recovery-email",
    type: "email",
    autocomplete: "username",
    required: true,
    spellcheck: "false",
  });
  const form = h("form", { class: "login-form", novalidate: true }, [
    h("label", { for: "recovery-email" }, ["Adresse e-mail", email]),
    h("button", { type: "submit", class: "button button-primary" }, label),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!isEmailAddress(email.value)) {
      status.textContent = email.value.trim()
        ? "Cette adresse e-mail n'est pas valable."
        : "Indique l'adresse du compte propriétaire.";
      status.className = "quiz-feedback is-incorrect";
      return;
    }
    status.textContent = "Envoi…";
    status.className = "quiz-feedback";
    const redirectTo = passwordResetRedirect(document.baseURI);
    const result = await resetPassword(email.value, redirectTo);
    status.textContent = result.message;
    status.className = result.ok ? "quiz-feedback is-correct" : "quiz-feedback is-incorrect";
  });
  return form;
}

function paintRequest(main, lead, tone) {
  const status = statusNode("", tone === "incorrect" ? "incorrect" : "");
  if (tone === "incorrect") status.textContent = lead;
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Compte" }),
    h("h1", { text: "Choisir un nouveau mot de passe" }),
    h("p", {
      class: "lead",
      text: tone === "incorrect"
        ? "Le lien ouvert depuis le message n'a pas pu servir. Tu peux en demander un autre."
        : lead,
    }),
    requestForm(status, "Envoyer un nouveau lien"),
    status,
  );
}

function scheduleLeave() {
  if (leaveTimer) return;
  leaveTimer = window.setTimeout(() => {
    leaveTimer = 0;
    leaveRecovery(isOwner() ? "#/ide" : "#/connexion");
  }, 1200);
}

function paintSuccess(main) {
  const status = statusNode("Mot de passe mis à jour.", "correct");
  const next = h("a", {
    class: "button button-primary",
    href: isOwner() ? "#/ide" : "#/connexion",
  }, isOwner() ? "Ouvrir l'IDE" : "Retour à la connexion");
  next.addEventListener("click", () => {
    window.clearTimeout(leaveTimer);
    leaveTimer = 0;
  });
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Compte" }),
    h("h1", { text: "Mot de passe mis à jour" }),
    h("p", { class: "lead", text: "L'ancien mot de passe ne fonctionne plus. La session propriétaire reste ouverte." }),
    next,
    status,
  );
  scheduleLeave();
}

function paintChoose(main) {
  const password = h("input", {
    id: "new-password",
    type: "password",
    autocomplete: "new-password",
    required: true,
    minlength: "12",
    spellcheck: "false",
    "aria-describedby": "password-rule",
  });
  const confirmation = h("input", {
    id: "confirm-password",
    type: "password",
    autocomplete: "new-password",
    required: true,
    minlength: "12",
    spellcheck: "false",
  });
  const toggle = h("button", {
    type: "button",
    class: "button button-secondary password-toggle",
    "aria-pressed": "false",
    "aria-label": "Afficher les mots de passe",
  }, "Afficher");
  toggle.addEventListener("click", () => {
    const show = password.type === "password";
    const type = show ? "text" : "password";
    password.type = type;
    confirmation.type = type;
    toggle.textContent = show ? "Masquer" : "Afficher";
    toggle.setAttribute("aria-pressed", show ? "true" : "false");
    toggle.setAttribute("aria-label", show ? "Masquer les mots de passe" : "Afficher les mots de passe");
  });
  const hint = h("p", { id: "password-rule", class: "login-hint", text: "12 caractères minimum." });
  password.addEventListener("input", () => {
    const ok = password.value.length >= 12;
    hint.textContent = ok ? "Longueur suffisante." : "12 caractères minimum.";
    hint.className = ok ? "login-hint is-ok" : "login-hint";
  });
  const status = statusNode("", "");
  const form = h("form", { class: "login-form", novalidate: true }, [
    h("label", { for: "new-password", text: "Nouveau mot de passe" }),
    h("span", { class: "password-field" }, [password, toggle]),
    hint,
    h("label", { for: "confirm-password" }, ["Confirmer le mot de passe", confirmation]),
    h("button", { type: "submit", class: "button button-primary" }, "Enregistrer le mot de passe"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const problem = passwordProblems(password.value, confirmation.value);
    if (problem) {
      status.textContent = problem;
      status.className = "quiz-feedback is-incorrect";
      return;
    }
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    status.textContent = "Enregistrement…";
    status.className = "quiz-feedback";
    const result = await updatePassword(password.value);
    if (!result.ok) {
      submit.disabled = false;
      status.textContent = result.message;
      status.className = "quiz-feedback is-incorrect";
      return;
    }
    paintSuccess(main);
  });
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Compte" }),
    h("h1", { text: "Choisir un nouveau mot de passe" }),
    h("p", {
      class: "lead",
      text: "Le lien a ouvert une session le temps de remplacer le mot de passe du compte propriétaire.",
    }),
    form,
    status,
  );
}

export function paintRecovery(main) {
  if (isPasswordSaved()) {
    paintSuccess(main);
    return;
  }
  const notice = getRecoveryNotice();
  if (notice) {
    paintRequest(main, notice.message, "incorrect");
    return;
  }
  if (isRecoveryPending() || !isOwner()) {
    if (isRecoveryPending()) {
      main.replaceChildren(
        h("p", { class: "eyebrow", text: "Compte" }),
        h("h1", { text: "Choisir un nouveau mot de passe" }),
        h("p", { class: "lead", role: "status", text: "Vérification du lien…" }),
      );
      return;
    }
    paintRequest(
      main,
      "Ouvre le lien reçu par e-mail dans ce navigateur. S'il a expiré, demande un nouveau message.",
      "",
    );
    return;
  }
  paintChoose(main);
}
