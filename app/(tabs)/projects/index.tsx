/**
 * Liste des projets : nom, statut, client (clientName), avancement calculé
 * (_progress), nombre de tâches et heures (cumul / budget).
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
  const progress = item._progress ?? 0;
  const budgetHours = item._budgetHours ?? null;
  const loggedHours = item._hoursLogged ?? 0;
  return (
    <Card style={styles.card} onPress={onPress}>
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
      keyExtractor={(p) => String(p.id)}
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
