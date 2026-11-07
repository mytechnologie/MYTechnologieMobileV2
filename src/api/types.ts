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
  /** Mode de connexion d'origine. */
  mode: 'employee' | 'admin';
  /** Expiration absolue (epoch ms). Portail = 8h. */
  expiresAt: number;
}

/* -------------------------------------------------------------------------- */
/* portalAuth (OTP employé)                                                   */
/* -------------------------------------------------------------------------- */

export interface RequestOtpInput {
  /** Téléphone au format E.164, ex. +15145551234. */
  phone: string;
}
export interface RequestOtpResult {
  success: boolean;
  /** false si Twilio n'a pas pu envoyer le SMS (le code existe quand même). */
  smsSent?: boolean;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}

/** Réponse brute de portalAuth.verifyOtp (server/routers/portalAuth.ts). */
export interface VerifyOtpResponse {
  /** Token de session portail → header x-portal-session. */
  sessionToken: string;
  /** Expiration absolue (Date via superjson). 8 h côté portail. */
  expiresAt: Date | string;
  user: {
    id: number;
    name: string | null;
    role: string;
    departmentId?: number | null;
    department?: { id: number; name: string } | null;
  };
}

/** Résultat normalisé utilisé par l'app. */
export interface VerifyOtpResult {
  session: string;
  user: AuthUser;
  /** Expiration absolue (epoch ms). */
  expiresAt: number;
}

/* -------------------------------------------------------------------------- */
/* adminAuth (email + mot de passe)                                           */
/* -------------------------------------------------------------------------- */

export interface AdminLoginInput {
  email: string;
  password: string;
}
export interface AdminLoginResult {
  /** Token / JWT de session admin. */
  token: string;
  user: AuthUser;
  expiresInSeconds?: number;
}

/* -------------------------------------------------------------------------- */
/* Projets                                                                    */
/* -------------------------------------------------------------------------- */

export type ProjectStatus =
  | 'planning'
  | 'active'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
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

export type WorkOrderStatus =
  | 'pending'
  | 'scheduled'
  | 'in_progress'
  | 'on_hold'
  | 'completed'
  | 'cancelled'
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
  description?: string | null;
  equipment?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  photos?: WorkOrderPhoto[];
}

export interface ChangeWorkOrderStatusInput {
  id: string;
  status: WorkOrderStatus;
  note?: string;
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
