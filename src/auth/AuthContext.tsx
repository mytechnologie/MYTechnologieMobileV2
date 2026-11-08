/**
 * Contexte d'authentification — connexion unique du portail :
 * courriel + mot de passe (auth.login), puis code SMS (auth.verifyLoginOtp).
 * Le jeton renvoyé part en `Authorization: Bearer`. L'app redemande la
 * connexion après 8 h et se déconnecte sur 401.
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
import { auth } from '../api/endpoints';
import { registerForPush, unregisterPush } from '../notifications/push';
import { setUnauthorizedHandler } from '../api/client';
import type { AuthUser, Session } from '../api/types';
import { clearSession, loadSession, saveSession, setActiveAuth } from './session';

const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

/** Étape « code SMS » en attente après le mot de passe. */
export interface OtpChallenge {
  challengeId: string;
  email: string;
}

interface AuthContextValue {
  /** En cours de restauration de la session au démarrage. */
  initializing: boolean;
  user: AuthUser | null;
  mode: Session['mode'] | null;
  isAuthenticated: boolean;
  /**
   * Étape 1. Renvoie le défi SMS à compléter, ou null si le compte est
   * dispensé de code (la session est alors ouverte).
   */
  signIn: (email: string, password: string) => Promise<OtpChallenge | null>;
  /** Étape 2 : code à 6 chiffres reçu par SMS. */
  verifyCode: (challenge: OtpChallenge, code: string) => Promise<void>;
  resendCode: (challenge: OtpChallenge) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSignOut = useCallback(async () => {
    // Avant d'effacer le jeton : le portail doit savoir qu'il ne faut plus
    // pousser vers cet appareil.
    await unregisterPush();
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
        void registerForPush();
      }
      setInitializing(false);
    })();
    return () => {
      setUnauthorizedHandler(null);
      if (expiryTimer.current) clearTimeout(expiryTimer.current);
    };
  }, [applySession, doSignOut]);

  /** Ouvre la session à partir du jeton : profil et permissions via auth.me. */
  const openSession = useCallback(
    async (token: string) => {
      const authHeader = { headerName: 'authorization', headerValue: `Bearer ${token}` };
      setActiveAuth(authHeader);
      const me = await auth.me();
      if (!me) {
        setActiveAuth(null);
        throw new Error('Session refusée par le serveur.');
      }
      await applySession({
        user: {
          id: String(me.id),
          name: me.name ?? me.email ?? 'Utilisateur',
          role: me.role,
          email: me.email,
          phone: me.phone ?? null,
          permissions: me.permissions,
        },
        auth: authHeader,
        mode: 'token',
        expiresAt: Date.now() + EIGHT_HOURS_MS,
      });
      void registerForPush();
    },
    [applySession],
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<OtpChallenge | null> => {
      const res = await auth.login({ email, password });
      if (res.otpRequired) return { challengeId: res.challengeId, email };
      await openSession(res.token);
      return null;
    },
    [openSession],
  );

  const verifyCode = useCallback(
    async (challenge: OtpChallenge, code: string) => {
      const res = await auth.verifyLoginOtp({ challengeId: challenge.challengeId, otpCode: code });
      await openSession(res.token);
    },
    [openSession],
  );

  const resendCode = useCallback(async (challenge: OtpChallenge) => {
    await auth.resendLoginOtp(challenge.challengeId);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initializing,
      user: session?.user ?? null,
      mode: session?.mode ?? null,
      isAuthenticated: !!session,
      signIn,
      verifyCode,
      resendCode,
      signOut: doSignOut,
    }),
    [initializing, session, signIn, verifyCode, resendCode, doSignOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}
