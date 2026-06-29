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
import { auth, portalAuth } from '../api/endpoints';
import { setUnauthorizedHandler } from '../api/client';
import { SESSION_COOKIE_NAME } from '../api/config';
import type {
  AuthUser,
  ResendLoginOtpResult,
  Session,
  SessionAuth,
} from '../api/types';
import { clearSession, loadSession, saveSession } from './session';

const EIGHT_HOURS_SECONDS = 8 * 60 * 60;

function computeExpiry(expiresInSeconds?: number): number {
  const ttl = expiresInSeconds && expiresInSeconds > 0 ? expiresInSeconds : EIGHT_HOURS_SECONDS;
  return Date.now() + ttl * 1000;
}

/** Le backend lit la session via un cookie JWT (COOKIE_NAME). */
function adminAuthFromToken(token: string): SessionAuth {
  return { headerName: 'Cookie', headerValue: `${SESSION_COOKIE_NAME}=${token}` };
}

/** Résultat du login admin : connecté directement, ou 2e étape OTP requise. */
export type AdminLoginOutcome =
  | { status: 'authenticated' }
  | {
      status: 'otp';
      challengeId: string;
      resendAvailableAt?: string | number;
      expiresAt?: string | number;
    };

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
  /**
   * Login admin email + mot de passe. Retourne 'authenticated' si connecté
   * directement, ou 'otp' (+ challengeId) si une 2e étape SMS est requise.
   */
  signInWithPassword: (email: string, password: string) => Promise<AdminLoginOutcome>;
  /** Vérifie le code OTP du login admin (2e étape). */
  verifyAdminOtp: (challengeId: string, code: string) => Promise<void>;
  /** Renvoie le code OTP du login admin. */
  resendAdminOtp: (challengeId: string) => Promise<ResendLoginOtpResult>;
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
    async (email: string, password: string): Promise<AdminLoginOutcome> => {
      const res = await auth.login({ email, password });
      // 2e étape OTP requise → on remonte le challenge à l'écran.
      if (res.otpRequired === true) {
        return {
          status: 'otp',
          challengeId: res.challengeId,
          resendAvailableAt: res.resendAvailableAt,
          expiresAt: res.expiresAt,
        };
      }
      // Connexion directe : token JWT renvoyé.
      await applySession({
        user: res.user,
        auth: adminAuthFromToken(res.token),
        mode: 'admin',
        expiresAt: computeExpiry(res.expiresInSeconds),
      });
      return { status: 'authenticated' };
    },
    [applySession],
  );

  const verifyAdminOtp = useCallback(
    async (challengeId: string, code: string) => {
      const res = await auth.verifyLoginOtp({ challengeId, code });
      await applySession({
        user: res.user,
        auth: adminAuthFromToken(res.token),
        mode: 'admin',
        expiresAt: computeExpiry(res.expiresInSeconds),
      });
    },
    [applySession],
  );

  const resendAdminOtp = useCallback(
    (challengeId: string) => auth.resendLoginOtp({ challengeId }),
    [],
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
      verifyAdminOtp,
      resendAdminOtp,
      signOut: doSignOut,
    }),
    [
      initializing,
      session,
      requestOtp,
      signInWithOtp,
      signInWithPassword,
      verifyAdminOtp,
      resendAdminOtp,
      doSignOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
