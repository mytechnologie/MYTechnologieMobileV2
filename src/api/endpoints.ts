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
  ProjectPhase,
  ProjectDevice,
  PhaseStatus,
  FieldDeviceInput,
  ClientListItem,
  UserListItem,
  ServiceTypeItem,
  ScheduleItem,
  AgendaEntry,
  CalendarPerson,
  ScheduleInput,
  CreateWorkOrderInput,
  CreateWorkOrderResult,
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
  WorkOrderContent,
  InstallTest,
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
  phases: { id: number; parentId: number | null; name: string; status: PhaseStatus; sortOrder: number }[];
  zones: { id: number; name: string; code: string | null }[];
  devices: (Omit<ProjectDevice, 'id' | 'zone'> & { id: number; zoneId: number | null })[];
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
    const zoneOf = new Map(res.zones.map(z => [z.id, z.code ? `${z.code} — ${z.name}` : z.name]));
    const toPhase = (ph: ProjectGetResponse['phases'][number]): ProjectPhase => {
      const h = hoursOf.get(ph.id);
      const done = h ? h.timesheetHours + h.punchHours : 0;
      return {
        id: String(ph.id),
        name: ph.name,
        status: ph.status,
        hoursPct: h && h.budgetHours > 0 ? Math.round((done / h.budgetHours) * 100) : null,
        // Sous-phases dans l'ordre du portail (un seul niveau).
        children: res.phases.filter(c => c.parentId === ph.id).map(toPhase),
      };
    };
    return {
      id: String(p.id),
      code: p.code,
      title: p.name,
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
      phases: res.phases.filter(ph => ph.parentId == null).map(toPhase),
      devices: res.devices.map(({ zoneId, ...d }) => ({
        ...d,
        id: String(d.id),
        zone: zoneId != null ? (zoneOf.get(zoneId) ?? null) : null,
      })),
    };
  },

  /** Avancement d'une phase depuis le chantier (projects.fieldSetPhaseStatus). */
  setPhaseStatus: (phaseId: string, status: PhaseStatus): Promise<{ success: boolean }> =>
    trpc.projects.fieldSetPhaseStatus.mutate({ id: Number(phaseId), status }),

  /** Relevé terrain d'un appareil (projects.fieldUpdateDevice). */
  updateDevice: ({ id, ...rest }: FieldDeviceInput): Promise<{ success: boolean }> =>
    trpc.projects.fieldUpdateDevice.mutate({ id: Number(id), ...rest }),
};

/* ------------------------------ work orders -------------------------------- */

/** Ligne de workOrders.list (withNames) / workOrders.get (server/routers.ts). */
interface WorkOrderRow {
  id: number;
  ticketNumber: string;
  clientId: number;
  technicianId: number | null;
  docType?: string | null;
  installRequest?: string | null;
  installDescription?: string | null;
  installTests?: { label: string; checked: boolean; sortOrder?: number | null }[];
  materialsInternal?: string | null;
  followUp?: string | null;
  clientNote?: string | null;
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
    content: {
      problemDescription: problem,
      actionsTaken: htmlToText(r.actionsTaken),
      installRequest: htmlToText(r.installRequest),
      installDescription: htmlToText(r.installDescription),
      materialsInternal: htmlToText(r.materialsInternal),
      followUp: htmlToText(r.followUp),
      clientNote: r.clientNote ?? '',
    },
    tests: isInstall
      ? (r.installTests ?? []).map(t => ({ label: t.label, checked: !!t.checked }))
      : [],
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
  /** Création (admin/manager, permission work_orders.create). Textes riches → HTML. */
  create: (input: CreateWorkOrderInput): Promise<CreateWorkOrderResult> =>
    trpc.workOrders.create.mutate({
      ...input,
      problemDescription: input.problemDescription ? textToHtml(input.problemDescription) : input.problemDescription,
      actionsTaken: input.actionsTaken ? textToHtml(input.actionsTaken) : input.actionsTaken,
      followUp: input.followUp ? textToHtml(input.followUp) : input.followUp,
      installRequest: input.installRequest ? textToHtml(input.installRequest) : input.installRequest,
      installDescription: input.installDescription
        ? textToHtml(input.installDescription)
        : input.installDescription,
    }),

  /**
   * Contenu du bon, comme le formulaire du portail. Seuls les champs modifiés
   * partent : un champ riche non touché garde sa mise en forme (gras, listes).
   * Le portail ignore les champs que le rôle ou le type de bon ne permet pas.
   */
  saveContent: (
    id: string,
    changed: Partial<WorkOrderContent>,
    tests?: InstallTest[],
  ): Promise<{ success: boolean }> => {
    const body: Record<string, unknown> = { id: Number(id) };
    for (const [key, value] of Object.entries(changed)) {
      const text = (value ?? '').trim();
      // La note client est du texte simple au portail ; le reste est du HTML.
      body[key] = !text ? null : key === 'clientNote' ? text : textToHtml(text);
    }
    if (tests) {
      body.tests = tests
        .filter(t => t.label.trim())
        .map((t, i) => ({ label: t.label.trim(), checked: t.checked, sortOrder: i }));
    }
    return trpc.workOrders.update.mutate(body);
  },

  /** Admin et technicien (techOrAdminProcedure au portail) ; l'app le réserve aux admins. */
  deletePhoto: (photoId: string): Promise<{ success: boolean }> =>
    trpc.workOrders.deletePhoto.mutate({ photoId: Number(photoId) }),

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

/**
 * Les routes d'heures exigent l'accès au portail employé (users.portalAccess).
 * Sans lui le portail répond 401 « Session portail manquante » : message clair.
 */
function portalAccessError(e: unknown): never {
  const msg = e instanceof Error ? e.message : '';
  if (/session portail|accès portail/i.test(msg)) {
    throw new Error(
      "Votre compte n'a pas l'accès au portail employé. Un administrateur peut l'activer sur le portail : fiche de l'employé, « Accès au portail employé » (un département est requis).",
    );
  }
  throw e;
}

export const timesheet = {
  projectOptions: (): Promise<ProjectOption[]> => trpc.timesheet.projectOptions.query(),
  investigationOptions: (): Promise<InvestigationOption[]> =>
    trpc.timesheet.investigationOptions.query(),

  myEntries: async (): Promise<TimesheetEntry[]> => {
    const [rows, projectsOpts, investigationsOpts] = await Promise.all([
      (trpc.timesheet.myEntries.query() as Promise<TimeEntryRow[]>).catch(portalAccessError),
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

// ─── Pointage (server/routers/punch.ts) ─────────────────────────────────────

export interface PunchStatus {
  isClockedIn: boolean;
  /** Heure du dernier poinçon (arrivée si pointé). */
  since: Date | null;
  /** Rattachement du poinçon en cours, pour l'affichage. */
  label: string | null;
  workOrderId: string | null;
}

interface PunchStatusRow {
  isClockedIn: boolean;
  lastPunch: {
    punchedAt: Date | string;
    workOrderId: number | null;
    projectName: string | null;
    projectPhaseName: string | null;
  } | null;
}

export const punch = {
  status: async (): Promise<PunchStatus> => {
    const row = (await trpc.punch.getStatus.query()) as PunchStatusRow;
    const last = row.lastPunch;
    const label = last?.projectName
      ? [last.projectName, last.projectPhaseName].filter(Boolean).join(' › ')
      : null;
    return {
      isClockedIn: row.isClockedIn,
      since: last ? new Date(last.punchedAt) : null,
      label,
      workOrderId: last?.workOrderId != null ? String(last.workOrderId) : null,
    };
  },
  clockIn: (input: { workOrderId?: string; notes?: string } = {}): Promise<{ id: number }> =>
    trpc.punch.clockIn.mutate({
      workOrderId: input.workOrderId ? Number(input.workOrderId) : undefined,
      notes: input.notes,
    }),
  clockOut: (notes?: string): Promise<{ id: number }> => trpc.punch.clockOut.mutate({ notes }),
};

// ─── Notifications push (server/routers/notifications.ts) ───────────────────

export const push = {
  register: (token: string, platform: 'ios' | 'android', deviceName?: string) =>
    trpc.notifications.registerPushToken.mutate({ token, platform, deviceName }),
  deactivate: (token: string) => trpc.notifications.deactivatePushToken.mutate({ token }),
};

// ─── Approbation des heures (timesheet.approvalQueue / approve / reject) ────

export interface ApprovalEntry {
  id: string;
  userId: string;
  userName: string;
  date: string;
  hours: number;
  startTime: string | null;
  endTime: string | null;
  label: string | null;
  notes: string | null;
}

/** Entrées soumises regroupées par employé (maquette « À approuver »). */
export interface ApprovalGroup {
  userId: string;
  userName: string;
  totalHours: number;
  entries: ApprovalEntry[];
}

interface ApprovalRow {
  id: number;
  userId: number;
  userName: string | null;
  entryDate: Date | string;
  startTime: string | null;
  endTime: string | null;
  computedHours: number;
  linkType: string | null;
  projectName: string | null;
  projectPhaseName: string | null;
  investigationId: number | null;
  notes: string | null;
}

export const approvals = {
  queue: async (): Promise<ApprovalGroup[]> => {
    const rows = (await trpc.timesheet.approvalQueue.query()) as ApprovalRow[];
    const groups = new Map<string, ApprovalGroup>();
    for (const r of rows) {
      const userId = String(r.userId);
      const userName = r.userName ?? `Employé ${r.userId}`;
      let g = groups.get(userId);
      if (!g) {
        g = { userId, userName, totalHours: 0, entries: [] };
        groups.set(userId, g);
      }
      const label =
        r.linkType === 'project' && r.projectName
          ? [r.projectName, r.projectPhaseName].filter(Boolean).join(' › ')
          : r.linkType === 'investigation' && r.investigationId
            ? `Enquête #${r.investigationId}`
            : null;
      const hours = Number(r.computedHours) || 0;
      g.totalHours += hours;
      g.entries.push({
        id: String(r.id),
        userId,
        userName,
        date: ymd(r.entryDate),
        hours,
        startTime: r.startTime,
        endTime: r.endTime,
        label,
        notes: r.notes,
      });
    }
    return [...groups.values()].sort((a, b) => a.userName.localeCompare(b.userName, 'fr'));
  },
  approve: (ids: string[]): Promise<{ success: boolean; count: number }> =>
    trpc.timesheet.approve.mutate({ ids: ids.map(Number) }),
  reject: (id: string, reason: string): Promise<{ success: boolean }> =>
    trpc.timesheet.reject.mutate({ id: Number(id), reason }),
};

// ─── Repris de la branche iPad : clients, utilisateurs, types de service, Cédule ─

function unwrapItems<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  const items = (res as { items?: unknown })?.items;
  return Array.isArray(items) ? (items as T[]) : [];
}

export const clients = {
  /** clients.list → { items, total } ; 500 pour avoir tous les clients au sélecteur. */
  list: async (input?: { search?: string; limit?: number }): Promise<ClientListItem[]> =>
    unwrapItems<ClientListItem>(await trpc.clients.list.query({ limit: 500, ...(input ?? {}) })),
};

export const users = {
  /** Requiert users.view (rôles élevés) : l'appelant dégrade si refusé. */
  list: (): Promise<UserListItem[]> => trpc.users.list.query(),
};

export const serviceTypes = {
  listActive: (): Promise<ServiceTypeItem[]> => trpc.serviceTypes.listActive.query(),
};

/** Cédule (server/routers/calendar.ts). */
/** Bon daté de calendar.agenda (heure en UTC côté serveur). */
interface AgendaWorkOrderRow {
  id: number;
  ticketNumber: string;
  technicianId: number | null;
  technicianName: string | null;
  serviceDate: Date | string | null;
  durationMinutes: number | null;
  serviceType: string | null;
  location: string | null;
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const localYmd = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const localHm = (d: Date) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

/** Couleur des bons dans la Cédule (or de la marque). */
export const WORK_ORDER_COLOR = '#C9A227';

export const schedule = {
  /** Rendez-vous des personnes demandées (vide = soi) et leurs bons datés. */
  agenda: async (input: {
    startDate: string;
    endDate: string;
    userIds?: number[];
    includeWorkOrders?: boolean;
  }): Promise<AgendaEntry[]> => {
    const res: { events: ScheduleItem[]; workOrders: AgendaWorkOrderRow[] } =
      await trpc.calendar.agenda.query(input);
    const events: AgendaEntry[] = res.events.map(e => ({
      key: `e${e.id}`,
      kind: 'event',
      id: e.id,
      userId: e.userId,
      userName: e.userName ?? null,
      date: e.workDate,
      start: e.startTime,
      end: e.endTime,
      allDay: !!e.allDay,
      title: e.title,
      location: e.location ?? null,
      notes: e.notes ?? null,
      color: e.color ?? null,
      reminderMinutes: e.reminderMinutes ?? null,
      reminder2Minutes: e.reminder2Minutes ?? null,
      canEdit: e.canEdit !== false,
    }));
    const workOrders: AgendaEntry[] = [];
    for (const w of res.workOrders) {
      if (!w.serviceDate || w.technicianId == null) continue;
      const start = new Date(w.serviceDate);
      const end = new Date(start.getTime() + (w.durationMinutes || 60) * 60000);
      // Bon saisi avec une date seule au portail : minuit UTC pile, soit la
      // veille au soir ici. On le garde en journée entière à sa date UTC.
      const dateOnly =
        start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0;
      const date = dateOnly ? start.toISOString().slice(0, 10) : localYmd(start);
      // Le serveur prend une marge d'un jour : on garde la plage demandée.
      if (date < input.startDate || date > input.endDate) continue;
      workOrders.push({
        key: `w${w.id}`,
        kind: 'work_order',
        id: w.id,
        userId: w.technicianId,
        userName: w.technicianName,
        date,
        start: dateOnly ? '00:00' : localHm(start),
        end: dateOnly ? '23:59' : localYmd(end) === date ? localHm(end) : '23:59',
        allDay: dateOnly,
        title: `${w.ticketNumber}${w.serviceType ? ` · ${w.serviceType}` : ''}`,
        location: w.location,
        notes: null,
        color: WORK_ORDER_COLOR,
        reminderMinutes: null,
        reminder2Minutes: null,
        canEdit: false,
      });
    }
    return [...events, ...workOrders].sort((a, b) =>
      a.date === b.date
        ? Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start)
        : a.date.localeCompare(b.date),
    );
  },
  people: (): Promise<CalendarPerson[]> => trpc.calendar.people.query(),

  list: (input?: { startDate?: string; endDate?: string; userId?: number }): Promise<ScheduleItem[]> =>
    trpc.calendar.list.query(input ?? {}),
  create: (input: ScheduleInput): Promise<{ id: number }> => trpc.calendar.create.mutate(input),
  /** Le portail attend { id, data }. */
  update: (id: number, data: Partial<ScheduleInput>): Promise<{ success: boolean }> =>
    trpc.calendar.update.mutate({ id, data }),
  remove: (id: number): Promise<{ success: boolean }> => trpc.calendar.delete.mutate({ id }),
};
