/**
 * Liste des bons de travail (admin/manager) : numéro, titre, client, statut, date.
 */
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { workOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { formatDate, workOrderStatusStyle } from '../../../src/lib/format';
import type { WorkOrderListItem } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

function WorkOrderRow({
  item,
  onPress,
}: {
  item: WorkOrderListItem;
  onPress: () => void;
}) {
  const status = workOrderStatusStyle(item.status);
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.number}>#{item.number}</Text>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.client ? (
        <View style={styles.metaLine}>
          <Ionicons name="business-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{item.client}</Text>
        </View>
      ) : null}
      {item.scheduledDate ? (
        <View style={styles.metaLine}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatDate(item.scheduledDate)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function WorkOrdersListScreen() {
  const router = useRouter();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => workOrders.list(),
    [],
  );

  if (loading) return <LoadingState label="Chargement des bons…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(w) => w.id}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <WorkOrderRow
          item={item}
          onPress={() => router.push(`/(tabs)/work-orders/${item.id}`)}
        />
      )}
      ListEmptyComponent={
        <EmptyState
          icon="construct-outline"
          title="Aucun bon de travail"
          message="Aucun bon à afficher pour le moment."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.xs },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  number: {
    fontSize: typography.small,
    fontWeight: typography.weightBold,
    color: colors.navy,
  },
  title: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: typography.small, color: colors.textMuted },
});
