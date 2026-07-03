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

/**
 * Le transformer superjson (déjà branché sur le client) restitue les `timestamp`
 * SQL en objets `Date` et les colonnes `date` (YYYY-MM-DD) en `Date` également.
 * On tolère string | Date partout où le backend renvoie une date.
 */
export type ApiDate = string | Date | null;

/* -------------------------------------------------------------------------- */
/* Clients (clients.list → { items, total })                                  */
/* -------------------------------------------------------------------------- */

/** Le nom du client N'EST PAS dans work_orders : on résout via clients.list. */
export interface ClientListItem {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Projets (table `projects`)                                                 */
/* -------------------------------------------------------------------------- */

/** Statuts réels de la table projects. */
export type ProjectStatus =
  | 'planification'
  | 'en_cours'
  | 'pause'
  | 'terminé'
  | (string & {});

/** Colonnes brutes communes de `projects`. */
interface ProjectBase {
  id: number;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  clientId: number;
  /** Ajouté par le backend (map clientId→name). */
  clientName?: string | null;
  location?: string | null;
  startDate?: ApiDate;
  endDate?: ApiDate;
  /** `decimal` → renvoyé en string par le backend. */
  budget?: string | number | null;
  budgetHours?: string | number | null;
  budgetLaborCost?: string | number | null;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
}

/**
 * projects.list : colonnes projects + clientName + champs calculés préfixés `_`.
 */
export interface ProjectListItem extends ProjectBase {
  /** Avancement 0–100 (calculé côté backend depuis les tâches). */
  _progress?: number;
  _taskCount?: number;
  _doneCount?: number;
  _phaseCount?: number;
  /** Heures : budget et cumul (nombres, déjà convertis côté backend). */
  _budgetHours?: number | null;
  _hoursLogged?: number;
  _hoursPct?: number | null;
}

/** projects.getById : colonnes projects + clientName (SANS les champs calculés). */
export type ProjectDetail = ProjectBase;

/* -------------------------------- Tâches ----------------------------------- */

export type ProjectTaskStatus =
  | 'à_faire'
  | 'en_cours'
  | 'bloquée'
  | 'terminée'
  | (string & {});

export type ProjectTaskPriority =
  | 'basse'
  | 'normale'
  | 'haute'
  | 'urgente'
  | (string & {});

export interface ProjectTaskChecklistItem {
  id: number;
  taskId: number;
  label: string;
  isCompleted: boolean;
  order: number;
}

/**
 * projectTasks.list renvoie un ARBRE : chaque nœud = ligne project_tasks
 * + children (sous-tâches) + checklistItems + comments.
 */
export interface ProjectTask {
  id: number;
  projectId: number;
  parentTaskId?: number | null;
  phaseId?: number | null;
  spaceLabel?: string | null;
  title: string;
  description?: string | null;
  details?: string | null;
  status: ProjectTaskStatus;
  priority: ProjectTaskPriority;
  /** Avancement 0–100. */
  progress: number;
  order: number;
  children: ProjectTask[];
  checklistItems?: ProjectTaskChecklistItem[];
  comments?: unknown[];
}

/** Mise à jour d'une tâche (on réutilise `details` comme notes terrain). */
export interface ProjectTaskUpdateInput {
  /** Id de la tâche. */
  taskId: number;
  /** Id du projet (string côté écran) → converti en number. */
  projectId: string;
  details?: string | null;
  status?: ProjectTaskStatus;
}

/* -------------------------------------------------------------------------- */
/* Bons de travail (table `work_orders`)                                      */
/* -------------------------------------------------------------------------- */

/** Statuts réels de la table work_orders. */
export type WorkOrderStatus =
  | 'en_attente'
  | 'assigne'
  | 'en_cours'
  | 'soumis'
  | 'en_revision'
  | 'approuve'
  | 'facture'
  | 'non_facture'
  | (string & {});

/**
 * work_orders : la liste ({ items, total }) et le détail (get) renvoient tous
 * deux la LIGNE COMPLÈTE. Une seule forme suffit donc pour les deux.
 */
export interface WorkOrder {
  id: number;
  ticketNumber: string;
  clientId: number;
  technicianId?: number | null;
  status: WorkOrderStatus;
  /** Le "titre" métier du bon. */
  serviceType?: string | null;
  /** L'"adresse" du service. */
  location?: string | null;
  serviceDate?: ApiDate;
  durationMinutes?: number | null;
  problemDescription?: string | null;
  actionsTaken?: string | null;
  followUp?: string | null;
  materialsInternal?: string | null;
  clientNote?: string | null;
  dispatchedAt?: ApiDate;
  approvedAt?: ApiDate;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
}

export type WorkOrderListItem = WorkOrder;
export type WorkOrderDetail = WorkOrder;

export interface ChangeWorkOrderStatusInput {
  /** Id (string côté écran) → converti en number vers le backend. */
  id: string;
  status: WorkOrderStatus;
}

/**
 * Champs éditables terrain d'un bon de travail (workOrders.update).
 * ⚠️ Réalité backend : pour le rôle `technician`, SEULS problemDescription,
 * actionsTaken et materialsInternal sont persistés (et si status ∈
 * {en_attente, assigne, en_cours} + fenêtre 7 jours). durationMinutes et
 * followUp ne sont enregistrés que pour admin/manager.
 */
export interface WorkOrderUpdateInput {
  /** Id (string côté écran) → converti en number vers le backend. */
  id: string;
  durationMinutes?: number | null;
  problemDescription?: string | null;
  actionsTaken?: string | null;
  materialsInternal?: string | null;
  followUp?: string | null;
}

/** getPhotoUrls → { [photoId]: urlSignée }. */
export type WorkOrderPhotoUrls = Record<number, string>;

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

/* -------------------------------------------------------------------------- */
/* Cédule (calendar_schedules — blocs d'horaire de travail par utilisateur)   */
/* -------------------------------------------------------------------------- */

/**
 * ⚠️ Réalité backend : `calendar.*` gère des blocs d'HORAIRE de travail
 * (calendar_schedules), pas des rendez-vous client. Il n'y a ni type, ni
 * clientId, ni location — seulement un titre, une date, une plage horaire,
 * des notes et une couleur, rattachés à un utilisateur.
 */
export interface ScheduleItem {
  id: number;
  userId: number;
  /** Nom de l'utilisateur (jointure backend). */
  userName?: string | null;
  /** YYYY-MM-DD. */
  workDate: string;
  /** HH:MM. */
  startTime: string;
  /** HH:MM. */
  endTime: string;
  title: string;
  notes?: string | null;
  color?: string | null;
  status?: string | null;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
}

/** Entrée de création/màj d'un bloc d'horaire. userId requis à la création. */
export interface ScheduleInput {
  userId: number;
  /** YYYY-MM-DD. */
  workDate: string;
  /** HH:MM. */
  startTime: string;
  /** HH:MM. */
  endTime: string;
  title: string;
  notes?: string | null;
  color?: string | null;
  status?: string;
}
