/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * Portail employé (portalAuth, timesheet) : vérifié contre server/routers/portalAuth.ts
 * et server/routers/timesheet.ts du dépôt workorders-appsv2.
 *
 * ⚠️ Côté admin (projects, workOrders) : ces procédures sont des
 * `protectedProcedure` authentifiées par COOKIE de session. Le portail n'a pas
 * encore de connexion par jeton pour le mobile : elles ne répondront qu'une
 * fois cette route ajoutée. Les formes de réponse admin restent à valider.
 *
 * Les ids sont des nombres côté serveur ; l'app les manipule en chaînes
 * (paramètres de route) et la conversion se fait ICI.
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
  InvestigationOption,
  ProjectOption,
  RequestOtpInput,
  RequestOtpResult,
  SubmitTimesheetEntriesInput,
  TimeEntryRow,
  TimesheetEntry,
  TimesheetLink,
  UpdateTimesheetEntryInput,
  VerifyOtpInput,
  VerifyOtpResponse,
  VerifyOtpResult,
  WorkOrderDetail,
  WorkOrderListItem,
} from './types';

/* ----------------------------- portalAuth (OTP) ---------------------------- */

export const portalAuth = {
  requestOtp: (input: RequestOtpInput): Promise<RequestOtpResult> =>
    trpc.portalAuth.requestOtp.mutate(input),
  verifyOtp: async (input: VerifyOtpInput): Promise<VerifyOtpResult> => {
    const res: VerifyOtpResponse = await trpc.portalAuth.verifyOtp.mutate({
      ...input,
      device: 'mobile',
    });
    const exp = new Date(res.expiresAt).getTime();
    return {
      session: res.sessionToken,
      expiresAt: Number.isNaN(exp) ? Date.now() + 8 * 3600 * 1000 : exp,
      user: {
        id: String(res.user.id),
        name: res.user.name ?? 'Employé',
        role: res.user.role,
      },
    };
  },
  logout: (): Promise<{ success: boolean }> => trpc.portalAuth.logout.mutate(),
};

/* --------------------------- adminAuth (password) -------------------------- */

export const adminAuth = {
  /**
   * Pas encore de route côté portail : `auth.login` pose un cookie et exige un
   * code SMS pour les rôles admin. À brancher sur une route mobile dédiée.
   */
  login: async (_input: AdminLoginInput): Promise<AdminLoginResult> => {
    throw new Error(
      "La connexion administrateur n'est pas encore disponible sur mobile. " +
        'Utilisez la connexion employé (code SMS).',
    );
  },
};

/* -------------------------------- projects --------------------------------- */

export const projects = {
  list: (): Promise<ProjectListItem[]> => trpc.projects.list.query(),
  getById: (id: string): Promise<ProjectDetail> =>
    trpc.projects.getById.query({ id: Number(id) }),
};

/** Le portail n'expose pas de routeur `projectTasks` : à remplacer par la vraie source. */
export const projectTasks = {
  listByProject: async (_projectId: string): Promise<ProjectTask[]> => [],
};

/* ------------------------------ work orders -------------------------------- */

export const workOrders = {
  list: (): Promise<WorkOrderListItem[]> => trpc.workOrders.list.query(),
  getById: (id: string): Promise<WorkOrderDetail> =>
    trpc.workOrders.get.query({ id: Number(id) }),
  changeStatus: (input: ChangeWorkOrderStatusInput): Promise<WorkOrderDetail> =>
    trpc.workOrders.changeStatus.mutate({ ...input, id: Number(input.id) }),
};

/* -------------------------------- timesheet -------------------------------- */

/** Date DATE MySQL → 'YYYY-MM-DD'. Le serveur tourne en UTC : lire en UTC. */
function ymd(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value).slice(0, 10) : d.toISOString().slice(0, 10);
}

function linkOf(row: TimeEntryRow): TimesheetLink {
  if (row.linkType === 'project' && row.projectId != null) {
    return { linkType: 'project', projectId: row.projectId, projectPhaseId: row.projectPhaseId };
  }
  if (row.linkType === 'investigation' && row.investigationId != null) {
    return { linkType: 'investigation', investigationId: row.investigationId };
  }
  return { linkType: null };
}

/** Libellé lisible d'un rattachement, à partir des listes de sélection. */
export function linkLabel(
  link: TimesheetLink,
  projectsOpts: ProjectOption[],
  investigationsOpts: InvestigationOption[],
): string | null {
  if (link.linkType === 'project') {
    const p = projectsOpts.find(x => x.id === link.projectId);
    if (!p) return `Projet #${link.projectId}`;
    const phase = p.phases.find(x => x.id === link.projectPhaseId);
    return phase ? `${p.name} › ${phase.name}` : p.name;
  }
  if (link.linkType === 'investigation') {
    const i = investigationsOpts.find(x => x.id === link.investigationId);
    return i?.ticketNumber ? `Enquête ${i.ticketNumber}` : `Enquête #${link.investigationId}`;
  }
  return null;
}

/** Corps commun create/update attendu par EntryInput (server/routers/timesheet.ts). */
function entryBody(input: CreateTimesheetEntryInput) {
  const l = input.link;
  return {
    entryDate: input.date,
    mode: 'range' as const,
    startTime: input.startTime,
    endTime: input.endTime,
    breakMinutes: input.breakMinutes,
    linkType: l.linkType,
    projectId: l.linkType === 'project' ? l.projectId : null,
    projectPhaseId: l.linkType === 'project' ? l.projectPhaseId : null,
    investigationId: l.linkType === 'investigation' ? l.investigationId : null,
    notes: input.notes ?? '',
    source: 'mobile' as const,
  };
}

export const timesheet = {
  projectOptions: (): Promise<ProjectOption[]> => trpc.timesheet.projectOptions.query(),
  investigationOptions: (): Promise<InvestigationOption[]> =>
    trpc.timesheet.investigationOptions.query(),

  myEntries: async (): Promise<TimesheetEntry[]> => {
    const [rows, projectsOpts, investigationsOpts] = await Promise.all([
      trpc.timesheet.myEntries.query() as Promise<TimeEntryRow[]>,
      // Les libellés sont un confort : une erreur ici ne bloque pas la liste.
      timesheet.projectOptions().catch(() => [] as ProjectOption[]),
      timesheet.investigationOptions().catch(() => [] as InvestigationOption[]),
    ]);
    return rows.map(row => {
      const link = linkOf(row);
      return {
        id: String(row.id),
        date: ymd(row.entryDate),
        link,
        linkLabel: linkLabel(link, projectsOpts, investigationsOpts),
        startTime: row.startTime ?? '',
        endTime: row.endTime ?? '',
        breakMinutes: row.breakMinutes ?? 0,
        totalHours: Number(row.computedHours) || 0,
        notes: row.notes,
        status: row.status,
        rejectedReason: row.rejectedReason ?? null,
      };
    });
  },
  createEntry: (input: CreateTimesheetEntryInput): Promise<{ id: number; computedHours: number }> =>
    trpc.timesheet.createEntry.mutate(entryBody(input)),
  updateEntry: (input: UpdateTimesheetEntryInput): Promise<{ success: boolean }> =>
    trpc.timesheet.updateEntry.mutate({ ...entryBody(input), id: Number(input.id) }),
  deleteEntry: (id: string): Promise<{ success: boolean }> =>
    trpc.timesheet.deleteEntry.mutate({ id: Number(id) }),
  submitEntries: (input: SubmitTimesheetEntriesInput): Promise<{ success: boolean; count: number }> =>
    trpc.timesheet.submitEntries.mutate({ ids: input.ids.map(Number) }),
};
