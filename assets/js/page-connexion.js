/** Connexion propriétaire. Pas de formulaire d'inscription. */

import { isConfigured, isOwner, resetPassword, signIn, signOut } from "./auth.js";
import { isEmailAddress, passwordResetRedirect } from "./auth-return.js";
import { h } from "./dom.js";

export function paintConnexion(main) {
  const status = h("p", { class: "quiz-feedback", role: "status", text: "" });
  if (!isConfigured()) {
    main.replaceChildren(
      h("p", { class: "eyebrow", text: "Connexion" }),
      h("h1", { text: "Compte propriétaire" }),
      h("p", { class: "lead", text: "Supabase n'est pas configuré. Le site reste en lecture seule. Le propriétaire remplit assets/config.js en suivant docs/SUPABASE_SETUP.md." }),
      status,
    );
    status.textContent = "Supabase n'est pas configuré. Le site reste en lecture seule.";
    return;
  }
  if (isOwner()) {
    main.replaceChildren(
      h("p", { class: "eyebrow", text: "Connexion" }),
      h("h1", { text: "Session ouverte" }),
      h("p", { text: "Le propriétaire est connecté. La déconnexion referme l'IDE, les quiz et l'enregistrement." }),
      h("button", {
        type: "button",
        class: "button button-primary",
        onClick: async () => {
          await signOut();
          paintConnexion(main);
        },
      }, "Se déconnecter"),
      status,
    );
    status.textContent = "Session propriétaire ouverte.";
    return;
  }
  const email = h("input", { id: "login-email", type: "email", autocomplete: "username", required: true });
  const password = h("input", { id: "login-password", type: "password", autocomplete: "current-password", required: true });
  const form = h("form", { class: "login-form" }, [
    h("label", { for: "login-email" }, ["Adresse e-mail", email]),
    h("label", { for: "login-password" }, ["Mot de passe", password]),
    h("button", { type: "submit", class: "button button-primary" }, "Se connecter"),
  ]);
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    status.textContent = "Connexion…";
    const result = await signIn(email.value, password.value);
    status.textContent = result.message;
    if (result.ok) paintConnexion(main);
  });
  const forgot = h("button", {
    type: "button",
    class: "button button-secondary",
    onClick: async () => {
      if (!isEmailAddress(email.value)) {
        status.textContent = email.value.trim()
          ? "Cette adresse e-mail n'est pas valable."
          : "Indique l'adresse du compte propriétaire.";
        return;
      }
      const result = await resetPassword(email.value, passwordResetRedirect(document.baseURI));
      status.textContent = result.message;
    },
  }, "Mot de passe oublié");
  main.replaceChildren(
    h("p", { class: "eyebrow", text: "Connexion" }),
    h("h1", { text: "Compte propriétaire" }),
    h("p", { class: "lead", text: "Un seul compte, créé à la main. Il n'y a pas d'inscription publique. Le cadenas de l'interface n'est pas la protection : les politiques RLS refusent les autres comptes." }),
    form,
    forgot,
    status,
  );
}
