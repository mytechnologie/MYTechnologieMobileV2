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
  /** Expiration absolue (epoch ms) : 30 jours après la connexion. */
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

export type PhaseStatus = 'a_venir' | 'en_cours' | 'terminee';

export interface ProjectPhase {
  id: string;
  name: string;
  status: PhaseStatus;
  /** Heures réelles / budget de la phase, en % (null sans budget). */
  hoursPct: number | null;
  /** Sous-phases (un seul niveau, comme au portail). */
  children: ProjectPhase[];
}

export type DeviceStatus = 'prevu' | 'installe' | 'configure' | 'verifie';

export interface ProjectDevice {
  id: string;
  name: string;
  deviceType: string;
  zone: string | null;
  location: string | null;
  manufacturer: string | null;
  model: string | null;
  serialNumber: string | null;
  macAddress: string | null;
  ipAddress: string | null;
  switchName: string | null;
  switchPort: string | null;
  firmware: string | null;
  status: DeviceStatus;
  installedByName: string | null;
  notes: string | null;
}

export interface FieldDeviceInput {
  id: string;
  status?: DeviceStatus;
  serialNumber?: string;
  macAddress?: string;
  ipAddress?: string;
  switchName?: string;
  switchPort?: string;
  firmware?: string;
  notes?: string | null;
}

export interface ProjectDetail extends ProjectListItem {
  code: string | null;
  title: string;
  description?: string | null;
  phases: ProjectPhase[];
  devices: ProjectDevice[];
  budgetAmount?: number | null;
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
  /** Champs de contenu du bon, en texte simple (HTML au portail). */
  content: WorkOrderContent;
  /** Tests effectués (bon d'installation seulement). */
  tests: InstallTest[];
}

/** Mêmes champs que le formulaire du bon sur le portail (WorkOrderEdit). */
export interface WorkOrderContent {
  /** Appel de service. */
  problemDescription: string;
  actionsTaken: string;
  /** Bon d'installation. */
  installRequest: string;
  installDescription: string;
  /** Matériaux / pièces utilisés (interne). */
  materialsInternal: string;
  /** Admin seulement. */
  followUp: string;
  /** Admin seulement ; texte simple, imprimé sur le PDF client. */
  clientNote: string;
}

export interface InstallTest {
  label: string;
  checked: boolean;
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

/* -------------------------------------------------------------------------- */
/* Repris de la branche iPad : création de bon, sélecteurs, Cédule            */
/* -------------------------------------------------------------------------- */

export type ApiDate = string | Date | null;


/** Le nom du client N'EST PAS dans work_orders : on résout via clients.list. */
export interface ClientListItem {
  id: number;
  name: string;
  city?: string | null;
  address?: string | null;
}


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


/** Ligne `service_types` active. `serviceType` du BT stocke le `name` (string). */
export interface ServiceTypeItem {
  id: number;
  name: string;
  isActive?: boolean;
}


/** Ligne brute work_orders, telle que le formulaire de création la manipule. */
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


/**
 * Création d'un bon de travail (workOrders.create).
 * `clientId` requis ; `ticketNumber` est généré automatiquement côté backend.
 * `technicianId` omis → le backend assigne le créateur.
 */
export interface CreateWorkOrderInput {
  /** Défaut portail : 'bon_travail'. */
  docType?: 'bon_travail' | 'bon_installation';
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
  installRequest?: string | null;
  installDescription?: string | null;
}

/** Réponse de workOrders.create. */
export interface CreateWorkOrderResult {
  success: boolean;
  workOrder?: WorkOrder | null;
}


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
  allDay?: boolean | null;
  location?: string | null;
  /** Alertes : minutes avant le début (null = aucune). */
  reminderMinutes?: number | null;
  reminder2Minutes?: number | null;
  projectId?: number | null;
  workOrderId?: number | null;
  /** calendar.agenda : modifiable par l'utilisateur connecté. */
  canEdit?: boolean;
  createdAt?: ApiDate;
  updatedAt?: ApiDate;
}

/** Entrée de création/màj d'un bloc d'horaire. userId requis à la création. */

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
  allDay?: boolean;
  location?: string | null;
  reminderMinutes?: number | null;
  reminder2Minutes?: number | null;
}

/** Une ligne de la Cédule : rendez-vous (calendar_schedules) ou bon assigné. */
export interface AgendaEntry {
  /** Unique dans la liste : 'e12' (rendez-vous) ou 'w34' (bon). */
  key: string;
  kind: 'event' | 'work_order';
  /** id du rendez-vous, ou du bon pour kind 'work_order'. */
  id: number;
  userId: number;
  userName: string | null;
  /** YYYY-MM-DD, date locale. */
  date: string;
  /** HH:MM. */
  start: string;
  end: string;
  allDay: boolean;
  title: string;
  location: string | null;
  notes: string | null;
  color: string | null;
  reminderMinutes: number | null;
  reminder2Minutes: number | null;
  canEdit: boolean;
}

export interface CalendarPerson {
  id: number;
  name: string;
}
