/**
 * Types déclarés localement d'après les endpoints du backend (pas d'import du backend).
 *
 * ⚠️ Les formes exactes des entrées/sorties sont des hypothèses raisonnables basées
 * sur la spec. Si un champ diffère côté backend, ajuster ICI uniquement — le reste de
 * l'app passe par ces types. Les wrappers d'appel sont dans `endpoints.ts`.
 */

/* -------------------------------------------------------------------------- */
/* Auth & rôles                                                               */
/* -------------------------------------------------------------------------- */

/** Rôles renvoyés par l'API. On NE hardcode PAS `role === 'admin'` ailleurs. */
export type UserRole =
  | 'employee'
  | 'technician'
  | 'admin'
  | 'manager'
  | 'super_admin'
  | (string & {}); // tolère d'autres rôles renvoyés par l'API

/** Comment authentifier les requêtes : nom du header + valeur du token. */
export interface SessionAuth {
  /** Header HTTP à envoyer (ex. 'x-portal-session' ou 'authorization'). */
  headerName: string;
  /** Valeur du header (ex. token brut ou 'Bearer <jwt>'). */
  headerValue: string;
}

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
  /** Permissions explicites si l'API en renvoie (prioritaires sur le rôle). */
  permissions?: string[] | null;
}

/** Session persistée (secure-store) + en mémoire. */
export interface Session {
  user: AuthUser;
  auth: SessionAuth;
  /** Session par jeton (auth.login + code SMS), la seule depuis la phase 0. */
  mode: 'token';
  /** Expiration absolue (epoch ms). Portail = 8h. */
  expiresAt: number;
}

/* -------------------------------------------------------------------------- */
/* auth (connexion unique : courriel + mot de passe + code SMS)               */
/* -------------------------------------------------------------------------- */

export interface LoginInput {
  email: string;
  password: string;
}

/** Réponse de auth.login (server/routers.ts, authRouter). */
export type LoginResponse =
  | {
      success: true;
      otpRequired: true;
      challengeId: string;
      expiresAt: string;
      resendAvailableAt: string;
      user: { id: number; email: string | null; role: string };
    }
  | {
      success: true;
      otpRequired?: undefined;
      token: string;
      mustChangePassword: boolean;
      user: { id: number; name: string | null; email: string | null; role: string };
    };

export interface VerifyLoginOtpInput {
  challengeId: string;
  otpCode: string;
}

/** Réponse de auth.verifyLoginOtp. */
export interface VerifyLoginOtpResponse {
  success: true;
  token: string;
  mustChangePassword: boolean;
  user: { id: number; name: string | null; email: string | null; role: string };
}

/** Réponse de auth.me (null sans session valide). */
export interface MeResponse {
  id: number;
  name: string | null;
  email: string | null;
  phone?: string | null;
  role: string;
  permissions: string[];
}

/* -------------------------------------------------------------------------- */
/* Projets                                                                    */
/* -------------------------------------------------------------------------- */

/** shared/projets.ts PROJECT_STATUS_VALUES. */
export type ProjectStatus =
  | 'preparation'
  | 'en_cours'
  | 'en_pause'
  | 'reception'
  | 'termine'
  | 'annule'
  | (string & {});

export interface ProjectListItem {
  id: string;
  name: string;
  client?: string | null;
  status: ProjectStatus;
  /** Avancement 0–100. */
  progress?: number | null;
  budgetHours?: number | null;
  spentHours?: number | null;
}

export interface ProjectPhase {
  id: string;
  name: string;
  status?: string | null;
  progress?: number | null;
}

export interface ProjectDetail extends ProjectListItem {
  description?: string | null;
  phases?: ProjectPhase[];
  budgetAmount?: number | null;
  spentAmount?: number | null;
  startDate?: string | null;
  endDate?: string | null;
}

export type ProjectTaskStatus =
  | 'todo'
  | 'in_progress'
  | 'blocked'
  | 'done'
  | (string & {});

export interface ProjectTask {
  id: string;
  projectId: string;
  name: string;
  status: ProjectTaskStatus;
  phaseId?: string | null;
  phaseName?: string | null;
  estimatedHours?: number | null;
  loggedHours?: number | null;
  assignee?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Bons de travail                                                            */
/* -------------------------------------------------------------------------- */

/** shared/workOrderStatus.ts WORK_ORDER_STATUSES. */
export type WorkOrderStatus =
  | 'nouveau'
  | 'a_rappeler'
  | 'planifie'
  | 'en_route'
  | 'en_cours'
  | 'complete'
  | 'en_revision'
  | 'a_facturer'
  | 'facture'
  | 'non_facture'
  | (string & {});

export interface WorkOrderPhoto {
  id: string;
  url: string;
  caption?: string | null;
  createdAt?: string | null;
}

export interface WorkOrderListItem {
  id: string;
  number: string;
  title: string;
  client?: string | null;
  status: WorkOrderStatus;
  scheduledDate?: string | null;
  address?: string | null;
}

export interface WorkOrderDetail extends WorkOrderListItem {
  /** Problème signalé, en texte simple. */
  description?: string | null;
  clientId: string;
  /** 'appel_service' | 'bon_installation' … (shared/ du portail). */
  docType: string | null;
  /** Notes de travail du technicien, en texte simple. */
  workNotes: string;
}

export interface ChangeWorkOrderStatusInput {
  id: string;
  status: WorkOrderStatus;
}

/* -------------------------------------------------------------------------- */
/* Saisie d'heures (timesheet)                                                */
/* -------------------------------------------------------------------------- */

export type TimesheetStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | (string & {});

/** Ligne brute de timesheet.myEntries (table time_entries). */
export interface TimeEntryRow {
  id: number;
  entryDate: Date | string;
  mode: 'hours' | 'range';
  startTime: string | null;
  endTime: string | null;
  breakMinutes: number | null;
  hoursWorked: number | null;
  computedHours: number;
  linkType: 'project' | 'investigation' | null;
  projectId: number | null;
  projectPhaseId: number | null;
  investigationId: number | null;
  notes: string | null;
  status: TimesheetStatus;
  rejectedReason?: string | null;
}

/** Projet ouvert + phases saisissables (timesheet.projectOptions). */
export interface ProjectOption {
  id: number;
  code: string | null;
  name: string;
  clientName: string | null;
  phases: { id: number; name: string; status: string }[];
}

/** Dossier d'enquête (timesheet.investigationOptions). */
export interface InvestigationOption {
  id: number;
  ticketNumber: string | null;
  clientName: string | null;
}

/** Rattachement d'une saisie : rien, un projet (+ phase) ou une enquête. */
export type TimesheetLink =
  | { linkType: null }
  | { linkType: 'project'; projectId: number; projectPhaseId: number | null }
  | { linkType: 'investigation'; investigationId: number };

/** Saisie d'heures normalisée pour l'affichage. */
export interface TimesheetEntry {
  id: string;
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  link: TimesheetLink;
  /** Libellé lisible du rattachement (projet › phase, ou enquête). */
  linkLabel: string | null;
  /** Heure de début 'HH:mm'. */
  startTime: string;
  /** Heure de fin 'HH:mm'. */
  endTime: string;
  /** Pause en minutes. */
  breakMinutes: number;
  /** Total calculé par le serveur, en heures décimales. */
  totalHours: number;
  notes?: string | null;
  status: TimesheetStatus;
  rejectedReason?: string | null;
}

export interface CreateTimesheetEntryInput {
  date: string;
  link: TimesheetLink;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  notes?: string | null;
}

export interface UpdateTimesheetEntryInput extends CreateTimesheetEntryInput {
  id: string;
}

export interface SubmitTimesheetEntriesInput {
  /** Ids des entrées brouillon à soumettre. */
  ids: string[];
}
