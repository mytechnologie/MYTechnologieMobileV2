/**
 * Formatage des dates et libellés de statut (français).
 */
import type {
  ProjectStatus,
  ProjectTaskStatus,
  TimesheetStatus,
  WorkOrderStatus,
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

// Statuts réels de la table work_orders (enum backend, FR).
const WORK_ORDER_LABELS: Record<string, StatusStyle> = {
  en_attente: { label: 'En attente', color: colors.textMuted, bg: colors.surfaceAlt },
  assigne: { label: 'Assigné', color: colors.info, bg: colors.infoBg },
  en_cours: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  soumis: { label: 'Soumis', color: colors.info, bg: colors.infoBg },
  en_revision: { label: 'En révision', color: colors.warning, bg: colors.warningBg },
  approuve: { label: 'Approuvé', color: colors.success, bg: colors.successBg },
  facture: { label: 'Facturé', color: colors.success, bg: colors.successBg },
  non_facture: { label: 'Non facturable', color: colors.textMuted, bg: colors.surfaceAlt },
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

/** Statuts de bon de travail proposés pour le changement (ordre du workflow). */
export const WORK_ORDER_STATUS_OPTIONS: WorkOrderStatus[] = [
  'en_attente',
  'assigne',
  'en_cours',
  'soumis',
  'en_revision',
  'approuve',
  'facture',
  'non_facture',
];

// Statuts réels de la table projects (enum backend, FR).
const PROJECT_LABELS: Record<string, StatusStyle> = {
  planification: { label: 'Planification', color: colors.info, bg: colors.infoBg },
  en_cours: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  pause: { label: 'En pause', color: colors.textMuted, bg: colors.surfaceAlt },
  terminé: { label: 'Terminé', color: colors.success, bg: colors.successBg },
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

// Statuts réels de la table project_tasks (enum backend, FR accentué).
const TASK_LABELS: Record<string, StatusStyle> = {
  à_faire: { label: 'À faire', color: colors.textMuted, bg: colors.surfaceAlt },
  en_cours: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  bloquée: { label: 'Bloquée', color: colors.danger, bg: colors.dangerBg },
  terminée: { label: 'Terminée', color: colors.success, bg: colors.successBg },
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

// Priorités réelles de project_tasks.
const TASK_PRIORITY_LABELS: Record<string, StatusStyle> = {
  basse: { label: 'Basse', color: colors.textMuted, bg: colors.surfaceAlt },
  normale: { label: 'Normale', color: colors.info, bg: colors.infoBg },
  haute: { label: 'Haute', color: colors.warning, bg: colors.warningBg },
  urgente: { label: 'Urgente', color: colors.danger, bg: colors.dangerBg },
};

export function taskPriorityStyle(priority: string): StatusStyle {
  return (
    TASK_PRIORITY_LABELS[priority] ?? {
      label: priority,
      color: colors.textMuted,
      bg: colors.surfaceAlt,
    }
  );
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
