/**
 * Outils de dates de la Cédule. Tout est en date LOCALE (YYYY-MM-DD) : le
 * portail stocke workDate et les heures tels que saisis, sans fuseau.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function hm(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** 'HH:MM' → minutes depuis minuit. */
export function minutesOf(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Date locale + 'HH:MM' → Date. */
export function at(date: string, time: string): Date {
  const d = parseYmd(date);
  const min = minutesOf(time);
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Semaine commençant le dimanche, comme Calendrier au Canada. */
export function weekStart(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() - r.getDay());
  return r;
}

/** Grille du mois : 5 ou 6 semaines complètes, du dimanche au samedi. */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = weekStart(first);
  const last = new Date(year, month + 1, 0);
  const days: Date[] = [];
  for (let d = start; d <= last || d.getDay() !== 0; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}

export const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

export function monthTitle(d: Date): string {
  const s = d.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function longDay(d: Date): string {
  const s = d.toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** '13:30' → '13 h 30', '09:00' → '9 h'. */
export function frTime(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return m ? `${h} h ${pad2(m ?? 0)}` : `${h} h`;
}

/** Alertes proposées, comme Calendrier Apple (minutes avant le début). */
export const REMINDER_OPTIONS: { minutes: number | null; label: string }[] = [
  { minutes: null, label: 'Aucune' },
  { minutes: 0, label: "À l'heure du rendez-vous" },
  { minutes: 5, label: '5 minutes avant' },
  { minutes: 10, label: '10 minutes avant' },
  { minutes: 15, label: '15 minutes avant' },
  { minutes: 30, label: '30 minutes avant' },
  { minutes: 60, label: '1 heure avant' },
  { minutes: 120, label: '2 heures avant' },
  { minutes: 1440, label: '1 jour avant' },
  { minutes: 2880, label: '2 jours avant' },
  { minutes: 10080, label: '1 semaine avant' },
];

export function reminderLabel(minutes: number | null | undefined): string {
  if (minutes == null) return 'Aucune';
  return REMINDER_OPTIONS.find(o => o.minutes === minutes)?.label ?? `${minutes} min avant`;
}

/** Couleurs proposées pour un rendez-vous (contraste suffisant sur blanc). */
export const EVENT_COLORS = ['#2563A8', '#1E8E5A', '#C0392B', '#8E44AD', '#0E7C86', '#D35400'];

/** Couleur stable par personne (rang dans la liste du personnel). */
export const PERSON_COLORS = ['#2563A8', '#1E8E5A', '#8E44AD', '#D35400', '#0E7C86', '#C0392B', '#5A6B82'];
