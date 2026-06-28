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
