/**
 * Layout racine : providers globaux, gestion du splash, garde d'authentification.
 */
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { KeyboardAccessory } from '../src/components/KeyboardAccessory';
import { workOrderIdOf } from '../src/notifications/push';

void SplashScreen.preventAutoHideAsync();

/**
 * Le module notifications n'existe pas sur le web : le hook plante toute
 * l'arbre s'il est appelé là. Sur iOS/Android, une notification touchée
 * (bon assigné, statut changé) ouvre le bon.
 */
function OpenWorkOrderFromNotification() {
  const { initializing, isAuthenticated } = useAuth();
  const router = useRouter();
  const lastResponse = Notifications.useLastNotificationResponse();

  useEffect(() => {
    if (initializing || !isAuthenticated) return;
    const id = workOrderIdOf(lastResponse ?? null);
    if (id) {
      router.push(`/(tabs)/work-orders/${id}`, { withAnchor: true });
      void Notifications.clearLastNotificationResponseAsync();
    }
  }, [lastResponse, initializing, isAuthenticated, router]);

  return null;
}

function RootNavigator() {
  const { initializing, isAuthenticated } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Garde de navigation : redirige selon l'état d'authentification.
  useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/sign-in');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [initializing, isAuthenticated, segments, router]);

  // Masque le splash dès que la session est restaurée.
  useEffect(() => {
    if (!initializing) void SplashScreen.hideAsync();
  }, [initializing]);

  if (initializing) return null;

  return (
    <>
      {Platform.OS === 'web' ? null : <OpenWorkOrderFromNotification />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="light" />
          <RootNavigator />
          <KeyboardAccessory />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
