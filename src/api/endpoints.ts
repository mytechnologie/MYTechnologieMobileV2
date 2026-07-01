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
  CreateTimesheetEntryInput,
  LoginInput,
  LoginResult,
  ProjectDetail,
  ProjectListItem,
  ProjectTask,
  RequestOtpInput,
  RequestOtpResult,
  ResendLoginOtpInput,
  ResendLoginOtpResult,
  SubmitTimesheetEntriesInput,
  TimesheetEntry,
  UpdateTimesheetEntryInput,
  VerifyLoginOtpInput,
  VerifyLoginOtpResult,
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
  list: async (): Promise<ClientListItem[]> =>
    unwrapItems<ClientListItem>(await trpc.clients.list.query()),
};

/* -------------------------------- projects --------------------------------- */

export const projects = {
  // projects.list renvoie déjà un tableau (colonnes + clientName + champs calculés).
  list: (): Promise<ProjectListItem[]> => trpc.projects.list.query(),
  getById: (id: string): Promise<ProjectDetail> =>
    trpc.projects.getById.query({ id: Number(id) }),
};

export const projectTasks = {
  // projectTasks.list attend { projectId: number } et renvoie un ARBRE de tâches.
  listByProject: (projectId: string): Promise<ProjectTask[]> =>
    trpc.projectTasks.list.query({ projectId: Number(projectId) }),
};

/* ------------------------------ work orders -------------------------------- */

export const workOrders = {
  // workOrders.list → { items, total }.
  list: async (): Promise<WorkOrderListItem[]> =>
    unwrapItems<WorkOrderListItem>(await trpc.workOrders.list.query()),
  getById: (id: string): Promise<WorkOrderDetail> =>
    trpc.workOrders.get.query({ id: Number(id) }),
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

  /**
   * Ajout de photo : route REST multipart (PAS tRPC/base64).
   * POST {API_BASE}/api/work-orders/:id/photos — champ fichier + `caption`.
   * Auth via les mêmes headers que tRPC (Cookie admin) ; ne PAS fixer
   * Content-Type (React Native pose le boundary multipart automatiquement).
   */
  uploadPhoto: async (
    id: string,
    file: { uri: string; name: string; type: string },
    caption = '',
  ): Promise<{ success: boolean; count: number }> => {
    const form = new FormData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    form.append('file', { uri: file.uri, name: file.name, type: file.type } as any);
    if (caption) form.append('caption', caption);

    const res = await fetch(`${API_BASE}/api/work-orders/${Number(id)}/photos`, {
      method: 'POST',
      headers: {
        'x-mobile-app': 'true',
        ...getAuthHeaders(),
      },
      body: form,
    });
    if (!res.ok) {
      let message = `Échec de l'envoi (${res.status}).`;
      try {
        const body = (await res.json()) as { error?: string };
        if (body?.error) message = body.error;
      } catch {
        /* réponse non-JSON */
      }
      throw new Error(message);
    }
    return (await res.json()) as { success: boolean; count: number };
  },
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
