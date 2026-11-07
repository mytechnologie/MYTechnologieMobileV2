/**
 * Wrappers d'appel fortement typés autour du client tRPC.
 *
 * Connexion : auth.login / verifyLoginOtp / me (server/routers.ts). Le jeton
 * renvoyé part en `Authorization: Bearer`, accepté par toutes les routes
 * protégées du portail. Heures : server/routers/timesheet.ts ; elles acceptent
 * le jeton depuis la PR portail « session par jeton » (#41).
 *
 * ⚠️ projects / workOrders : formes de réponse encore à valider.
 *
 * Les ids sont des nombres côté serveur ; l'app les manipule en chaînes
 * (paramètres de route) et la conversion se fait ICI.
 */
import { trpc } from './client';
import type {
  ChangeWorkOrderStatusInput,
  CreateTimesheetEntryInput,
  ProjectDetail,
  ProjectListItem,
  ProjectTask,
  InvestigationOption,
  LoginInput,
  LoginResponse,
  MeResponse,
  ProjectOption,
  SubmitTimesheetEntriesInput,
  TimeEntryRow,
  TimesheetEntry,
  TimesheetLink,
  UpdateTimesheetEntryInput,
  VerifyLoginOtpInput,
  VerifyLoginOtpResponse,
  WorkOrderDetail,
  WorkOrderListItem,
} from './types';

/* ------------------------------ auth (connexion) ------------------------------ */

export const auth = {
  login: (input: LoginInput): Promise<LoginResponse> => trpc.auth.login.mutate(input),
  verifyLoginOtp: (input: VerifyLoginOtpInput): Promise<VerifyLoginOtpResponse> =>
    trpc.auth.verifyLoginOtp.mutate(input),
  resendLoginOtp: (challengeId: string): Promise<{ success: boolean }> =>
    trpc.auth.resendLoginOtp.mutate({ challengeId }),
  me: (): Promise<MeResponse | null> => trpc.auth.me.query(),
};

/* -------------------------------- projects --------------------------------- */

/** Ligne de projects.list (server/routers/projects.ts). */
interface ProjectRow {
  id: number;
  code: string | null;
  name: string;
  status: string;
  clientName: string | null;
  budgetHours: number;
  actualHours: number;
  hoursPct: number | null;
}

/** Réponse de projects.getById. */
interface ProjectGetResponse {
  project: {
    id: number;
    code: string | null;
    name: string;
    status: string;
    description: string | null;
    budget: string | number | null;
    startDate: Date | string | null;
    endDate: Date | string | null;
  };
  client: { name: string } | null;
  phases: { id: number; parentId: number | null; name: string; status: string; sortOrder: number }[];
  hours: {
    phases: { phaseId: number; budgetHours: number; timesheetHours: number; punchHours: number }[];
    totals: { budgetHours: number; actualHours: number; pct: number | null };
  };
}

const dateOrNull = (v: Date | string | null): string | null =>
  v == null ? null : new Date(v).toISOString().slice(0, 10);

export const projects = {
  list: async (): Promise<ProjectListItem[]> => {
    const rows: ProjectRow[] = await trpc.projects.list.query();
    return rows.map(r => ({
      id: String(r.id),
      name: r.code ? `${r.code} — ${r.name}` : r.name,
      client: r.clientName,
      status: r.status,
      progress: r.hoursPct,
      budgetHours: r.budgetHours,
      spentHours: r.actualHours,
    }));
  },
  getById: async (id: string): Promise<ProjectDetail> => {
    const res: ProjectGetResponse = await trpc.projects.getById.query({ id: Number(id) });
    const p = res.project;
    const hoursOf = new Map(res.hours.phases.map(h => [h.phaseId, h]));
    // Phases puis leurs sous-phases (un seul niveau), dans l'ordre du portail.
    const top = res.phases.filter(ph => ph.parentId == null);
    const ordered = top.flatMap(ph => [ph, ...res.phases.filter(c => c.parentId === ph.id)]);
    return {
      id: String(p.id),
      name: p.code ? `${p.code} — ${p.name}` : p.name,
      client: res.client?.name ?? null,
      status: p.status,
      progress: res.hours.totals.pct,
      budgetHours: res.hours.totals.budgetHours,
      spentHours: res.hours.totals.actualHours,
      description: p.description,
      budgetAmount: p.budget != null ? Number(p.budget) : null,
      startDate: dateOrNull(p.startDate),
      endDate: dateOrNull(p.endDate),
      phases: ordered.map(ph => {
        const h = hoursOf.get(ph.id);
        const done = h ? h.timesheetHours + h.punchHours : 0;
        return {
          id: String(ph.id),
          name: ph.parentId == null ? ph.name : `› ${ph.name}`,
          status: ph.status,
          progress: h && h.budgetHours > 0 ? Math.round((done / h.budgetHours) * 100) : null,
        };
      }),
    };
  },
};

/** Le portail n'a pas de tâches distinctes des phases : rien à lister ici. */
export const projectTasks = {
  listByProject: async (_projectId: string): Promise<ProjectTask[]> => [],
};

/* ------------------------------ work orders -------------------------------- */

/** Ligne de workOrders.list (withNames) / workOrders.get (server/routers.ts). */
interface WorkOrderRow {
  id: number;
  ticketNumber: string;
  status: string;
  priority?: string | null;
  serviceType: string | null;
  location: string | null;
  serviceDate: Date | string | null;
  problemDescription: string | null;
  actionsTaken?: string | null;
  clientName?: string | null;
  technicianName?: string | null;
}

/** Anciens statuts encore présents en base (shared/workOrderStatus.ts). */
const LEGACY_STATUS: Record<string, string> = {
  en_attente: 'nouveau',
  assigne: 'planifie',
  soumis: 'complete',
  approuve: 'a_facturer',
};

function toWorkOrder(r: WorkOrderRow): WorkOrderDetail {
  const firstLine = (r.problemDescription ?? '').split('\n')[0]?.trim() ?? '';
  return {
    id: String(r.id),
    number: r.ticketNumber,
    title: r.serviceType || firstLine || 'Appel de service',
    client: r.clientName ?? null,
    status: LEGACY_STATUS[r.status] ?? r.status,
    scheduledDate: r.serviceDate ? new Date(r.serviceDate).toISOString() : null,
    address: r.location,
    description: r.problemDescription,
  };
}

export const workOrders = {
  /** Le portail limite déjà un technicien à ses bons (work_orders.view_assigned). */
  list: async (): Promise<WorkOrderListItem[]> => {
    const res: { items: WorkOrderRow[]; total: number } = await trpc.workOrders.list.query({
      withNames: true,
      limit: 100,
    });
    return res.items.map(toWorkOrder);
  },
  getById: async (id: string): Promise<WorkOrderDetail> =>
    toWorkOrder(await trpc.workOrders.get.query({ id: Number(id) })),
  /** Transitions et droits vérifiés par le portail (STATUS_TRANSITIONS). */
  changeStatus: (input: ChangeWorkOrderStatusInput): Promise<{ success: boolean }> =>
    trpc.workOrders.changeStatus.mutate({ id: Number(input.id), status: input.status }),
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
