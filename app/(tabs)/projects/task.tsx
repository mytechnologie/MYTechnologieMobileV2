/**
 * Détail d'une tâche/chambre de projet (terrain) :
 * - checklist cochable (toggle en direct),
 * - notes éditables (champ `details`) + sauvegarde,
 * - statut modifiable,
 * - photos : section signalée comme PRÉREQUIS BACKEND (voir note ci-dessous).
 *
 * ⚠️ Il n'existe AUCUN endpoint/table de photos pour les tâches projet
 * (contrairement aux bons de travail). Un vrai upload nécessite côté backend :
 *   - une table `project_task_photos` (calquée sur work_order_photos),
 *   - une route REST `POST /api/project-tasks/:id/photos` (calquée sur
 *     `/api/work-orders/:id/photos`) + get/delete.
 * À créer sur le repo web AVANT de câbler le mobile. On ne bricole pas ici.
 *
 * Pas de getter de tâche unique côté backend : on charge l'arbre
 * (projectTasks.list) et on retrouve la tâche par id.
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  SectionTitle,
  TextField,
} from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { projectTasks } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { taskPriorityStyle, taskStatusStyle } from '../../../src/lib/format';
import type {
  ProjectTask,
  ProjectTaskChecklistItem,
  ProjectTaskStatus,
} from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

const STATUS_OPTIONS: ProjectTaskStatus[] = [
  'à_faire',
  'en_cours',
  'bloquée',
  'terminée',
];

/** Retrouve une tâche par id dans l'arbre (racines + sous-tâches). */
function findTask(tasks: ProjectTask[], id: number): ProjectTask | null {
  for (const t of tasks) {
    if (t.id === id) return t;
    const inChild = t.children?.length ? findTask(t.children, id) : null;
    if (inChild) return inChild;
  }
  return null;
}

export default function ProjectTaskScreen() {
  const { projectId, taskId } = useLocalSearchParams<{
    projectId: string;
    taskId: string;
  }>();
  const navigation = useNavigation();
  const pid = String(projectId);
  const tid = Number(taskId);

  const tasksQ = useQuery(() => projectTasks.listByProject(pid), [pid]);
  const saveNotes = useMutation(projectTasks.update);

  const task = useMemo(
    () => (tasksQ.data ? findTask(tasksQ.data, tid) : null),
    [tasksQ.data, tid],
  );

  const [checklist, setChecklist] = useState<ProjectTaskChecklistItem[]>([]);
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ProjectTaskStatus>('à_faire');
  const [pendingItem, setPendingItem] = useState<number | null>(null);
  const initedFor = useRef<number | null>(null);

  // Initialise l'état local une fois la tâche trouvée.
  useEffect(() => {
    if (task && initedFor.current !== task.id) {
      initedFor.current = task.id;
      setChecklist(task.checklistItems ?? []);
      setNotes(task.details ?? '');
      setStatus(task.status);
    }
  }, [task]);

  useEffect(() => {
    if (task?.title) navigation.setOptions({ title: task.title });
  }, [navigation, task?.title]);

  if (tasksQ.loading) return <LoadingState label="Chargement de la tâche…" />;
  if (tasksQ.error) {
    return <ErrorState message={tasksQ.error.message} onRetry={tasksQ.refetch} />;
  }
  if (!task) {
    return <ErrorState message="Tâche introuvable." onRetry={tasksQ.refetch} />;
  }

  const toggleItem = async (item: ProjectTaskChecklistItem) => {
    const next = !item.isCompleted;
    setPendingItem(item.id);
    // Optimiste.
    setChecklist((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, isCompleted: next } : c)),
    );
    try {
      await projectTasks.toggleChecklistItem({
        projectId: pid,
        taskId: task.id,
        itemId: item.id,
        isCompleted: next,
      });
    } catch (e) {
      // Rollback.
      setChecklist((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isCompleted: !next } : c)),
      );
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setPendingItem(null);
    }
  };

  const persist = async (patch: { details?: string | null; status?: ProjectTaskStatus }) => {
    try {
      await saveNotes.mutate({ taskId: task.id, projectId: pid, ...patch });
      tasksQ.refetch();
      return true;
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
      return false;
    }
  };

  const onSaveNotes = () => void persist({ details: notes.trim() || null });

  const onChangeStatus = async (next: ProjectTaskStatus) => {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    const ok = await persist({ status: next });
    if (!ok) setStatus(prev);
  };

  const s = taskStatusStyle(task.status);
  const p = taskPriorityStyle(task.priority);
  const doneCount = checklist.filter((c) => c.isCompleted).length;

  return (
    <Screen scroll refreshing={tasksQ.refreshing} onRefresh={tasksQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{task.title}</Text>
          <Badge label={s.label} color={s.color} bg={s.bg} />
        </View>
        <View style={styles.tags}>
          <Badge label={p.label} color={p.color} bg={p.bg} />
          {task.spaceLabel ? <Text style={styles.muted}>{task.spaceLabel}</Text> : null}
        </View>
        {task.description ? (
          <Text style={styles.desc}>{task.description}</Text>
        ) : null}
      </Card>

      {/* Statut */}
      <SectionTitle>Statut</SectionTitle>
      <View style={styles.statusGrid}>
        {STATUS_OPTIONS.map((opt) => {
          const os = taskStatusStyle(opt);
          const active = opt === status;
          return (
            <Pressable
              key={opt}
              disabled={saveNotes.loading || active}
              onPress={() => void onChangeStatus(opt)}
              style={({ pressed }) => [
                styles.statusChip,
                { borderColor: active ? os.color : colors.border },
                active && { backgroundColor: os.bg },
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.statusChipText, { color: active ? os.color : colors.text }]}>
                {os.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Checklist */}
      <SectionTitle>
        Checklist{checklist.length > 0 ? ` (${doneCount}/${checklist.length})` : ''}
      </SectionTitle>
      <Card style={styles.block}>
        {checklist.length === 0 ? (
          <Text style={styles.muted}>Aucun élément de checklist.</Text>
        ) : (
          checklist
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((item) => (
              <Pressable
                key={item.id}
                style={styles.checkRow}
                onPress={() => void toggleItem(item)}
                disabled={pendingItem === item.id}
              >
                <Ionicons
                  name={item.isCompleted ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={item.isCompleted ? colors.success : colors.textMuted}
                />
                <Text
                  style={[styles.checkLabel, item.isCompleted && styles.checkLabelDone]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))
        )}
      </Card>

      {/* Notes terrain (details) */}
      <SectionTitle>Notes</SectionTitle>
      <Card style={styles.block}>
        <TextField
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes de terrain…"
          multiline
          style={styles.multiline}
        />
        <Button title="Enregistrer les notes" onPress={onSaveNotes} loading={saveNotes.loading} />
      </Card>

      {/* Photos — prérequis backend */}
      <SectionTitle>Photos</SectionTitle>
      <Card style={styles.block}>
        <View style={styles.prereq}>
          <Ionicons name="information-circle-outline" size={20} color={colors.info} />
          <Text style={styles.prereqText}>
            Les photos de tâche nécessitent un endpoint backend (table
            project_task_photos + route POST /api/project-tasks/:id/photos, calquée
            sur les bons de travail). À créer côté serveur avant activation ici.
          </Text>
        </View>
      </Card>
    </Screen>
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
  tags: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  desc: { fontSize: typography.small, color: colors.text, lineHeight: 20 },
  muted: { fontSize: typography.tiny, color: colors.textMuted },
  block: { marginBottom: spacing.lg },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },

  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  statusChipText: { fontSize: typography.small, fontWeight: typography.weightSemibold },
  pressed: { opacity: 0.7 },

  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkLabel: { flex: 1, fontSize: typography.small, color: colors.text },
  checkLabelDone: { color: colors.textMuted, textDecorationLine: 'line-through' },

  prereq: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  prereqText: { flex: 1, fontSize: typography.small, color: colors.textMuted, lineHeight: 18 },
});
