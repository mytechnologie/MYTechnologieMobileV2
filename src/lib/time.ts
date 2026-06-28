/**
 * Calculs d'heures pour la saisie (gestion overnight + pause).
 */

/** Parse 'HH:mm' → minutes depuis minuit, ou null si invalide. */
export function parseHmToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes depuis minuit → 'HH:mm'. */
export function minutesToHm(total: number): string {
  const norm = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(norm / 60);
  const m = norm % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface DurationResult {
  /** Total en heures décimales (ex. 7.5), 0 si invalide. */
  hours: number;
  /** Minutes travaillées nettes. */
  minutes: number;
  /** true si l'intervalle franchit minuit. */
  overnight: boolean;
  /** false si les entrées sont invalides. */
  valid: boolean;
}

/**
 * Total travaillé entre start et end (gère le passage à minuit), moins la pause.
 * Si end <= start, on considère un quart de nuit (+24h).
 */
export function computeWorkedHours(
  startTime: string,
  endTime: string,
  breakMinutes: number,
): DurationResult {
  const start = parseHmToMinutes(startTime);
  const end = parseHmToMinutes(endTime);
  const pause = Number.isFinite(breakMinutes) ? Math.max(0, breakMinutes) : 0;

  if (start === null || end === null) {
    return { hours: 0, minutes: 0, overnight: false, valid: false };
  }

  let span = end - start;
  let overnight = false;
  if (span <= 0) {
    span += 1440; // quart de nuit
    overnight = true;
  }

  const net = Math.max(0, span - pause);
  return {
    hours: Math.round((net / 60) * 100) / 100,
    minutes: net,
    overnight,
    valid: true,
  };
}

/** Formate des heures décimales en libellé court : 7.5 → '7 h 30'. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return '0 h';
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, '0')}`;
}
