/**
 * Liste des bons de travail : ticketNumber, serviceType (titre), statut,
 * client (résolu via clients.list), date de service, adresse (location).
 */
import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { workOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useClientMap } from '../../../src/api/useClientMap';
import { formatDate, workOrderStatusStyle } from '../../../src/lib/format';
import type { WorkOrderListItem } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

function WorkOrderRow({
  item,
  clientName,
  onPress,
}: {
  item: WorkOrderListItem;
  clientName: string;
  onPress: () => void;
}) {
  const status = workOrderStatusStyle(item.status);
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.rowTop}>
        <Text style={styles.number}>#{item.ticketNumber}</Text>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.serviceType || 'Bon de travail'}
      </Text>
      <View style={styles.metaLine}>
        <Ionicons name="business-outline" size={14} color={colors.textMuted} />
        <Text style={styles.meta} numberOfLines={1}>
          {clientName}
        </Text>
      </View>
      {item.location ? (
        <View style={styles.metaLine}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {item.location}
          </Text>
        </View>
      ) : null}
      {item.serviceDate ? (
        <View style={styles.metaLine}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatDate(item.serviceDate)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function WorkOrdersListScreen() {
  const router = useRouter();
  const { clientName } = useClientMap();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => workOrders.list(),
    [],
  );

  if (loading) return <LoadingState label="Chargement des bons…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={data ?? []}
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      renderItem={({ item }) => (
        <WorkOrderRow
          item={item}
          clientName={clientName(item.clientId)}
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
  meta: { fontSize: typography.small, color: colors.textMuted, flexShrink: 1 },
});
