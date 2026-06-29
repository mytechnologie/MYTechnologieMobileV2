/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * ⚠️ Les noms de procédures (ex. `projects.list`) sont basés sur la spec. Si le backend
 * expose un autre nom, ajuster ICI uniquement. Les types viennent de `types.ts`.
 */
import { trpc } from './client';
import type {
  ChangeWorkOrderStatusInput,
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

/* -------------------------------- projects --------------------------------- */

export const projects = {
  list: (): Promise<ProjectListItem[]> => trpc.projects.list.query(),
  getById: (id: string): Promise<ProjectDetail> =>
    trpc.projects.getById.query({ id }),
};

export const projectTasks = {
  // Backend : projectTasks.list (input { projectId } supposé — non vérifiable sans auth).
  listByProject: (projectId: string): Promise<ProjectTask[]> =>
    trpc.projectTasks.list.query({ projectId }),
};

/* ------------------------------ work orders -------------------------------- */

export const workOrders = {
  list: (): Promise<WorkOrderListItem[]> => trpc.workOrders.list.query(),
  // Backend : workOrders.get (input { id } supposé).
  getById: (id: string): Promise<WorkOrderDetail> =>
    trpc.workOrders.get.query({ id }),
  changeStatus: (input: ChangeWorkOrderStatusInput): Promise<WorkOrderDetail> =>
    trpc.workOrders.changeStatus.mutate(input),
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
