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
  /** Header HTTP à envoyer (employé : 'x-portal-session' ; admin : 'Cookie'). */
  headerName: string;
  /** Valeur (employé : token brut ; admin : '<COOKIE_NAME>=<jwt>'). */
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
  /** Certaines impls renvoient un délai d'expiration du code. */
  expiresInSeconds?: number;
}

export interface VerifyOtpInput {
  phone: string;
  code: string;
}
/** Réponse brute attendue de verifyOtp. */
export interface VerifyOtpResult {
  /** Token de session portail → header x-portal-session. */
  session: string;
  user: AuthUser;
  /** Durée de vie en secondes (8h par défaut côté portail). */
  expiresInSeconds?: number;
}

/* -------------------------------------------------------------------------- */
/* auth (admin — email + mot de passe, OTP conditionnel)                      */
/* -------------------------------------------------------------------------- */

export interface LoginInput {
  email: string;
  password: string;
}

/** Connexion directe (pas d'OTP requis) : token JWT renvoyé. */
export interface LoginDirectResult {
  success: boolean;
  otpRequired?: false;
  /** Token JWT de session (à renvoyer en cookie COOKIE_NAME). */
  token: string;
  user: AuthUser;
  expiresInSeconds?: number;
}

/** Connexion nécessitant une 2e étape OTP SMS. */
export interface LoginOtpRequiredResult {
  success: boolean;
  otpRequired: true;
  challengeId: string;
  /** Expiration du challenge (ISO ou epoch ms selon le backend). */
  expiresAt?: string | number;
  /** Moment à partir duquel un renvoi est possible. */
  resendAvailableAt?: string | number;
  user?: AuthUser;
}

export type LoginResult = LoginDirectResult | LoginOtpRequiredResult;

export interface VerifyLoginOtpInput {
  challengeId: string;
  code: string;
}
export interface VerifyLoginOtpResult {
  token: string;
  user: AuthUser;
  expiresInSeconds?: number;
}

export interface ResendLoginOtpInput {
  challengeId: string;
}
export interface ResendLoginOtpResult {
  success: boolean;
  resendAvailableAt?: string | number;
  expiresAt?: string | number;
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

export interface TimesheetEntry {
  id: string;
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  projectId?: string | null;
  projectName?: string | null;
  workOrderId?: string | null;
  workOrderNumber?: string | null;
  /** Heure de début 'HH:mm'. */
  startTime: string;
  /** Heure de fin 'HH:mm'. */
  endTime: string;
  /** Pause en minutes. */
  breakMinutes: number;
  /** Total calculé en heures décimales. */
  totalHours: number;
  notes?: string | null;
  status: TimesheetStatus;
}

export interface CreateTimesheetEntryInput {
  date: string;
  projectId?: string | null;
  workOrderId?: string | null;
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
