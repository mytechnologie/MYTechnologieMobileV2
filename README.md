# MY Tech Service — App mobile (V2)

Application mobile terrain de **M.Y. Technologie & Sécurité** : portail employé (saisie
d'heures) et console admin (projets, bons de travail, heures). iOS + Android, Expo SDK 54.

## Stack

- **Expo SDK 54** + **expo-router** (routing par fichiers), TypeScript strict.
- **@trpc/client** (`createTRPCProxyClient` + `httpBatchLink`) vers l'API existante.
- **expo-secure-store** pour la session sécurisée.
- Thème centralisé (`src/theme`), palette claire navy `#0a1f3d` / gold `#C9A227`.

## Démarrage

```bash
npm install
cp .env.example .env        # ajuster EXPO_PUBLIC_API_URL si besoin
npm run start               # puis « i » (iOS) ou « a » (Android)
```

- `npm run typecheck` — TypeScript strict, 0 erreur.
- `npm run ios` / `npm run android` — lance directement sur le simulateur/émulateur.

## Backend (réutilisé, NON modifié)

- Base URL : `EXPO_PUBLIC_API_URL` (fallback Cloud Run de production).
- Préfixe tRPC : `/api/trpc`.
- **Header obligatoire** `x-mobile-app: true` sur toutes les requêtes (sinon 403 CSRF / Turnstile).
- Auth employé : `portalAuth.requestOtp` / `portalAuth.verifyOtp` (OTP SMS, header `x-portal-session`).
- Auth admin : `auth.login` → `auth.verifyLoginOtp` / `auth.resendLoginOtp` (OTP conditionnel),
  token JWT renvoyé en cookie `Cookie: <COOKIE_NAME>=<token>` (`EXPO_PUBLIC_SESSION_COOKIE_NAME`).
- Données (noms vérifiés) : `projects.list` / `projects.getById`, `projectTasks.list`,
  `workOrders.list` / `workOrders.get` / `workOrders.changeStatus`, `timesheet.*`.

> Les types des entrées/sorties sont déclarés localement dans `src/api/types.ts` et les
> noms de procédures dans `src/api/endpoints.ts`. Si une forme/route diffère côté backend,
> **ajuster uniquement ces deux fichiers** — le reste de l'app en dépend.

## Authentification — double mode

| Rôle | Connexion | Session |
|------|-----------|---------|
| Employé régulier (technicien…) | OTP SMS (`portalAuth`) | header `x-portal-session`, 8 h |
| admin / manager / super_admin | Email + mot de passe (`auth.login`) + OTP SMS si requis | cookie `<COOKIE_NAME>=<JWT>`, 8 h |

La session expire après 8 h (re-login automatique). Un 401 force la déconnexion.

## Contrôle d'accès (strict, basé sur le rôle/permissions de l'API)

- **Employé régulier** → Accueil + **Saisie d'heures** uniquement.
- **admin / manager / super_admin** → les 4 sections.
- Aucun `role === "admin"` codé en dur : voir `src/auth/access.ts`. Les onglets sont
  filtrés selon le rôle.

## Les 4 sections

1. **Accueil** — dashboard adapté au rôle (résumé d'heures pour l'employé ; aperçu projets /
   bons pour l'admin).
2. **Projets** (admin/manager) — liste + détail (phases, tâches, heures, budget).
3. **Bons de travail** (admin/manager) — liste + détail (équipement, photos, changement de
   statut).
4. **Saisie d'heures** (tous) — formulaire date / projet-bon / début-fin-pause (total live,
   gestion overnight) / notes ; historique avec statut, édition des brouillons, soumission.

## Identité de l'app

- Bundle id iOS / package Android : `ca.mytechnologie.mytechservice`.
- Icônes existantes (App Store) dans `assets/` — **non régénérées**.
- Nom affiché : « MY Tech Service ».

## Build EAS

`eas.json` définit les profils **development / preview / production** (iOS + Android,
même bundle id). Avant le premier build :

```bash
npm i -g eas-cli
eas login
eas init            # renseigne extra.eas.projectId dans app.json
eas build --profile preview --platform all
```

## Structure

```
app/                 # routes expo-router
  (auth)/            # sign-in, OTP employé, login admin
  (tabs)/            # onglets filtrés par rôle
    index.tsx        # Accueil
    projects/        # liste + détail
    work-orders/     # liste + détail
    timesheet/       # historique + new + édition
src/
  api/               # config, client tRPC, endpoints, types, hooks de données
  auth/              # AuthContext, session sécurisée, contrôle d'accès
  components/        # UI (Screen, primitives, états, header, formulaire heures)
  lib/               # calculs d'heures, formatage
  theme/             # couleurs / typo / espacements centralisés
```

Reste à faire : voir [`V2_BACKLOG.md`](./V2_BACKLOG.md).
