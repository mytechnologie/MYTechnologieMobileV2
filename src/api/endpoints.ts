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
import * as FileSystem from 'expo-file-system/legacy';
import { trpc } from './client';
import { API_BASE } from './config';
import { getAuthHeaders } from '../auth/session';
import { htmlToText, textToHtml } from '../lib/richtext';
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
  WorkOrderPhoto,
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
  clientId: number;
  technicianId: number | null;
  docType?: string | null;
  installDescription?: string | null;
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
  const problem = htmlToText(r.problemDescription);
  const firstLine = problem.split('\n')[0]?.trim() ?? '';
  const isInstall = r.docType === 'bon_installation';
  return {
    id: String(r.id),
    number: r.ticketNumber,
    title: r.serviceType || firstLine || 'Appel de service',
    client: r.clientName ?? null,
    status: LEGACY_STATUS[r.status] ?? r.status,
    scheduledDate: r.serviceDate ? new Date(r.serviceDate).toISOString() : null,
    address: r.location,
    description: problem || null,
    clientId: String(r.clientId),
    docType: r.docType ?? null,
    workNotes: htmlToText(isInstall ? r.installDescription : r.actionsTaken),
  };
}

/** Fiche client (clients.get) : de quoi appeler et se rendre sur place. */
interface ClientRow {
  name: string;
  phone: string | null;
  address: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

/** Envoie un fichier local en photo du bon (route REST multipart du portail). */
async function uploadWorkOrderFile(
  workOrderId: string,
  file: { uri: string; mimeType: string; name: string },
  caption: string,
): Promise<void> {
  const form = new FormData();
  form.append('caption', caption);
  // React Native accepte { uri, type, name } comme fichier de FormData.
  form.append('file', { uri: file.uri, type: file.mimeType, name: file.name } as unknown as Blob);
  const res = await fetch(`${API_BASE}/api/work-orders/${Number(workOrderId)}/photos`, {
    method: 'POST',
    headers: { 'x-mobile-app': 'true', ...getAuthHeaders() },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? `Envoi refusé (${res.status}).`);
  }
}

export const SIGNATURE_CAPTION = 'Signature du client';

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
  client: async (clientId: string): Promise<ClientRow | null> =>
    (await trpc.clients.get.query({ id: Number(clientId) })) ?? null,

  photos: async (id: string): Promise<WorkOrderPhoto[]> => {
    const woId = Number(id);
    const [rows, urls] = await Promise.all([
      trpc.workOrders.getPhotos.query({ workOrderId: woId }) as Promise<
        { id: number; caption: string | null; uploadedAt: Date | string | null }[]
      >,
      trpc.workOrders.getPhotoUrls.query({ workOrderId: woId }) as Promise<Record<number, string>>,
    ]);
    return rows
      .filter(r => urls[r.id])
      .map(r => ({
        id: String(r.id),
        url: urls[r.id]!,
        caption: r.caption,
        createdAt: r.uploadedAt ? new Date(r.uploadedAt).toISOString() : null,
      }));
  },

  /** Photo prise avec l'appareil (JPEG). */
  addPhoto: (id: string, uri: string, caption = ''): Promise<void> =>
    uploadWorkOrderFile(id, { uri, mimeType: 'image/jpeg', name: `photo-${Date.now()}.jpg` }, caption),

  /** Signature dessinée (data URL PNG) : enregistrée comme photo légendée du bon. */
  addSignature: async (id: string, dataUrl: string): Promise<void> => {
    const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const path = `${FileSystem.cacheDirectory}signature-${Date.now()}.png`;
    await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
    try {
      await uploadWorkOrderFile(id, { uri: path, mimeType: 'image/png', name: 'signature.png' }, SIGNATURE_CAPTION);
    } finally {
      await FileSystem.deleteAsync(path, { idempotent: true });
    }
  },

  /** Notes de travail : actionsTaken (installDescription pour un bon d'installation). */
  saveNotes: (id: string, docType: string | null, text: string): Promise<{ success: boolean }> =>
    trpc.workOrders.update.mutate({
      id: Number(id),
      ...(docType === 'bon_installation'
        ? { installDescription: textToHtml(text) }
        : { actionsTaken: textToHtml(text) }),
    }),

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
