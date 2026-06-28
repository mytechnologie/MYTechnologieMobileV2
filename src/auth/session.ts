/**
 * Persistance de session via expo-secure-store + cache mémoire des headers d'auth.
 * Le client tRPC lit `getAuthHeaders()` de façon synchrone à chaque requête.
 */
import * as SecureStore from 'expo-secure-store';
import type { Session, SessionAuth } from '../api/types';

const SESSION_KEY = 'mytech.session.v1';

/** Header actif lu par le client tRPC (mis à jour à chaque login/logout). */
let activeAuth: SessionAuth | null = null;

export function setActiveAuth(auth: SessionAuth | null): void {
  activeAuth = auth;
}

export function getAuthHeaders(): Record<string, string> {
  if (!activeAuth) return {};
  return { [activeAuth.headerName]: activeAuth.headerValue };
}

export async function saveSession(session: Session): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  setActiveAuth(session.auth);
}

export async function loadSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Session;
    if (!parsed?.auth || !parsed?.user) return null;
    // Session expirée → on ne la restaure pas.
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt <= Date.now()) {
      await clearSession();
      return null;
    }
    setActiveAuth(parsed.auth);
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  setActiveAuth(null);
  await SecureStore.deleteItemAsync(SESSION_KEY);
}
