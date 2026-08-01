/**
 * Détail d'un projet : infos (client, lieu, dates, budget d'heures), avancement
 * calculé depuis les tâches, et arbre de tâches (statut + priorité + sous-tâches).
 *
 * Note : projects.getById renvoie les colonnes projects + clientName, SANS les
 * champs calculés de la liste. On recalcule donc l'avancement à partir des tâches.
 */
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Card,
  InfoRow,
  ProgressBar,
  SectionTitle,
} from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import {
  projectAttachments,
  projectReports,
  projectTasks,
  projects as projectsApi,
} from '../api/endpoints';
import { useQuery } from '../api/useApi';
import {
  formatCAD,
  formatDate,
  projectReportStatusStyle,
  projectReportTypeStyle,
  projectStatusStyle,
  taskPriorityStyle,
  taskStatusStyle,
} from '../lib/format';
import { formatHours } from '../lib/time';
import type { ProjectAttachment, ProjectTask } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

/** Aplatit l'arbre de tâches (racines + sous-tâches) en une liste. */
function flattenTasks(tasks: ProjectTask[]): ProjectTask[] {
  const out: ProjectTask[] = [];
  const walk = (list: ProjectTask[]) => {
    for (const t of list) {
      out.push(t);
      if (t.children?.length) walk(t.children);
    }
  };
  walk(tasks);
  return out;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ProjectDetailView({
  id,
  embedded = false,
}: {
  id: string;
  /** true quand rendu dans un panneau détail iPad (n'écrit pas le titre du Stack). */
  embedded?: boolean;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const projectId = String(id);

  const openTask = (taskId: number) =>
    router.push(`/projects/task?projectId=${projectId}&taskId=${taskId}`);
  const openPlan = (planId: number) =>
    router.push(`/projects/plan?projectId=${projectId}&planId=${planId}`);
  const openReports = () => router.push(`/projects/reports?projectId=${projectId}`);
  const openReport = (reportId: number) =>
    router.push(`/projects/report?projectId=${projectId}&reportId=${reportId}`);

  const projectQ = useQuery(() => projectsApi.getById(projectId), [projectId]);
  const tasksQ = useQuery(() => projectTasks.listByProject(projectId), [projectId]);
  const sitePlansQ = useQuery(() => projectsApi.getPlans(projectId), [projectId]);
  const plansQ = useQuery(() => projectAttachments.list(projectId), [projectId]);
  const reportsQ = useQuery(() => projectReports.listByProject(projectId), [projectId]);

  useEffect(() => {
    if (!embedded && projectQ.data?.name) {
      navigation.setOptions({ title: projectQ.data.name });
    }
  }, [embedded, navigation, projectQ.data?.name]);

  // Total des travaux extra à facturer — le chiffre que le chargé de projet cherche.
  const extraToBill = useMemo(
    () =>
      (reportsQ.data ?? [])
        .filter((r) => r.type === 'travaux_extra')
        .reduce((sum, r) => sum + (Number(r.billingAmount ?? 0) || 0), 0),
    [reportsQ.data],
  );

  const flatTasks = useMemo(() => flattenTasks(tasksQ.data ?? []), [tasksQ.data]);
  const progress = useMemo(() => {
    if (flatTasks.length === 0) return 0;
    const done = flatTasks.filter((t) => t.status === 'terminée').length;
    return Math.round((done / flatTasks.length) * 100);
  }, [flatTasks]);

  if (projectQ.loading) return <LoadingState label="Chargement du projet…" />;
  if (projectQ.error || !projectQ.data) {
    return <ErrorState message={projectQ.error?.message} onRetry={projectQ.refetch} />;
  }

  const project = projectQ.data;
  const status = projectStatusStyle(project.status);
  const budgetHours = toNumber(project.budgetHours);
  const budgetLabor = toNumber(project.budgetLaborCost);

  return (
    <Screen scroll refreshing={projectQ.refreshing} onRefresh={projectQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{project.name}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        {project.clientName ? (
          <Text style={styles.client}>{project.clientName}</Text>
        ) : null}
        {project.description ? (
          <Text style={styles.desc}>{project.description}</Text>
        ) : null}

        <View style={styles.progressBlock}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Avancement</Text>
            <Text style={styles.progressPct}>{progress} %</Text>
          </View>
          <ProgressBar value={progress} />
        </View>
      </Card>

      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.block}>
        {project.location ? <InfoRow label="Lieu" value={project.location} /> : null}
        {project.startDate ? (
          <InfoRow label="Début" value={formatDate(project.startDate)} />
        ) : null}
        {project.endDate ? (
          <InfoRow label="Fin prévue" value={formatDate(project.endDate)} />
        ) : null}
        {budgetHours != null ? (
          <InfoRow label="Budget d'heures" value={formatHours(budgetHours)} />
        ) : null}
        {budgetLabor != null ? (
          <InfoRow
            label="Budget main-d'œuvre"
            value={`${budgetLabor.toLocaleString('fr-CA')} $`}
          />
        ) : null}
      </Card>

      <SectionTitle>Plans de chantier</SectionTitle>
      <Card style={styles.block}>
        {sitePlansQ.loading ? (
          <Text style={styles.muted}>Chargement des plans…</Text>
        ) : sitePlansQ.error ? (
          <Text style={styles.muted}>Plans indisponibles.</Text>
        ) : (sitePlansQ.data ?? []).length === 0 ? (
          <Text style={styles.muted}>Aucun plan. (Ajout d'un plan via le web.)</Text>
        ) : (
          (sitePlansQ.data ?? []).map((pl) => (
            <Pressable key={pl.id} style={styles.planRow} onPress={() => openPlan(pl.id)}>
              <Ionicons
                name={pl.fileType === 'pdf' ? 'document-outline' : 'map-outline'}
                size={20}
                color={colors.navy}
              />
              <View style={styles.planRowText}>
                <Text style={styles.planRowName} numberOfLines={1}>
                  {pl.name}
                </Text>
                <Text style={styles.muted}>
                  {(pl.annotations?.length ?? 0)} marqueur(s) · {pl.fileType.toUpperCase()}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))
        )}
      </Card>

      <SectionTitle>Documents</SectionTitle>
      <Card style={styles.block}>
        {plansQ.loading ? (
          <Text style={styles.muted}>Chargement des plans…</Text>
        ) : plansQ.error ? (
          <Text style={styles.muted}>Plans indisponibles.</Text>
        ) : (plansQ.data ?? []).length === 0 ? (
          <Text style={styles.muted}>Aucun plan ni document.</Text>
        ) : (
          <View style={styles.planGrid}>
            {(plansQ.data ?? []).map((att) => (
              <PlanTile key={att.id} att={att} />
            ))}
          </View>
        )}
      </Card>

      <View style={styles.sectionHead}>
        <SectionTitle>Rapports</SectionTitle>
        <Pressable onPress={openReports} style={styles.sectionLink} accessibilityRole="button">
          <Text style={styles.sectionLinkText}>Tout voir</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.navy} />
        </Pressable>
      </View>
      <Card style={styles.block}>
        {reportsQ.loading ? (
          <Text style={styles.muted}>Chargement des rapports…</Text>
        ) : reportsQ.error ? (
          <Text style={styles.muted}>Rapports indisponibles.</Text>
        ) : (reportsQ.data ?? []).length === 0 ? (
          <Pressable onPress={openReports} style={styles.reportEmpty}>
            <Ionicons name="document-text-outline" size={20} color={colors.textMuted} />
            <Text style={styles.muted}>
              Aucun rapport. Touchez pour créer un rapport de travaux extra, d’avancement, de fin de
              projet ou de déficiences.
            </Text>
          </Pressable>
        ) : (
          <>
            {extraToBill > 0 ? (
              <View style={styles.extraTotalRow}>
                <Ionicons name="cash-outline" size={16} color={colors.goldDark} />
                <Text style={styles.extraTotalLabel}>Travaux extra à facturer</Text>
                <Text style={styles.extraTotalValue}>{formatCAD(extraToBill)}</Text>
              </View>
            ) : null}
            {(reportsQ.data ?? []).slice(0, 4).map((r) => {
              const rt = projectReportTypeStyle(r.type);
              const rs = projectReportStatusStyle(r.status);
              return (
                <Pressable
                  key={r.id}
                  style={styles.planRow}
                  onPress={() => openReport(r.id)}
                  accessibilityRole="button"
                >
                  <Ionicons name={rt.icon} size={20} color={rt.color} />
                  <View style={styles.planRowText}>
                    <Text style={styles.planRowName} numberOfLines={1}>
                      {r.title}
                    </Text>
                    <Text style={styles.muted}>
                      {r.reportNumber} · {rt.label}
                      {r.type === 'travaux_extra'
                        ? ` · ${formatCAD(r.billingAmount)}`
                        : ''}
                    </Text>
                  </View>
                  <Badge label={rs.label} color={rs.color} bg={rs.bg} />
                </Pressable>
              );
            })}
            {(reportsQ.data ?? []).length > 4 ? (
              <Pressable onPress={openReports} style={styles.moreRow}>
                <Text style={styles.sectionLinkText}>
                  Voir les {(reportsQ.data ?? []).length} rapports
                </Text>
              </Pressable>
            ) : null}
          </>
        )}
      </Card>

      <SectionTitle>Tâches</SectionTitle>
      {tasksQ.loading ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Chargement des tâches…</Text>
        </Card>
      ) : tasksQ.error ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Tâches indisponibles.</Text>
        </Card>
      ) : (tasksQ.data ?? []).length === 0 ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Aucune tâche.</Text>
        </Card>
      ) : (
        <View style={styles.taskList}>
          {(tasksQ.data ?? []).map((t) => (
            <TaskRow key={t.id} task={t} depth={0} onOpen={openTask} />
          ))}
        </View>
      )}
    </Screen>
  );
}

/** Vignette de plan/document : image en aperçu, autres formats en carte fichier. */
function PlanTile({ att }: { att: ProjectAttachment }) {
  const isImage = (att.fileType ?? '').startsWith('image/');
  const open = () =>
    Linking.openURL(att.fileUrl).catch(() =>
      // eslint-disable-next-line no-alert
      undefined,
    );
  return (
    <Pressable style={styles.planTile} onPress={open} accessibilityRole="button">
      {isImage ? (
        <Image source={{ uri: att.fileUrl }} style={styles.planThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.planThumb, styles.planDoc]}>
          <Ionicons name="document-text-outline" size={30} color={colors.navy} />
        </View>
      )}
      <Text style={styles.planName} numberOfLines={1}>
        {att.fileName}
      </Text>
    </Pressable>
  );
}

function TaskRow({
  task,
  depth,
  onOpen,
}: {
  task: ProjectTask;
  depth: number;
  onOpen: (taskId: number) => void;
}) {
  const s = taskStatusStyle(task.status);
  const p = taskPriorityStyle(task.priority);
  const checklist = task.checklistItems ?? [];
  const done = checklist.filter((c) => c.isCompleted).length;
  return (
    <>
      <View style={depth > 0 ? { marginLeft: depth * spacing.lg } : undefined}>
        <Card style={styles.taskCard} onPress={() => onOpen(task.id)}>
          <View style={styles.taskTop}>
            <Text style={styles.taskName} numberOfLines={2}>
              {task.title}
            </Text>
            <Badge label={s.label} color={s.color} bg={s.bg} />
          </View>
          <View style={styles.taskMeta}>
            <View style={styles.taskTags}>
              <Badge label={p.label} color={p.color} bg={p.bg} />
              {task.spaceLabel ? (
                <Text style={styles.muted}>{task.spaceLabel}</Text>
              ) : null}
              {checklist.length > 0 ? (
                <Text style={styles.muted}>
                  ☑ {done}/{checklist.length}
                </Text>
              ) : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </Card>
      </View>
      {task.children?.map((child) => (
        <TaskRow key={child.id} task={child} depth={depth + 1} onOpen={onOpen} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.lg, gap: spacing.sm },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  client: { fontSize: typography.body, color: colors.textMuted },
  desc: { fontSize: typography.small, color: colors.text, lineHeight: 20 },
  progressBlock: { marginTop: spacing.sm, gap: spacing.xs },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { fontSize: typography.small, color: colors.textMuted },
  progressPct: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  block: { marginBottom: spacing.lg },
  muted: { fontSize: typography.tiny, color: colors.textMuted },

  planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  planTile: { width: 120, gap: spacing.xs },
  planThumb: {
    width: 120,
    height: 120,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  planDoc: { alignItems: 'center', justifyContent: 'center' },
  planName: { fontSize: typography.tiny, color: colors.text },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  planRowText: { flex: 1 },
  planRowName: { fontSize: typography.small, color: colors.text, fontWeight: typography.weightMedium },

  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingBottom: spacing.md,
  },
  sectionLinkText: {
    fontSize: typography.small,
    color: colors.navy,
    fontWeight: typography.weightSemibold,
  },
  reportEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  extraTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.md,
    marginBottom: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  extraTotalLabel: { flex: 1, fontSize: typography.tiny, color: colors.goldDark, fontWeight: typography.weightSemibold },
  extraTotalValue: { fontSize: typography.body, fontWeight: typography.weightBold, color: colors.navy },
  moreRow: { paddingTop: spacing.md, alignItems: 'center' },

  taskList: { gap: spacing.sm },
  taskCard: { gap: spacing.xs },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  taskName: { flex: 1, fontSize: typography.small, color: colors.text },
  taskMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskTags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
});
