/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * ⚠️ Les noms de procédures (ex. `projects.list`) sont basés sur la spec. Si le backend
 * expose un autre nom, ajuster ICI uniquement. Les types viennent de `types.ts`.
 */
import { trpc } from './client';
import { API_BASE } from './config';
import { getAuthHeaders } from '../auth/session';
import type {
  ChangeWorkOrderStatusInput,
  ClientListItem,
  CreateProjectReportInput,
  CreateTimesheetEntryInput,
  CreateWorkOrderInput,
  CreateWorkOrderResult,
  LoginInput,
  LoginResult,
  PlanAnnotation,
  ProjectAttachment,
  ProjectDetail,
  ProjectListItem,
  ProjectPlan,
  ProjectReportDetail,
  ProjectReportListItem,
  ProjectReportType,
  ProjectTask,
  ProjectTaskUpdateInput,
  RequestOtpInput,
  UpdateProjectReportInput,
  ScheduleInput,
  ScheduleItem,
  ServiceTypeItem,
  RequestOtpResult,
  ResendLoginOtpInput,
  ResendLoginOtpResult,
  SubmitTimesheetEntriesInput,
  TimesheetEntry,
  UpdateTimesheetEntryInput,
  VerifyLoginOtpInput,
  VerifyLoginOtpResult,
  UserListItem,
  VerifyOtpInput,
  VerifyOtpResult,
  WorkOrderDetail,
  WorkOrderListItem,
  WorkOrderPhotoUrls,
  WorkOrderUpdateInput,
} from './types';

/** clients.list et workOrders.list renvoient { items, total } → on déballe. */
function unwrapItems<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/** Fichier photo prêt pour un upload multipart (issu d'expo-image-picker). */
export interface PhotoFile {
  uri: string;
  name: string;
  type: string;
}
/** getPhotoUrls (BT ou tâche) → { [photoId]: urlSignée }. */
export type PhotoUrls = Record<number, string>;

async function authFetchJson(path: string, init: RequestInit): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'x-mobile-app': 'true', ...getAuthHeaders(), ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Échec (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* réponse non-JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

/**
 * Upload photo multipart (route REST commune BT + tâches projet). NE PAS fixer
 * Content-Type : React Native pose le boundary multipart automatiquement.
 */
export function uploadPhotoMultipart(
  path: string,
  file: PhotoFile,
  caption = '',
): Promise<{ success: boolean; count: number }> {
  const form = new FormData();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
  if (caption) form.append('caption', caption);
  return authFetchJson(path, { method: 'POST', body: form });
}

export function deletePhotoRest(path: string): Promise<{ success: boolean }> {
  return authFetchJson(path, { method: 'DELETE' });
}

/* ----------------------------- portalAuth (OTP) ---------------------------- */

export const portalAuth = {
  requestOtp: (input: RequestOtpInput): Promise<RequestOtpResult> =>
    trpc.portalAuth.requestOtp.mutate(input),
  verifyOtp: (input: VerifyOtpInput): Promise<VerifyOtpResult> =>
    trpc.portalAuth.verifyOtp.mutate(input),
};

/* ------------------------- auth (admin email/mdp + OTP) -------------------- */

export const auth = {
  login: (input: LoginInput): Promise<LoginResult> => trpc.auth.login.mutate(input),
  verifyLoginOtp: (input: VerifyLoginOtpInput): Promise<VerifyLoginOtpResult> =>
    trpc.auth.verifyLoginOtp.mutate(input),
  resendLoginOtp: (input: ResendLoginOtpInput): Promise<ResendLoginOtpResult> =>
    trpc.auth.resendLoginOtp.mutate(input),
};

/* --------------------------------- clients --------------------------------- */

export const clients = {
  // clients.list → { items, total }. Le nom du client n'étant pas dans work_orders,
  // on charge cette liste pour construire un map clientId→name (comme le web).
  // ⚠️ limit par défaut du backend tronque (>150 clients) : on demande 500 pour
  //    avoir TOUS les clients (map complet + sélecteur de création de BT).
  list: async (input?: { search?: string; limit?: number }): Promise<ClientListItem[]> =>
    unwrapItems<ClientListItem>(
      await trpc.clients.list.query({ limit: 500, ...(input ?? {}) }),
    ),
};

/* --------------------------------- users ----------------------------------- */

export const users = {
  // users.list → ligne users complète (+ clientIds). Requiert `users.view`
  // (rôles élevés) ; l'appelant doit dégrader proprement si l'API refuse.
  list: (): Promise<UserListItem[]> => trpc.users.list.query(),
};

/* ------------------------------ service types ------------------------------ */

export const serviceTypes = {
  // serviceTypes.listActive → types de service actifs (id + name).
  listActive: (): Promise<ServiceTypeItem[]> => trpc.serviceTypes.listActive.query(),
};

/* -------------------------------- projects --------------------------------- */

export const projects = {
  // projects.list renvoie déjà un tableau (colonnes + clientName + champs calculés).
  list: (): Promise<ProjectListItem[]> => trpc.projects.list.query(),
  getById: (id: string): Promise<ProjectDetail> =>
    trpc.projects.getById.query({ id: Number(id) }),

  /* ------------------------------- plans (project_plans) --------------------- */

  // getPlans → plans avec fileUrl R2 rafraîchie + annotations (tableau).
  getPlans: (projectId: string): Promise<ProjectPlan[]> =>
    trpc.projects.getPlans.query({ projectId: Number(projectId) }),

  // Remplace le tableau complet d'annotations (partagé avec le web — même JSON).
  updatePlanAnnotations: (input: {
    planId: number;
    projectId: string;
    annotations: PlanAnnotation[];
  }): Promise<{ success: boolean }> =>
    trpc.projects.updatePlanAnnotations.mutate({
      planId: input.planId,
      projectId: Number(input.projectId),
      annotations: input.annotations,
    }),
};

export const projectTasks = {
  // projectTasks.list attend { projectId: number } et renvoie un ARBRE de tâches.
  listByProject: (projectId: string): Promise<ProjectTask[]> =>
    trpc.projectTasks.list.query({ projectId: Number(projectId) }),

  // Coche/décoche un item de checklist.
  toggleChecklistItem: (input: {
    projectId: string;
    taskId: number;
    itemId: number;
    isCompleted: boolean;
  }): Promise<{ success: boolean }> =>
    trpc.projectTasks.toggleChecklistItem.mutate({
      projectId: Number(input.projectId),
      taskId: input.taskId,
      itemId: input.itemId,
      isCompleted: input.isCompleted,
    }),

  // Mise à jour d'une tâche (on utilise `details` comme notes terrain).
  update: (input: ProjectTaskUpdateInput): Promise<{ success: boolean }> =>
    trpc.projectTasks.update.mutate({
      id: input.taskId,
      projectId: Number(input.projectId),
      details: input.details,
      status: input.status,
    }),

  /* ------------------------ photos de tâche (comme BT) ------------------------ */

  // getPhotoUrls → { [photoId]: urlSignée }.
  getPhotoUrls: (taskId: number): Promise<PhotoUrls> =>
    trpc.projectTasks.getPhotoUrls.query({ taskId }),
  // Upload REST multipart : POST /api/project-tasks/:id/photos (mêmes headers que BT).
  uploadPhoto: (taskId: number, file: PhotoFile, caption = '') =>
    uploadPhotoMultipart(`/api/project-tasks/${taskId}/photos`, file, caption),
  // Suppression REST : DELETE /api/project-tasks/:id/photos/:photoId.
  deletePhoto: (taskId: number, photoId: number) =>
    deletePhotoRest(`/api/project-tasks/${taskId}/photos/${photoId}`),
};

/* ---------------------------- rapports de projet --------------------------- */
/**
 * Rapports de projet : travaux extra (à facturer), avancement, fin de projet,
 * déficiences. Fiche + photos + PDF (PDFShift → R2) + envoi au client.
 * Le PDF s'ouvre par la route REST `/api/project-reports/:id/pdf` (rendu inline).
 */
export const projectReports = {
  listByProject: (
    projectId: string,
    type?: ProjectReportType,
  ): Promise<ProjectReportListItem[]> =>
    trpc.projectReports.list.query({
      projectId: Number(projectId),
      ...(type ? { type } : {}),
    }),

  getById: (id: number): Promise<ProjectReportDetail> =>
    trpc.projectReports.getById.query({ id }),

  create: (
    input: CreateProjectReportInput,
  ): Promise<{ id: number; reportNumber: string; success: boolean }> =>
    trpc.projectReports.create.mutate({
      ...input,
      projectId: Number(input.projectId),
    }),

  update: (input: UpdateProjectReportInput): Promise<{ success: boolean }> =>
    trpc.projectReports.update.mutate(input),

  remove: (id: number): Promise<{ success: boolean }> =>
    trpc.projectReports.delete.mutate({ id }),

  /** Régénère le PDF et renvoie une URL R2 presigned (1 h). */
  generatePdf: (id: number): Promise<{ url: string }> =>
    trpc.projectReports.generatePdf.mutate({ id }),

  /** Envoie le PDF au client par courriel et passe le rapport à « envoyé ». */
  email: (id: number, to?: string): Promise<{ success: boolean; sentTo: string }> =>
    trpc.projectReports.emailReport.mutate({ id, ...(to ? { to } : {}) }),

  /* ---------------------------- photos (comme BT) --------------------------- */

  getPhotoUrls: (id: number): Promise<PhotoUrls> =>
    trpc.projectReports.getPhotoUrls.query({ id }),
  uploadPhoto: (id: number, file: PhotoFile, caption = '') =>
    uploadPhotoMultipart(`/api/project-reports/${id}/photos`, file, caption),
  deletePhoto: (id: number, photoId: number) =>
    deletePhotoRest(`/api/project-reports/${id}/photos/${photoId}`),
};

/* --------------------------- project attachments --------------------------- */
/**
 * Pièces jointes de projet = plans/documents (R2). `list` renvoie chaque
 * fichier avec une `fileUrl` presigned fraîche (1h) → affichage direct des plans
 * (images inline, PDF via lien). fileType ∈ image/*, application/pdf, …
 */
export const projectAttachments = {
  list: (projectId: string): Promise<ProjectAttachment[]> =>
    trpc.projectAttachments.list.query({ projectId: Number(projectId) }),
};

/* -------------------------------- schedule --------------------------------- */
/**
 * « Cédule » = calendar_schedules (blocs d'horaire de travail par utilisateur),
 * PAS des rendez-vous client. Champs réels : userId, workDate (YYYY-MM-DD),
 * startTime/endTime (HH:MM), title, notes, color, status.
 * Un non-admin ne peut créer/modifier que ses propres blocs (backend enforce).
 */
export const schedule = {
  list: (input?: {
    startDate?: string;
    endDate?: string;
    userId?: number;
  }): Promise<ScheduleItem[]> => trpc.calendar.list.query(input ?? {}),

  create: (input: ScheduleInput): Promise<{ id: number }> =>
    trpc.calendar.create.mutate(input),

  // ⚠️ update backend attend { id, data: Partial<...> }.
  update: (id: number, data: Partial<ScheduleInput>): Promise<{ success: boolean }> =>
    trpc.calendar.update.mutate({ id, data }),

  remove: (id: number): Promise<{ success: boolean }> =>
    trpc.calendar.delete.mutate({ id }),
};

/* ------------------------------ work orders -------------------------------- */

export const workOrders = {
  // workOrders.list → { items, total }.
  list: async (): Promise<WorkOrderListItem[]> =>
    unwrapItems<WorkOrderListItem>(await trpc.workOrders.list.query()),
  getById: (id: string): Promise<WorkOrderDetail> =>
    trpc.workOrders.get.query({ id: Number(id) }),
  // Création (techOrAdmin + permission work_orders.create). ticketNumber généré
  // côté backend ; technicianId omis → le créateur est assigné. Renvoie le BT créé.
  create: (input: CreateWorkOrderInput): Promise<CreateWorkOrderResult> =>
    trpc.workOrders.create.mutate(input),
  // Le backend attend id: number et renvoie { success: true }.
  changeStatus: (input: ChangeWorkOrderStatusInput): Promise<{ success: boolean }> =>
    trpc.workOrders.changeStatus.mutate({ id: Number(input.id), status: input.status }),
  // Mise à jour terrain. Voir WorkOrderUpdateInput : le backend filtre selon le rôle.
  update: ({ id, ...fields }: WorkOrderUpdateInput): Promise<{ success: boolean }> =>
    trpc.workOrders.update.mutate({ id: Number(id), ...fields }),

  /* ------------------------------- photos -------------------------------- */

  // getPhotoUrls → { [photoId]: urlSignée }.
  getPhotoUrls: (id: string): Promise<WorkOrderPhotoUrls> =>
    trpc.workOrders.getPhotoUrls.query({ workOrderId: Number(id) }),
  deletePhoto: (photoId: number): Promise<{ success: boolean }> =>
    trpc.workOrders.deletePhoto.mutate({ photoId }),

  // Ajout de photo : route REST multipart POST /api/work-orders/:id/photos
  // (helper partagé avec les photos de tâche projet).
  uploadPhoto: (id: string, file: PhotoFile, caption = '') =>
    uploadPhotoMultipart(`/api/work-orders/${Number(id)}/photos`, file, caption),
};

/* -------------------------------- timesheet -------------------------------- */

export const timesheet = {
  myEntries: (): Promise<TimesheetEntry[]> => trpc.timesheet.myEntries.query(),
  createEntry: (input: CreateTimesheetEntryInput): Promise<TimesheetEntry> =>
    trpc.timesheet.createEntry.mutate(input),
  updateEntry: (input: UpdateTimesheetEntryInput): Promise<TimesheetEntry> =>
    trpc.timesheet.updateEntry.mutate(input),
  submitEntries: (input: SubmitTimesheetEntriesInput): Promise<{ success: boolean }> =>
    trpc.timesheet.submitEntries.mutate(input),
};
