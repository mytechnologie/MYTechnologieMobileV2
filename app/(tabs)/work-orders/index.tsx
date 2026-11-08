/**
 * Bons de travail — adaptatif (repris de la branche iPad) :
 * - téléphone : liste qui navigue vers le détail ; « Nouveau bon » ouvre la
 *   route de création ;
 * - iPad (large) : master-détail (liste à gauche, détail ou création à droite),
 *   avec les MÊMES vues partagées que le téléphone.
 * « Nouveau bon » n'apparaît que pour les rôles élevés ; le portail applique de
 * toute façon la permission work_orders.create.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { MasterDetail } from '../../../src/components/MasterDetail';
import { WorkOrderCreateView } from '../../../src/views/WorkOrderCreateView';
import { WorkOrderDetailView } from '../../../src/views/WorkOrderDetailView';
import { workOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { isElevated } from '../../../src/auth/access';
import { useResponsive } from '../../../src/lib/responsive';
import { formatDate, workOrderStatusStyle } from '../../../src/lib/format';
import type { WorkOrderListItem } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

function WorkOrderRow({
  item,
  selected,
  onPress,
}: {
  item: WorkOrderListItem;
  selected: boolean;
  onPress: () => void;
}) {
  const status = workOrderStatusStyle(item.status);
  return (
    <Card style={[styles.card, selected && styles.cardSelected]} onPress={onPress}>
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
          <Text style={styles.meta} numberOfLines={1}>
            {item.client}
          </Text>
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

function WorkOrdersList({
  selectedId,
  onSelect,
  canCreate,
  onCreate,
  reloadToken,
}: {
  selectedId?: string | null;
  onSelect: (id: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  reloadToken: number;
}) {
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => workOrders.list(),
    [reloadToken],
  );

  // Retour sur l'écran (après une création ou un changement de statut).
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
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
      ListHeaderComponent={
        canCreate ? (
          <Pressable style={styles.newBtn} onPress={onCreate} accessibilityRole="button">
            <Ionicons name="add-circle" size={20} color={colors.textOnNavy} />
            <Text style={styles.newBtnText}>Nouveau bon de travail</Text>
          </Pressable>
        ) : null
      }
      renderItem={({ item }) => (
        <WorkOrderRow item={item} selected={selectedId === item.id} onPress={() => onSelect(item.id)} />
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

export default function WorkOrdersScreen() {
  const router = useRouter();
  const { twoPane } = useResponsive();
  const { user } = useAuth();
  const canCreate = !!user && isElevated(user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  if (twoPane) {
    return (
      <MasterDetail
        master={
          <WorkOrdersList
            selectedId={creating ? null : selectedId}
            onSelect={id => {
              setCreating(false);
              setSelectedId(id);
            }}
            canCreate={canCreate}
            onCreate={() => {
              setSelectedId(null);
              setCreating(true);
            }}
            reloadToken={reloadToken}
          />
        }
        detail={
          creating ? (
            <WorkOrderCreateView
              embedded
              onCreated={id => {
                setReloadToken(t => t + 1);
                setCreating(false);
                setSelectedId(String(id));
              }}
              onCancel={() => setCreating(false)}
            />
          ) : selectedId ? (
            <WorkOrderDetailView key={selectedId} id={selectedId} embedded />
          ) : null
        }
        empty={{ icon: 'construct-outline', message: 'Sélectionnez un bon de travail.' }}
      />
    );
  }

  return (
    <WorkOrdersList
      onSelect={id => router.push(`/(tabs)/work-orders/${id}`)}
      canCreate={canCreate}
      onCreate={() => router.push('/(tabs)/work-orders/new')}
      reloadToken={reloadToken}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.xs },
  cardSelected: { borderColor: colors.navy, borderWidth: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { fontSize: typography.small, fontWeight: typography.weightBold, color: colors.navy },
  title: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: typography.small, color: colors.textMuted, flexShrink: 1 },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: 50,
  },
  newBtnText: { color: colors.textOnNavy, fontSize: typography.body, fontWeight: typography.weightSemibold },
});
