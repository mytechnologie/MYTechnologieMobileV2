/**
 * Liste des projets (admin/manager) : statut, client, avancement.
 */
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  Badge,
  Card,
  ProgressBar,
} from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { projects as projectsApi } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { projectStatusStyle } from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import type { ProjectListItem } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

function ProjectRow({ item, onPress }: { item: ProjectListItem; onPress: () => void }) {
  const status = projectStatusStyle(item.status);
  const progress = item.progress ?? 0;
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </View>
      {item.client ? (
        <View style={styles.metaLine}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{item.client}</Text>
        </View>
      ) : null}

      <View style={styles.progressRow}>
        <ProgressBar value={progress} />
        <Text style={styles.progressText}>{Math.round(progress)} %</Text>
      </View>

      {item.budgetHours != null ? (
        <Text style={styles.hours}>
          {formatHours(item.spentHours ?? 0)} / {formatHours(item.budgetHours)}
        </Text>
      ) : null}
    </Card>
  );
}

export default function ProjectsListScreen() {
  const router = useRouter();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => projectsApi.list(),
    [],
  );

  if (loading) return <LoadingState label="Chargement des projets…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <ProjectRow
          item={item}
          onPress={() => router.push(`/(tabs)/projects/${item.id}`)}
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

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.sm },
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
  meta: { fontSize: typography.small, color: colors.textMuted },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  progressText: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    width: 44,
    textAlign: 'right',
  },
  hours: { fontSize: typography.tiny, color: colors.textMuted },
});
