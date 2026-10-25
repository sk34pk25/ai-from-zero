# Brancher le compte propriétaire

Le projet `qffcqvwndnpdbrmqbjpz` est configuré. `assets/config.js` contient l'URL `https://qffcqvwndnpdbrmqbjpz.supabase.co`, la clé anon publique et l'UUID du propriétaire. Les inscriptions sont désactivées, le compte propriétaire existe, et l'URL du site ainsi que les redirections autorisées pointent vers `https://sk34pk25.github.io/ai-from-zero/`. Le schéma est appliqué, RLS compris. En ligne, `is_owner()` compare `auth.uid()` à cet UUID et fixe `search_path` à une chaîne vide. Le fichier du dépôt garde l'UUID nul : ne pas le réexécuter tel quel sur ce projet.

Le site reste lisible sans compte. L'IDE, les exercices, les quiz, la progression et le plan de données ne s'enregistrent que pour un utilisateur : celui dont l'identifiant est copié dans `assets/config.js`.

Le cadenas affiché dans les pages empêche un visiteur de lancer ces actions dans son navigateur. Il ne protège pas le serveur. La protection des lignes est dans `supabase/schema.sql` : `auth.uid()` doit être cet identifiant.

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

Si l'une de ces trois chaînes est vide, la page Connexion explique que le site reste en lecture seule. Elles sont renseignées pour le site publié.

## Mot de passe oublié

Dans Authentication → URL Configuration, ajoute l'adresse du site publié, par exemple `https://sk34pk25.github.io/ai-from-zero/`, dans les redirections autorisées.

Le bouton « Mot de passe oublié » envoie le message de Supabase. Le lien doit ramener sur `/#/connexion`.

## À retenir

- Un seul utilisateur, créé à la main.
- Les inscriptions publiques restent désactivées.
- `assets/config.js` ne contient que l'URL, la clé anon et l'UUID.
- Si l'interface est contournée, les politiques SQL refusent quand même l'écriture.
