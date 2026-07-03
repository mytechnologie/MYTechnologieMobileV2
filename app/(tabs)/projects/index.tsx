/**
 * Projets — adaptatif :
 * - téléphone : liste qui navigue vers le détail (pile),
 * - iPad (large) : master-détail (liste à gauche, détail projet à droite avec
 *   plans + arbre de tâches), réutilisant la vue partagée ProjectDetailView.
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card, ProgressBar } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { MasterDetail } from '../../../src/components/MasterDetail';
import { ProjectDetailView } from '../../../src/views/ProjectDetailView';
import { projects as projectsApi } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useResponsive } from '../../../src/lib/responsive';
import { projectStatusStyle } from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import type { ProjectListItem } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

function ProjectRow({
  item,
  selected,
  onPress,
}: {
  item: ProjectListItem;
  selected: boolean;
  onPress: () => void;
}) {
  const status = projectStatusStyle(item.status);
  const progress = item._progress ?? 0;
  const budgetHours = item._budgetHours ?? null;
  const loggedHours = item._hoursLogged ?? 0;
  return (
    <Card style={selected ? { ...styles.card, ...styles.cardSelected } : styles.card} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </View>
      {item.clientName ? (
        <View style={styles.metaLine}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {item.clientName}
          </Text>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        <ProgressBar value={progress} />
        <Text style={styles.progressText}>{Math.round(progress)} %</Text>
      </View>

      <View style={styles.footer}>
        {item._taskCount != null ? (
          <Text style={styles.meta}>
            {item._doneCount ?? 0}/{item._taskCount} tâches
          </Text>
        ) : (
          <View />
        )}
        {budgetHours != null ? (
          <Text style={styles.meta}>
            {formatHours(loggedHours)} / {formatHours(budgetHours)}
            {item._hoursPct != null ? ` · ${item._hoursPct} %` : ''}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/** Liste réutilisable (téléphone plein écran OU panneau maître iPad). */
function ProjectsList({
  selectedId,
  onSelect,
}: {
  selectedId?: string | null;
  onSelect: (id: string) => void;
}) {
  const { data, loading, error, refetch, refreshing } = useQuery(() => projectsApi.list(), []);

  if (loading) return <LoadingState label="Chargement des projets…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <ProjectRow
          item={item}
          selected={selectedId === String(item.id)}
          onPress={() => onSelect(String(item.id))}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="briefcase-outline"
          title="Aucun projet"
          message="Aucun projet à afficher pour le moment."
        />
      }
    />
  );
}

export default function ProjectsScreen() {
  const router = useRouter();
  const { twoPane } = useResponsive();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (twoPane) {
    return (
      <MasterDetail
        master={<ProjectsList selectedId={selectedId} onSelect={setSelectedId} />}
        detail={selectedId ? <ProjectDetailView id={selectedId} embedded /> : null}
        empty={{ icon: 'briefcase-outline', message: 'Sélectionnez un projet.' }}
      />
    );
  }

  return <ProjectsList onSelect={(id) => router.push(`/projects/${id}`)} />;
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.sm },
  cardSelected: { borderColor: colors.navy, borderWidth: 2 },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: typography.small, color: colors.textMuted, flexShrink: 1 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    width: 44,
    textAlign: 'right',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
