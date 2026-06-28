/**
 * Petits hooks de données autour des wrappers tRPC (sans react-query).
 * Gèrent loading / error / refetch et l'annulation sur démontage.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  /** true pendant un refetch alors que des données existent déjà. */
  refreshing: boolean;
}

function toError(e: unknown): Error {
  if (e instanceof Error) return e;
  return new Error(typeof e === 'string' ? e : 'Une erreur est survenue.');
}

/**
 * Exécute `fetcher` au montage et quand `deps` change.
 * `fetcher` doit être stable ou défini inline (les deps contrôlent le re-fetch).
 */
export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[] = [],
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);
  const hasData = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableFetcher = useCallback(fetcher, deps);

  const run = useCallback(async () => {
    if (hasData.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await stableFetcher();
      if (!mounted.current) return;
      setData(result);
      hasData.current = true;
    } catch (e) {
      if (!mounted.current) return;
      setError(toError(e));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [stableFetcher]);

  useEffect(() => {
    mounted.current = true;
    void run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  const refetch = useCallback(() => {
    void run();
  }, [run]);

  return { data, loading, error, refreshing, refetch };
}

export interface MutationState<TInput, TOutput> {
  mutate: (input: TInput) => Promise<TOutput>;
  loading: boolean;
  error: Error | null;
  reset: () => void;
}

/** Mutation impérative avec suivi loading/error. */
export function useMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
): MutationState<TInput, TOutput> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const mutate = useCallback(
    async (input: TInput) => {
      setLoading(true);
      setError(null);
      try {
        return await fn(input);
      } catch (e) {
        if (mounted.current) setError(toError(e));
        throw toError(e);
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [fn],
  );

  return { mutate, loading, error, reset: () => setError(null) };
}
