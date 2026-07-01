/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * ⚠️ Les noms de procédures (ex. `projects.list`) sont basés sur la spec. Si le backend
 * expose un autre nom, ajuster ICI uniquement. Les types viennent de `types.ts`.
 */
import { trpc } from './client';
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
