# Backlog « v2 » — à implémenter après la v1

Fonctionnalités identifiées mais **non incluses** dans cette première version. Listées ici
pour cadrage, sans implémentation.

## Fonctionnel

- **Dépenses / reçus** — saisie de dépenses terrain, photo du reçu, catégorie, montant,
  rattachement projet/bon, statut d'approbation. (Endpoints `expenses.*` à confirmer.)
- **Scanner d'inventaire** — scan code-barres / QR (`expo-camera` + `expo-barcode-scanner`)
  pour sorties/retours de matériel et association à un bon de travail.
- **Audits / inspections** — formulaires d'inspection configurables (checklists, signatures,
  photos), génération de rapport.
- **Push notifications** — `expo-notifications` : nouveau bon assigné, heures rejetées,
  rappel de soumission, approbations en attente (admin).
- **Ajout de photos sur un bon de travail** — capture/upload depuis le détail du bon
  (`expo-image-picker` / `expo-camera`), actuellement en lecture seule.
- **Approbations côté admin** — écran dédié pour approuver/rejeter les feuilles de temps
  des employés (endpoint d'approbation à exposer).
- **Édition des tâches de projet** — changer le statut d'une tâche depuis le mobile
  (actuellement lecture seule).
- **Mode hors-ligne** — file d'attente locale des saisies d'heures et synchronisation
  différée (réseau intermittent sur le terrain).

## Technique / qualité

- **Tests** — unitaires (calcul d'heures, contrôle d'accès) + tests de composants.
- **Typed routes** — réactiver `experiments.typedRoutes` une fois la génération de types
  intégrée au pipeline CI.
- **Cache de données** — migrer les hooks maison vers `@tanstack/react-query` +
  `@trpc/react-query` si le besoin de cache/invalidation grandit.
- **Splash dédié** — visuel de splash distinct de l'icône App Store.
- **i18n** — externaliser les libellés (actuellement français en dur).
- **Gestion fine des permissions** — exploiter un éventuel tableau `permissions` détaillé
  renvoyé par l'API pour un contrôle plus granulaire que le rôle.
- **Rafraîchissement du token** — endpoint de refresh pour prolonger la session sans
  re-login complet à l'expiration des 8 h.
