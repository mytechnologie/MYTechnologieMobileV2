/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * ⚠️ Les noms de procédures (ex. `projects.list`) sont basés sur la spec. Si le backend
 * expose un autre nom, ajuster ICI uniquement. Les types viennent de `types.ts`.
 */
import { trpc } from './client';
import type {
  AdminLoginInput,
  AdminLoginResult,
  ChangeWorkOrderStatusInput,
  CreateTimesheetEntryInput,
  ProjectDetail,
  ProjectListItem,
  ProjectTask,
  RequestOtpInput,
  RequestOtpResult,
  SubmitTimesheetEntriesInput,
  TimesheetEntry,
  UpdateTimesheetEntryInput,
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

/* --------------------------- adminAuth (password) -------------------------- */

export const adminAuth = {
  login: (input: AdminLoginInput): Promise<AdminLoginResult> =>
    trpc.adminAuth.login.mutate(input),
};

/* -------------------------------- projects --------------------------------- */

export const projects = {
  list: (): Promise<ProjectListItem[]> => trpc.projects.list.query(),
  getById: (id: string): Promise<ProjectDetail> =>
    trpc.projects.getById.query({ id }),
};

export const projectTasks = {
  listByProject: (projectId: string): Promise<ProjectTask[]> =>
    trpc.projectTasks.listByProject.query({ projectId }),
};

/* ------------------------------ work orders -------------------------------- */

export const workOrders = {
  list: (): Promise<WorkOrderListItem[]> => trpc.workOrders.listWorkOrders.query(),
  getById: (id: string): Promise<WorkOrderDetail> =>
    trpc.workOrders.getWorkOrderById.query({ id }),
  changeStatus: (input: ChangeWorkOrderStatusInput): Promise<WorkOrderDetail> =>
    trpc.workOrders.changeWorkOrderStatus.mutate(input),
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
