/**
 * Résout clientId → nom de client pour les bons de travail.
 *
 * Le nom du client n'est PAS stocké dans work_orders : le backend renvoie un
 * `clientId`. Comme le web (client/src/pages/WorkOrders.tsx), on charge
 * `clients.list` une fois et on construit un Map clientId→name.
 */
import { useCallback, useMemo } from 'react';
import { clients } from './endpoints';
import { useQuery } from './useApi';

export interface ClientResolver {
  /** Nom du client, ou `Client #<id>` en repli si non résolu/chargement. */
  clientName: (clientId: number | null | undefined) => string;
  loading: boolean;
}

export function useClientMap(): ClientResolver {
  const { data } = useQuery(() => clients.list(), []);

  const map = useMemo(() => {
    const m = new Map<number, string>();
    for (const c of data ?? []) m.set(c.id, c.name);
    return m;
  }, [data]);

  const clientName = useCallback(
    (clientId: number | null | undefined): string => {
      if (clientId == null) return '—';
      return map.get(clientId) ?? `Client #${clientId}`;
    },
    [map],
  );

  return { clientName, loading: data == null };
}
