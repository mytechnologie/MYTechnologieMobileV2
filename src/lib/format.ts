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

const WORK_ORDER_LABELS: Record<string, StatusStyle> = {
  pending: { label: 'En attente', color: colors.textMuted, bg: colors.surfaceAlt },
  scheduled: { label: 'Planifié', color: colors.info, bg: colors.infoBg },
  in_progress: { label: 'En cours', color: colors.warning, bg: colors.warningBg },
  on_hold: { label: 'En pause', color: colors.warning, bg: colors.warningBg },
  completed: { label: 'Terminé', color: colors.success, bg: colors.successBg },
  cancelled: { label: 'Annulé', color: colors.danger, bg: colors.dangerBg },
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
export const WORK_ORDER_STATUS_OPTIONS: WorkOrderStatus[] = [
  'pending',
  'scheduled',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
];

const PROJECT_LABELS: Record<string, StatusStyle> = {
  planning: { label: 'Planification', color: colors.info, bg: colors.infoBg },
  active: { label: 'Actif', color: colors.success, bg: colors.successBg },
  on_hold: { label: 'En pause', color: colors.warning, bg: colors.warningBg },
  completed: { label: 'Terminé', color: colors.textMuted, bg: colors.surfaceAlt },
  cancelled: { label: 'Annulé', color: colors.danger, bg: colors.dangerBg },
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
