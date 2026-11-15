/**
 * Formatage des dates et libellés de statut (français).
 */
import {
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrderStatus,
  type ProjectStatus,
  type ProjectTaskStatus,
  type TimesheetStatus,
  type WorkOrderStatus,
} from '../api/types';
import { colors } from '../theme';

/** ISO ou Date → 'lun. 27 juin 2026' (ou '—' si invalide). */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('fr-CA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** ISO date courte 'YYYY-MM-DD'. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Durée en minutes → « 2h30 ». */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const total = Math.max(0, Math.round(minutes));
  return `${Math.floor(total / 60)}h${String(total % 60).padStart(2, '0')}`;
}

/** Minutes → { hours, minutes } (préremplissage des champs). */
export function splitDuration(minutes: number | null | undefined): { hours: number; minutes: number } {
  if (minutes == null || Number.isNaN(minutes)) return { hours: 0, minutes: 0 };
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export interface StatusStyle {
  label: string;
  color: string;
  bg: string;
}

const TIMESHEET_LABELS: Record<string, StatusStyle> = {
  draft: { label: 'Brouillon', color: colors.textMuted, bg: colors.surfaceAlt },
  submitted: { label: 'Soumis', color: colors.info, bg: colors.infoBg },
  approved: { label: 'Approuvé', color: colors.success, bg: colors.successBg },
  rejected: { label: 'Rejeté', color: colors.danger, bg: colors.dangerBg },
};

export function timesheetStatusStyle(status: TimesheetStatus): StatusStyle {
  return (
    TIMESHEET_LABELS[status] ?? {
      label: status,
      color: colors.textMuted,
      bg: colors.surfaceAlt,
    }
  );
}

const WORK_ORDER_LABELS: Record<string, StatusStyle> = {
  nouveau: { label: 'Nouveau', color: colors.textMuted, bg: colors.surfaceAlt },
  a_rappeler: { label: 'À rappeler', color: colors.warning, bg: colors.warningBg },
  planifie: { label: 'Planifié', color: colors.info, bg: colors.infoBg },
  en_route: { label: 'En route', color: colors.warning, bg: colors.warningBg },
  en_cours: { label: 'Sur place', color: colors.warning, bg: colors.warningBg },
  complete: { label: 'Complété', color: colors.success, bg: colors.successBg },
  en_revision: { label: 'En révision', color: colors.info, bg: colors.infoBg },
  a_facturer: { label: 'À facturer', color: colors.textMuted, bg: colors.surfaceAlt },
  facture: { label: 'Facturé', color: colors.textMuted, bg: colors.surfaceAlt },
  non_facture: { label: 'Non facturé', color: colors.textMuted, bg: colors.surfaceAlt },
};

export function workOrderStatusStyle(status: WorkOrderStatus): StatusStyle {
  return (
    WORK_ORDER_LABELS[status] ?? {
      label: status,
      color: colors.textMuted,
      bg: colors.surfaceAlt,
    }
  );
}

/** Statuts de bon de travail proposés pour le changement (ordre logique). */
/** Le parcours terrain ; le portail refuse une transition non permise au rôle. */
export const WORK_ORDER_STATUS_OPTIONS: WorkOrderStatus[] = [
  'planifie',
  'en_route',
  'en_cours',
  'complete',
];

const PROJECT_LABELS: Record<string, StatusStyle> = {
  preparation: { label: 'Préparation', color: colors.info, bg: colors.infoBg },
  en_cours: { label: 'En cours', color: colors.success, bg: colors.successBg },
  en_pause: { label: 'En pause', color: colors.warning, bg: colors.warningBg },
  reception: { label: 'Réception', color: colors.info, bg: colors.infoBg },
  termine: { label: 'Terminé', color: colors.textMuted, bg: colors.surfaceAlt },
  annule: { label: 'Annulé', color: colors.danger, bg: colors.dangerBg },
};

export function projectStatusStyle(status: ProjectStatus): StatusStyle {
  return (
    PROJECT_LABELS[status] ?? {
      label: status,
      color: colors.textMuted,
      bg: colors.surfaceAlt,
    }
  );
}

const TASK_LABELS: Record<string, StatusStyle> = {
  a_venir: { label: 'À venir', color: colors.textMuted, bg: colors.surfaceAlt },
  en_cours: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  terminee: { label: 'Terminée', color: colors.success, bg: colors.successBg },
  todo: { label: 'À faire', color: colors.textMuted, bg: colors.surfaceAlt },
  in_progress: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  blocked: { label: 'Bloqué', color: colors.danger, bg: colors.dangerBg },
  done: { label: 'Terminé', color: colors.success, bg: colors.successBg },
};

export function taskStatusStyle(status: ProjectTaskStatus): StatusStyle {
  return (
    TASK_LABELS[status] ?? {
      label: status,
      color: colors.textMuted,
      bg: colors.surfaceAlt,
    }
  );
}

const DEVICE_LABELS: Record<string, StatusStyle> = {
  prevu: { label: 'Prévu', color: colors.textMuted, bg: colors.surfaceAlt },
  installe: { label: 'Installé', color: colors.warning, bg: colors.warningBg },
  configure: { label: 'Configuré', color: colors.info, bg: colors.infoBg },
  verifie: { label: 'Vérifié', color: colors.success, bg: colors.successBg },
};

export const DEVICE_STATUS_OPTIONS = ['prevu', 'installe', 'configure', 'verifie'] as const;

export function deviceStatusStyle(status: string): StatusStyle {
  return DEVICE_LABELS[status] ?? { label: status, color: colors.textMuted, bg: colors.surfaceAlt };
}

const ORDER_MONTHS = [
  'jan',
  'fév',
  'mar',
  'avr',
  'mai',
  'juin',
  'juil',
  'août',
  'sept',
  'oct',
  'nov',
  'déc',
] as const;

/** Date civile d'une commande → « 10 nov 2026 ». */
export function formatOrderDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  let d: Date;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [y, m, day] = value.slice(0, 10).split('-').map(Number);
    if (!y || !m || !day) return '—';
    d = new Date(y, m - 1, day);
  } else {
    d = value instanceof Date ? value : new Date(value);
  }
  if (Number.isNaN(d.getTime())) return '—';
  const month = ORDER_MONTHS[d.getMonth()] ?? '';
  return `${d.getDate()} ${month} ${d.getFullYear()}`;
}

/** Quantité affichée (entier tel quel, sinon au plus 2 décimales). */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return value.toLocaleString('fr-CA', { maximumFractionDigits: 2 });
}

/**
 * Libellés du portail (`CUSTOMER_ORDER_STATUS_LABELS`).
 * Une couleur du thème par statut.
 */
const CUSTOMER_ORDER_LABELS: Record<CustomerOrderStatus, StatusStyle> = {
  nouveau: { label: 'Nouveau', color: colors.info, bg: colors.infoBg },
  envoye: { label: 'Envoyé', color: colors.navy, bg: colors.surfaceAlt },
  a_facturer: { label: 'À facturer', color: colors.warning, bg: colors.warningBg },
  facture: { label: 'Facturé', color: colors.success, bg: colors.successBg },
};

export function customerOrderStatusStyle(status: CustomerOrderStatus): StatusStyle {
  return CUSTOMER_ORDER_LABELS[status];
}

export interface CustomerOrderTransition {
  status: CustomerOrderStatus;
  /** « Passer à … » pour l'étape suivante et les sauts ; « Revenir à … » pour un retour. */
  title: string;
  /** L'étape suivante du parcours (nouveau → envoyé → à facturer → facturé). */
  primary: boolean;
}

/**
 * setStatus accepte n'importe lequel des quatre statuts : pas de graphe.
 * Le bouton principal est l'étape suivante ; les autres couvrent les sauts
 * et les retours, que le serveur accepte aussi.
 */
export function customerOrderTransitions(status: CustomerOrderStatus): CustomerOrderTransition[] {
  const index = CUSTOMER_ORDER_STATUSES.indexOf(status);
  if (index < 0) return [];
  const next = CUSTOMER_ORDER_STATUSES[index + 1];
  const later = CUSTOMER_ORDER_STATUSES.slice(index + 2);
  const earlier = CUSTOMER_ORDER_STATUSES.slice(0, index).reverse();
  const button = (
    target: CustomerOrderStatus,
    kind: 'next' | 'skip' | 'revert',
  ): CustomerOrderTransition => {
    const label = CUSTOMER_ORDER_LABELS[target].label;
    return {
      status: target,
      title: kind === 'revert' ? `Revenir à ${label}` : `Passer à ${label}`,
      primary: kind === 'next',
    };
  };
  return [
    ...(next ? [button(next, 'next')] : []),
    ...later.map((target) => button(target, 'skip')),
    ...earlier.map((target) => button(target, 'revert')),
  ];
}

export function countCustomerOrdersByStatus(
  orders: readonly { status: CustomerOrderStatus }[],
): Record<CustomerOrderStatus, number> {
  const counts: Record<CustomerOrderStatus, number> = {
    nouveau: 0,
    envoye: 0,
    a_facturer: 0,
    facture: 0,
  };
  for (const order of orders) counts[order.status] += 1;
  return counts;
}

/** Résumé d'une commande : « 6 caméras dôme 4K, 2 contrôleurs d'accès, … ». */
export function summarizeOrderLines(
  lines: { quantity: number; description: string }[],
): string {
  const parts = lines
    .map((line) => {
      const description = line.description.trim();
      if (!description) return '';
      return `${formatQuantity(line.quantity)} ${description}`;
    })
    .filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : 'Aucun article';
}

/** Libellé lisible du rôle. */
export function roleLabel(role: string): string {
  const map: Record<string, string> = {
    employee: 'Employé',
    technician: 'Technicien',
    admin: 'Administrateur',
    manager: 'Gestionnaire',
    super_admin: 'Super admin',
  };
  return map[role] ?? role;
}
