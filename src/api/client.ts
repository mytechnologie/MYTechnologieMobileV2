/**
 * Client tRPC (vanilla proxy) — @trpc/client + httpBatchLink.
 *
 * Le routeur backend n'est pas importé : on type le proxy de façon permissive et on
 * expose des wrappers fortement typés dans `endpoints.ts` (types depuis `types.ts`).
 * Les headers d'auth sont injectés dynamiquement à chaque batch depuis le cache mémoire.
 */
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { API_TRPC_URL } from './config';
import { getAuthHeaders } from '../auth/session';

/**
 * Accès permissif au proxy : la sûreté de type est garantie au niveau des wrappers
 * fortement typés d'`endpoints.ts` (entrées/sorties depuis `types.ts`).
 * Le proxy tRPC accepte n'importe quel chemin `client.<router>.<procedure>.query|mutate`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseClient = any;

/** Callback notifié quand une requête revient 401/expirée (déconnexion forcée). */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

export const trpc = createTRPCProxyClient<any>({
  links: [
    httpBatchLink({
      url: API_TRPC_URL,
      async fetch(input, init) {
        const res = await fetch(input as RequestInfo, init);
        if (res.status === 401) {
          onUnauthorized?.();
        }
        return res;
      },
      headers() {
        return {
          // OBLIGATOIRE : signale au backend une requête mobile. Sans ce header,
          // auth.login exige un token Cloudflare Turnstile (impossible sur mobile).
          'x-mobile-app': 'true',
          ...getAuthHeaders(),
        };
      },
    }),
  ],
}) as unknown as LooseClient;
