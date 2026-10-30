# Brancher le compte propriétaire

Le projet `qffcqvwndnpdbrmqbjpz` est configuré. `assets/config.js` contient l'URL `https://qffcqvwndnpdbrmqbjpz.supabase.co`, la clé anon publique et l'UUID du propriétaire. Les inscriptions sont désactivées, le compte propriétaire existe, et l'URL du site ainsi que les redirections autorisées pointent vers `https://sk34pk25.github.io/ai-from-zero/`. Le schéma est appliqué, RLS compris. En ligne, `is_owner()` compare `auth.uid()` à cet UUID et fixe `search_path` à une chaîne vide. Le fichier du dépôt garde l'UUID nul : ne pas le réexécuter tel quel sur ce projet.

Le cours, les quiz et les contrôles Python sont accessibles sans compte. Notes, favoris, bilans, brouillons et preuves restent en mémoire, ou sur cet appareil si le visiteur active le suivi local ; ils peuvent être exportés sans envoi. L’IDE privé, le plan de données synchronisé et les écritures distantes sont réservés au propriétaire dont l’identifiant figure dans `assets/config.js`.

Le cadenas de l’interface réserve les outils privés au propriétaire. Les activités publiques n’utilisent pas ces écritures distantes. La protection du serveur ne dépend pas de l’interface. La protection des lignes est dans `supabase/schema.sql` : `auth.uid()` doit être cet identifiant.

Aucun mot de passe, aucune clé `service_role`, ne va dans le dépôt.

## Créer le projet

1. Ouvre [supabase.com](https://supabase.com) et crée un projet gratuit.
2. Dans Authentication → Providers → Email, laisse l'e-mail actif.
3. Dans Authentication → Sign In / Up, désactive les inscriptions publiques. Le site n'affiche pas de formulaire d'inscription.
4. Dans Authentication → Users, ajoute un utilisateur à la main, avec une adresse et un mot de passe.
5. Copie l'UUID de cet utilisateur.

## Appliquer les tables

1. Ouvre `supabase/schema.sql`.
2. Remplace `00000000-0000-0000-0000-000000000000` par l'UUID copié. Il apparaît dans la fonction `is_owner`. Le dépôt garde cet UUID nul, et la fonction y déclare `set search_path = ''`.
3. Dans le projet Supabase, ouvre le SQL Editor, colle le fichier, exécute-le. Le projet déjà créé a cette étape derrière lui : réexécuter le fichier du dépôt y écraserait l'UUID réel.
4. Vérifie que les tables `ide_files`, `progress`, `quiz_results`, `training_runs` et `training_plans` existent, et que RLS est activé.

Un autre compte connecté, ou un visiteur anonyme, ne peut ni lire ni écrire ces tables.

## Remplir la configuration publique

Dans Project Settings → API, copie l'URL du projet et la clé `anon` `public`. Ce ne sont pas des secrets : elles sont faites pour le navigateur. Ne copie pas la clé `service_role`.

Édite `assets/config.js` :

```js
export const SUPABASE_URL = "https://TON-PROJET.supabase.co";
export const SUPABASE_ANON_KEY = "la clé anon";
export const OWNER_ID = "l'UUID de l'utilisateur";
```

Si l'une de ces trois chaînes est vide, la connexion propriétaire est indisponible. Le cours, les contrôles Python et le travail local restent accessibles. Elles sont renseignées pour le site publié.

## Mot de passe oublié

Dans Authentication → URL Configuration, l'adresse du site reste `https://sk34pk25.github.io/ai-from-zero/` et la liste des redirections autorisées garde `https://sk34pk25.github.io/ai-from-zero/**`. Ce joker couvre déjà `https://sk34pk25.github.io/ai-from-zero/?recovery=1`. Aucune nouvelle adresse n'est obligatoire pour le site publié.

Le bouton « Mot de passe oublié » envoie `redirectTo` égal à `https://sk34pk25.github.io/ai-from-zero/?recovery=1`, sans fragment. GoTrue ajoute les jetons implicites en collant `#` à la fin de `redirect_to`. Quand cette adresse contenait déjà `#/nouveau-mot-de-passe`, le navigateur recevait deux fragments (`…/#/nouveau-mot-de-passe#access_token=…&type=recovery`). `URLSearchParams` ne voyait plus `access_token`, et la page annonçait à tort que le lien n'avait pas fonctionné. Les messages déjà partis avec l'ancienne adresse restent lisibles : le site sépare le second fragment, réécrit un fragment unique, puis laisse le client Supabase ouvrir la session. Les prochains messages n'ont plus qu'un seul `#`.

Le projet garde le courrier intégré de Supabase. Il n'y a pas de SMTP externe : ce service n'envoie que quelques messages par heure, et la limite ne se relève pas sans changer de transporteur. Le site le dit en français. Une réponse `429` / `over_email_send_rate_limit` explique d'attendre environ une heure, que le message précédent peut encore être valable, et de regarder les courriers indésirables. Le même texte apparaît si le navigateur est hors ligne. Un délai d'une heure est écrit dans `localStorage` (`afz-recovery-email-until`) dès qu'un envoi part ou que la limite répond, pour qu'un second clic ne consomme pas le quota. Un verrou de 30 secondes (`afz-recovery-email-lock`) couvre le temps de la requête.

Une fois connecté, « Changer mon mot de passe » (`#/changer-mot-de-passe`, depuis la page Compte) appelle `updateUser({ password })` après `getUser()`. Aucun e-mail n'est envoyé. Le mot de passe fait 12 caractères minimum et doit être confirmé.

Les feuilles et les modules portent `?v=` (contenu hashé par `node scripts/stamp-assets.mjs`). Un script dans `index.html` lit `version.json` sans cache et, si le HTML servi est celui d'un déploiement précédent, recharge l'adresse d'arrivée — jetons compris — avec `?v=` à jour. GitHub Pages garde les fichiers environ 10 minutes (`Cache-Control: max-age=600`) : le premier déploiement de ce contrôle attend cette fenêtre ; les suivants se rechargent seuls.

Le flux PKCE (`?code=`) et les erreurs (`error_code=otp_expired`) sont inchangés. La page retire les jetons de l'adresse, ouvre la session, puis appelle `updateUser({ password })`.

### Modèle d'e-mail recommandé

Le modèle par défaut utilise `{{ .ConfirmationURL }}`, qui pointe vers `GET /auth/v1/verify`. Un scanner de liens (Gmail) consomme ce jeton à usage unique avant le destinataire. Changer le modèle n'est pas nécessaire pour réparer le double fragment. C'est le moyen d'empêcher le scanner de brûler le lien.

Dans Authentication → Emails → Reset password, remplacer le corps par exactement :

```html
<h2>Nouveau mot de passe</h2>
<p>Suis ce lien pour choisir un nouveau mot de passe :</p>
<p><a href="https://sk34pk25.github.io/ai-from-zero/?token_hash={{ .TokenHash }}&type=recovery">Choisir un nouveau mot de passe</a></p>
```

Le clic ouvre le site. Le jeton n'est envoyé à Supabase qu'au bouton « Vérifier le lien » (`verifyOtp`). Un simple `GET` ne le consomme pas. Ne pas placer `{{ .TokenHash }}` après un `#`. Ne pas laisser `{{ .ConfirmationURL }}` dans ce modèle si le scanner doit être ignoré. Ce lien n'est pas une redirection GoTrue : la liste des redirections ne le concerne pas.

Si la liste est un jour réduite à des adresses exactes, ajouter `https://sk34pk25.github.io/ai-from-zero/?recovery=1`. Pour un essai en local, ajouter aussi `http://127.0.0.1:4173/**`.

## Réglages du tableau de bord

Rien à changer pour le courrier : le SMTP intégré reste en place, volontairement. Ne pas brancher un SMTP tiers. La limite horaire ne peut pas être relevée dans ce mode ; le site la rend visible et bloque les clics.

À vérifier, sans y toucher si c'est déjà le cas :

- Authentication → Sign In / Up : inscriptions désactivées.
- Authentication → URL Configuration : site `https://sk34pk25.github.io/ai-from-zero/` et redirection `https://sk34pk25.github.io/ai-from-zero/**` (le `?recovery=1` est déjà couvert).
- Authentication → Emails → Reset password : le modèle à `token_hash` ci-dessus, si les liens sont encore consommés par un scanner. Ce n'est pas un changement d'adresse de redirection.

## À retenir

- Un seul utilisateur, créé à la main.
- Les inscriptions publiques restent désactivées.
- `assets/config.js` ne contient que l'URL, la clé anon et l'UUID.
- Si l'interface est contournée, les politiques SQL refusent quand même l'écriture.


## Protection contre les mots de passe compromis

L'advisor du projet lié signalait cette option désactivée le 29 octobre 2026. La [documentation officielle](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) la réserve à Pro et aux offres supérieures. Vérifier sa disponibilité avant activation. Le code du site ne modifie aucun abonnement. Le formulaire exige 12 caractères ; ce contrôle client ne remplace pas la politique du serveur. Utiliser un mot de passe unique et vérifier les paramètres Auth effectifs. Les RLS restent indispensables.

## Durcissement des privilèges (30 octobre 2026)

Le projet lié est sur l’offre Free : la protection intégrée contre les mots de passe compromis n’est pas activée, car elle demande Pro ou plus. Aucun abonnement n’est modifié.

Pour un projet déjà installé, utiliser uniquement supabase/hardening.sql dans une transaction après vérification des six tables. Ne pas réappliquer le modèle schema.sql à UUID nul sur la production. Le durcissement conserve le CRUD authentifié sous RLS et retire les droits inutiles, y compris TRUNCATE, REFERENCES, TRIGGER et MAINTAIN. Les politiques, les fonctions, les données et les droits backend ne sont pas remplacés.

Les nouvelles tables publiques créées par le rôle qui exécute le script (postgres dans le SQL Editor/MCP) demandent leurs GRANT et politiques explicites. Les défauts du rôle interne supabase_admin restent gérés par la plateforme : postgres n’a pas le droit de les modifier. Contrôler les droits si un autre rôle crée une table.

La CI exécute tests/sql/permissions.sql dans un PostgreSQL jetable : installation, grants historiques, double application, identités propriétaire/autre/anonyme et sauvegarde avec révision. Ne jamais exécuter ces fixtures sur la base réelle.
