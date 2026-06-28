/**
 * Détail d'un projet : phases, tâches (lecture/statut), heures, budget.
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  InfoRow,
  ProgressBar,
  SectionTitle,
} from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { projectTasks, projects as projectsApi } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import {
  projectStatusStyle,
  taskStatusStyle,
} from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import type { ProjectTask } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const projectId = String(id);

  const projectQ = useQuery(() => projectsApi.getById(projectId), [projectId]);
  const tasksQ = useQuery(() => projectTasks.listByProject(projectId), [projectId]);

  useEffect(() => {
    if (projectQ.data?.name) {
      navigation.setOptions({ title: projectQ.data.name });
    }
  }, [navigation, projectQ.data?.name]);

  if (projectQ.loading) return <LoadingState label="Chargement du projet…" />;
  if (projectQ.error || !projectQ.data) {
    return <ErrorState message={projectQ.error?.message} onRetry={projectQ.refetch} />;
  }

  const project = projectQ.data;
  const status = projectStatusStyle(project.status);
  const progress = project.progress ?? 0;
  const tasks = tasksQ.data ?? [];

  return (
    <Screen scroll refreshing={projectQ.refreshing} onRefresh={projectQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{project.name}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        {project.client ? <Text style={styles.client}>{project.client}</Text> : null}
        {project.description ? (
          <Text style={styles.desc}>{project.description}</Text>
        ) : null}

        <View style={styles.progressBlock}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Avancement</Text>
            <Text style={styles.progressPct}>{Math.round(progress)} %</Text>
          </View>
          <ProgressBar value={progress} />
        </View>
      </Card>

      {/* Heures & budget */}
      <SectionTitle>Heures & budget</SectionTitle>
      <Card style={styles.block}>
        <InfoRow
          label="Heures"
          value={`${formatHours(project.spentHours ?? 0)} / ${
            project.budgetHours != null ? formatHours(project.budgetHours) : '—'
          }`}
        />
        <InfoRow
          label="Budget"
          value={
            project.budgetAmount != null
              ? `${(project.spentAmount ?? 0).toLocaleString('fr-CA')} $ / ${project.budgetAmount.toLocaleString('fr-CA')} $`
              : '—'
          }
        />
      </Card>

      {/* Phases */}
      {project.phases && project.phases.length > 0 ? (
        <>
          <SectionTitle>Phases</SectionTitle>
          <Card style={styles.block}>
            {project.phases.map((ph) => (
              <View key={ph.id} style={styles.phaseRow}>
                <Text style={styles.phaseName}>{ph.name}</Text>
                <Text style={styles.phaseProgress}>
                  {ph.progress != null ? `${Math.round(ph.progress)} %` : (ph.status ?? '')}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Tâches */}
      <SectionTitle>Tâches</SectionTitle>
      {tasksQ.loading ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Chargement des tâches…</Text>
        </Card>
      ) : tasksQ.error ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Tâches indisponibles.</Text>
        </Card>
      ) : tasks.length === 0 ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Aucune tâche.</Text>
        </Card>
      ) : (
        <View style={styles.taskList}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </View>
      )}
    </Screen>
  );
}

function TaskRow({ task }: { task: ProjectTask }) {
  const s = taskStatusStyle(task.status);
  return (
    <Card style={styles.taskCard}>
      <View style={styles.taskTop}>
        <Text style={styles.taskName} numberOfLines={2}>
          {task.name}
        </Text>
        <Badge label={s.label} color={s.color} bg={s.bg} />
      </View>
      <View style={styles.taskMeta}>
        {task.phaseName ? <Text style={styles.muted}>{task.phaseName}</Text> : null}
        {task.estimatedHours != null ? (
          <Text style={styles.muted}>
            {formatHours(task.loggedHours ?? 0)} / {formatHours(task.estimatedHours)}
          </Text>
        ) : null}
      </View>
    </Card>
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
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  phaseName: { fontSize: typography.small, color: colors.text, flex: 1 },
  phaseProgress: {
    fontSize: typography.small,
    color: colors.textMuted,
    fontWeight: typography.weightMedium,
  },
  taskList: { gap: spacing.sm },
  taskCard: { gap: spacing.xs },
  taskTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  taskName: { flex: 1, fontSize: typography.small, color: colors.text },
  taskMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  muted: { fontSize: typography.tiny, color: colors.textMuted },
});
