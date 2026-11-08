/**
 * Notifications push (Expo). Le portail envoie déjà un push au technicien
 * quand un bon lui est assigné ou change de statut (server/pushNotifications.ts),
 * avec `data.workOrderId` : il suffit d'enregistrer le jeton de l'appareil.
 *
 * Tout est au mieux : sans projet EAS (avant `eas init`), sur simulateur ou
 * sans permission, l'app fonctionne sans push.
 */
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { push } from '../api/endpoints';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Jeton enregistré pour cette session, désactivé à la déconnexion. */
let registeredToken: string | null = null;

function easProjectId(): string | null {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? null;
}

export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice || Platform.OS === 'web') return;
    const projectId = easProjectId();
    if (!projectId) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bons de travail',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    if (status !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await push.register(token, Platform.OS === 'ios' ? 'ios' : 'android', Device.deviceName ?? undefined);
    registeredToken = token;
  } catch (e) {
    console.warn('[push] enregistrement impossible', e);
  }
}

/** À appeler AVANT d'effacer la session (l'appel exige encore le jeton). */
export async function unregisterPush(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;
  try {
    await push.deactivate(token);
  } catch {
    // Session déjà expirée : le portail garde le jeton, sans conséquence.
  }
}

/** Bon de travail visé par une notification touchée, s'il y en a un. */
export function workOrderIdOf(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as { workOrderId?: unknown } | undefined;
  const id = data?.workOrderId;
  return typeof id === 'number' || typeof id === 'string' ? String(id) : null;
}
