/**
 * Point d'entrée : redirige vers l'app ou l'authentification.
 */
import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';

export default function Index() {
  const { initializing, isAuthenticated } = useAuth();
  if (initializing) return null;
  return <Redirect href={isAuthenticated ? '/(tabs)' : '/(auth)/sign-in'} />;
}
