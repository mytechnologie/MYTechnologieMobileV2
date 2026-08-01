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
  otpCode: string;
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
/* Utilisateurs (users.list — assignation technicien)                         */
/* -------------------------------------------------------------------------- */

/**
 * users.list renvoie la ligne `users` complète (+ clientIds). On ne type que ce
 * dont l'app a besoin pour l'assignation d'un bon de travail.
 * ⚠️ Requiert la permission `users.view` (rôles élevés) — dégrader si refusé.
 */
export interface UserListItem {
  id: number;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  isActive?: boolean;
  phone?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Types de service (serviceTypes.listActive)                                 */
/* -------------------------------------------------------------------------- */

/** Ligne `service_types` active. `serviceType` du BT stocke le `name` (string). */
export interface ServiceTypeItem {
  id: number;
  name: string;
  isActive?: boolean;
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

/* --------------------------- Rapports de projet ---------------------------- */

/** Types de rapport de projet (enum backend `project_reports.type`). */
export type ProjectReportType =
  | 'travaux_extra'
  | 'avancement'
  | 'fin_projet'
  | 'deficience';

/** Statuts de rapport de projet (enum backend `project_reports.status`). */
export type ProjectReportStatus = 'draft' | 'sent' | 'completed' | (string & {});

/** Colonnes brutes de `project_reports`. Les `decimal` arrivent en string. */
export interface ProjectReport {
  id: number;
  projectId: number;
  reportNumber: string;
  type: ProjectReportType;
  title: string;
  description?: string | null;
  status: ProjectReportStatus;
  createdById: number;
  technicianId?: number | null;
  hoursWorked?: string | number | null;
  materials?: string | null;
  billingAmount?: string | number | null;
  pdfKey?: string | null;
  pdfUrl?: string | null;
  sentAt?: ApiDate;
  completedAt?: ApiDate;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
}

/** projectReports.list : rapport + noms résolus + nombre de photos. */
export interface ProjectReportListItem extends ProjectReport {
  technicianName?: string | null;
  createdByName?: string | null;
  photoCount: number;
}

/** Photo de rapport avec URL presigned (null si illisible). */
export interface ProjectReportPhoto {
  id: number;
  reportId: number;
  fileName?: string | null;
  caption?: string | null;
  url?: string | null;
}

/** projectReports.getById : fiche complète. */
export interface ProjectReportDetail {
  report: ProjectReport;
  projectName?: string | null;
  projectLocation?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  technicianName?: string | null;
  createdByName?: string | null;
  photos: ProjectReportPhoto[];
}

export interface CreateProjectReportInput {
  projectId: string;
  type: ProjectReportType;
  title: string;
  description?: string;
  technicianId?: number | null;
  hoursWorked?: number | null;
  materials?: string;
  billingAmount?: number | null;
}

export interface UpdateProjectReportInput {
  id: number;
  title?: string;
  description?: string | null;
  status?: ProjectReportStatus;
  technicianId?: number | null;
  hoursWorked?: number | null;
  materials?: string | null;
  billingAmount?: number | null;
}

/**
 * Pièce jointe / plan de projet (project_attachments). `fileUrl` est une URL
 * presigned fraîche renvoyée par le backend. `fileType` = mime (image/*, pdf…).
 */
export interface ProjectAttachment {
  id: number;
  projectId: number;
  fileName: string;
  fileType: string;
  fileUrl: string;
  category?: string | null;
  description?: string | null;
  fileSizeBytes?: number | null;
}

/**
 * Marqueur d'annotation sur un plan de chantier. Format IDENTIQUE au web
 * (client ProjectDetail.tsx) pour compatibilité web ↔ iPad :
 * - `x`/`y` en POURCENTAGE 0..100 (1 décimale) du plan, pour rester corrects
 *   quel que soit le zoom/la résolution.
 * - `icon` = la clé de type ; `color` = tint du type ; `status` d'équipement
 *   (planned|in_progress|installed|compliant|issue) ou de note (info|warning|urgent).
 */
export interface PlanAnnotation {
  id: string;
  x: number;
  y: number;
  type: string;
  label: string;
  color?: string;
  icon?: string;
  status?: string;
  linkedTaskId?: number | null;
  statusChangedAt?: string | null;
  statusChangedBy?: number | null;
  issueNotes?: string | null;
  completedAt?: string | null;
}

/** Plan de chantier (project_plans) : image ou PDF (R2) + annotations. */
export interface ProjectPlan {
  id: number;
  projectId: number;
  name: string;
  description?: string | null;
  fileUrl: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  version?: number;
  annotations: PlanAnnotation[];
  order?: number;
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
 * Champs éditables d'un bon de travail (workOrders.update).
 * ⚠️ Réalité backend :
 * - admin/manager : TOUS les champs ci-dessous sont persistés ;
 * - `technician` : SEULS problemDescription, actionsTaken et materialsInternal
 *   sont persistés (et si status ∈ {en_attente, assigne, en_cours} + fenêtre
 *   7 jours). Les autres champs sont ignorés côté backend pour ce rôle.
 */
export interface WorkOrderUpdateInput {
  /** Id (string côté écran) → converti en number vers le backend. */
  id: string;
  /** Réservés aux rôles élevés (admin/manager). */
  clientId?: number;
  technicianId?: number | null;
  serviceType?: string | null;
  location?: string | null;
  /** superjson restitue les Date côté backend (colonne `date`). */
  serviceDate?: Date | null;
  durationMinutes?: number | null;
  problemDescription?: string | null;
  actionsTaken?: string | null;
  materialsInternal?: string | null;
  followUp?: string | null;
}

/**
 * Création d'un bon de travail (workOrders.create).
 * `clientId` requis ; `ticketNumber` est généré automatiquement côté backend.
 * `technicianId` omis → le backend assigne le créateur.
 */
export interface CreateWorkOrderInput {
  clientId: number;
  technicianId?: number | null;
  serviceType?: string | null;
  location?: string | null;
  serviceDate?: Date | null;
  durationMinutes?: number | null;
  problemDescription?: string | null;
  actionsTaken?: string | null;
  followUp?: string | null;
  materialsInternal?: string | null;
}

/** Réponse de workOrders.create. */
export interface CreateWorkOrderResult {
  success: boolean;
  workOrder?: WorkOrder | null;
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
