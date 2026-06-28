/**
 * Contexte d'authentification — double mode (OTP employé / login admin).
 * Gère la session sécurisée, la restauration au démarrage, l'expiration (8h)
 * et la déconnexion forcée sur 401.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { adminAuth, portalAuth } from '../api/endpoints';
import { setUnauthorizedHandler } from '../api/client';
import type { AuthUser, Session } from '../api/types';
import { clearSession, loadSession, saveSession } from './session';

const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

function computeExpiry(expiresInSeconds?: number): number {
  const ttl = expiresInSeconds && expiresInSeconds > 0 ? expiresInSeconds : EIGHT_HOURS_SECONDS;
  return Date.now() + ttl * 1000;
}

interface AuthContextValue {
  /** En cours de restauration de la session au démarrage. */
  initializing: boolean;
  user: AuthUser | null;
  mode: Session['mode'] | null;
  isAuthenticated: boolean;
  /** Vérifie le code OTP et ouvre la session employé. */
  signInWithOtp: (phone: string, code: string) => Promise<void>;
  /** Demande l'envoi d'un code OTP. */
  requestOtp: (phone: string) => Promise<void>;
  /** Login admin email + mot de passe. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSignOut = useCallback(async () => {
    if (expiryTimer.current) {
      clearTimeout(expiryTimer.current);
      expiryTimer.current = null;
    }
    setSession(null);
    await clearSession();
  }, []);

  const applySession = useCallback(
    async (next: Session) => {
      await saveSession(next);
      setSession(next);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
      const ms = Math.max(0, next.expiresAt - Date.now());
      // Déconnexion automatique à l'expiration (8h).
      expiryTimer.current = setTimeout(() => {
        void doSignOut();
      }, ms);
    },
    [doSignOut],
  );

  // Restauration au démarrage + handler 401 global.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void doSignOut();
    });
    void (async () => {
      const restored = await loadSession();
      if (restored) {
        await applySession(restored);
      }
      setInitializing(false);
    })();
    return () => {
      setUnauthorizedHandler(null);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [applySession, doSignOut]);

  const requestOtp = useCallback(async (phone: string) => {
    await portalAuth.requestOtp({ phone });
  }, []);

  const signInWithOtp = useCallback(
    async (phone: string, code: string) => {
      const res = await portalAuth.verifyOtp({ phone, code });
      await applySession({
        user: res.user,
        auth: { headerName: 'x-portal-session', headerValue: res.session },
        mode: 'employee',
        expiresAt: computeExpiry(res.expiresInSeconds),
      });
    },
    [applySession],
  );

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await adminAuth.login({ email, password });
      await applySession({
        user: res.user,
        auth: { headerName: 'authorization', headerValue: `Bearer ${res.token}` },
        mode: 'admin',
        expiresAt: computeExpiry(res.expiresInSeconds),
      });
    },
    [applySession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      user: session?.user ?? null,
      mode: session?.mode ?? null,
      isAuthenticated: !!session,
      requestOtp,
      signInWithOtp,
      signInWithPassword,
      signOut: doSignOut,
    }),
    [initializing, session, requestOtp, signInWithOtp, signInWithPassword, doSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
