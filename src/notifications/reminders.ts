/**
 * Alertes de la Cédule : notifications LOCALES planifiées sur l'appareil, à
 * partir des rendez-vous de l'utilisateur connecté (reminderMinutes et
 * reminder2Minutes). Elles sonnent même app fermée et hors réseau.
 *
 * Synchronisation simple : on annule toutes nos alertes, puis on replanifie
 * les 30 prochains jours. iOS garde au plus 64 notifications planifiées : on
 * s'arrête à 60, les plus proches d'abord.
 */
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { schedule } from '../api/endpoints';
import { addDays, at, frTime, ymd } from '../lib/calendar';

const KIND = 'cedule';
const MAX_SCHEDULED = 60;
const HORIZON_DAYS = 30;

let running: Promise<void> | null = null;

/** Relance toujours une synchronisation complète ; les appels se suivent. */
export function syncCalendarReminders(userId: number | null): Promise<void> {
  const previous = running ?? Promise.resolve();
  running = previous.then(() => doSync(userId)).catch(e => {
    console.warn('[cedule] alertes non planifiées', e);
  });
  return running;
}

/** À la déconnexion : plus aucune alerte du compte sur l'appareil. */
export async function clearCalendarReminders(): Promise<void> {
  try {
    await cancelOurs();
  } catch {
    /* au mieux */
  }
}

async function cancelOurs(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter(n => (n.content.data as { kind?: string } | null)?.kind === KIND)
      .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

async function doSync(userId: number | null): Promise<void> {
  if (Platform.OS === 'web') return;
  await cancelOurs();
  if (userId == null) return;

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cedule', {
      name: 'Rappels de la cédule',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const today = new Date();
  const entries = await schedule.agenda({
    startDate: ymd(today),
    endDate: ymd(addDays(today, HORIZON_DAYS)),
    userIds: [userId],
    includeWorkOrders: false,
  });

  const now = Date.now();
  const alerts: { when: Date; title: string; body: string; eventId: number }[] = [];
  for (const e of entries) {
    if (e.kind !== 'event' || e.userId !== userId) continue;
    const start = at(e.date, e.allDay ? '00:00' : e.start);
    const when = e.allDay ? 'Toute la journée' : `À ${frTime(e.start)}`;
    const body = [when, e.location].filter(Boolean).join(' · ');
    for (const minutes of [e.reminderMinutes, e.reminder2Minutes]) {
      if (minutes == null) continue;
      const fire = new Date(start.getTime() - minutes * 60000);
      if (fire.getTime() <= now) continue;
      alerts.push({ when: fire, title: e.title, body, eventId: e.id });
    }
  }

  alerts.sort((a, b) => a.when.getTime() - b.when.getTime());
  for (const a of alerts.slice(0, MAX_SCHEDULED)) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: a.title,
        body: a.body,
        sound: true,
        data: { kind: KIND, eventId: a.eventId },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: a.when,
        channelId: 'cedule',
      },
    });
  }
}
