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
  projectTasks,
  projects as projectsApi,
} from '../api/endpoints';
import { useQuery } from '../api/useApi';
import {
  formatDate,
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

  const projectQ = useQuery(() => projectsApi.getById(projectId), [projectId]);
  const tasksQ = useQuery(() => projectTasks.listByProject(projectId), [projectId]);
  const plansQ = useQuery(() => projectAttachments.list(projectId), [projectId]);

  useEffect(() => {
    if (!embedded && projectQ.data?.name) {
      navigation.setOptions({ title: projectQ.data.name });
    }
  }, [embedded, navigation, projectQ.data?.name]);

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

      <SectionTitle>Plans & documents</SectionTitle>
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
