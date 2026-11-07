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

## Backend (portail workorders-appsv2)

- Base URL : `EXPO_PUBLIC_API_URL` (fallback Cloud Run de production). tRPC sous `/api/trpc`,
  transformer **superjson** (obligatoire, comme le serveur).
- Chaque requête envoie `x-mobile-app: true` (le portail saute Turnstile et le jeton CSRF).
- Types déclarés localement (`src/api/types.ts`), appels et conversions dans
  `src/api/endpoints.ts`. Si une forme change côté portail, ajuster ces deux fichiers.

## Connexion — une seule, celle du portail

Techniciens et administrateurs : courriel + mot de passe (`auth.login`), puis code SMS
(`auth.verifyLoginOtp`). Le jeton renvoyé part en `Authorization: Bearer` ; le profil et les
permissions viennent de `auth.me`. L'app redemande la connexion après 8 h et se déconnecte sur 401.

Les heures (`timesheet.*`) acceptent ce jeton depuis la PR portail #41 : **la déployer avant
de tester la saisie d'heures**.

## Sections

| Rôle | Sections |
|------|----------|
| technicien, admin, manager, super_admin | Accueil, Projets, Bons, Heures |
| autre | Accueil, Heures |

Le portail filtre ce que chacun voit (un technicien ne reçoit que ses bons). Voir
`src/auth/access.ts`.

## Build TestFlight

Version affichée : **2.0.0** (`app.json`), pour passer devant la version déjà publiée
(cachée) sur l'App Store. Le numéro de build est géré par EAS (`appVersionSource: remote`).

```bash
npm i -g eas-cli
eas login
eas init                                         # lie le projet Expo (extra.eas.projectId)
eas build --profile production --platform ios
eas submit --platform ios --latest               # envoie le build sur TestFlight
```

`eas submit` demande l'app App Store Connect : choisir l'app existante. Son identifiant de
bundle doit être `ca.mytechnologie.mytechservice` ; sinon, corriger `ios.bundleIdentifier`.

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
  (auth)/            # connexion (mot de passe + code SMS)
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
