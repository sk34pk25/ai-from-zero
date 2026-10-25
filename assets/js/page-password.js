/** Changement de mot de passe sans e-mail, pour le propriétaire déjà connecté. */

import { accountPasswordNotice, changePassword, isConfigured, isOwner } from "./auth.js";
import { passwordProblems } from "./auth-return.js";
import { h } from "./dom.js";

export function paintPassword(main) {
  if (!isConfigured()) {
    main.replaceChildren(
      h("p", { class: "eyebrow", text: "Compte" }),
      h("h1", { text: "Changer mon mot de passe" }),
      h("p", { class: "lead", text: "Supabase n'est pas configuré. Le site reste en lecture seule." }),
    );
    return;
  }
  if (!isOwner()) {
    main.replaceChildren(
      h("p", { class: "eyebrow", text: "Compte" }),
      h("h1", { text: "Changer mon mot de passe" }),
      h("p", { class: "lead", text: "Réservé au propriétaire. Connecte-toi pour choisir un nouveau mot de passe sans e-mail, et sans toucher au quota du courrier." }),
      h("a", { class: "button button-primary", href: "#/connexion" }, "Se connecter"),
    );
    return;
  }
  paintForm(main);
}

function paintForm(main) {
  const password = h("input", {
    id: "account-new-password",
    type: "password",
    autocomplete: "new-password",
    required: true,
    minlength: "12",
    spellcheck: "false",
    "aria-describedby": "account-password-rule",
  });
  const confirmation = h("input", {
    id: "account-confirm-password",
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
  const hint = h("p", { id: "account-password-rule", class: "login-hint", text: "12 caractères minimum. Aucun e-mail n'est envoyé." });
  password.addEventListener("input", () => {
    const ok = password.value.length >= 12;
    hint.textContent = ok ? "Longueur suffisante. Aucun e-mail n'est envoyé." : "12 caractères minimum. Aucun e-mail n'est envoyé.";
    hint.className = ok ? "login-hint is-ok" : "login-hint";
  });
  const notice = accountPasswordNotice();
  const status = h("p", {
    class: notice ? "quiz-feedback is-correct" : "quiz-feedback",
    role: "status",
    text: notice,
  });
  const form = h("form", { class: "login-form", novalidate: true }, [
    h("label", { for: "account-new-password", text: "Nouveau mot de passe" }),
    h("span", { class: "password-field" }, [password, toggle]),
    hint,
    h("label", { for: "account-confirm-password" }, ["Confirmer le mot de passe", confirmation]),
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
    status.textContent = "Vérification de la session…";
    status.className = "quiz-feedback";
    const result = await changePassword(password.value);
    status.textContent = result.message;
    status.className = result.ok ? "quiz-feedback is-correct" : "quiz-feedback is-incorrect";
    submit.disabled = result.ok;
    if (result.ok) password.disabled = confirmation.disabled = toggle.disabled = true;
  });
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Compte" }),
    h("h1", { text: "Changer mon mot de passe" }),
    h("p", {
      class: "lead",
      text: "Tu es connecté : le nouveau mot de passe remplace l'ancien tout de suite. Aucun e-mail n'est envoyé, le quota du courrier intégré n'est pas utilisé.",
    }),
    form,
    status,
    h("p", {}, [h("a", { href: "#/connexion" }, "Retour au compte")]),
  );
}
