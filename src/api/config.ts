/**
 * Configuration de l'accès API.
 * Base URL via EXPO_PUBLIC_API_URL, sinon fallback production (Cloud Run).
 * tRPC est servi sous le préfixe /api/trpc.
 */

const FALLBACK_API_URL =
  'https://workorders-app-970975178770.northamerica-northeast1.run.app';

const raw = process.env.EXPO_PUBLIC_API_URL ?? FALLBACK_API_URL;

/** Base URL sans slash final. */
export const API_BASE = raw.replace(/\/+$/, '');

/** Endpoint racine tRPC. */
export const API_TRPC_URL = `${API_BASE}/api/trpc`;

/**
 * Nom du cookie de session attendu par le backend (COOKIE_NAME).
 * Le login admin renvoie un `token` JWT ; on le renvoie au backend via
 * `Cookie: <SESSION_COOKIE_NAME>=<token>`. Ajustable sans toucher au code.
 */
export const SESSION_COOKIE_NAME =
  process.env.EXPO_PUBLIC_SESSION_COOKIE_NAME ?? 'session';
