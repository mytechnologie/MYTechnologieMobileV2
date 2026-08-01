/**
 * Bons de travail — adaptatif :
 * - téléphone : liste qui navigue vers le détail (pile) ; « + Nouveau » ouvre la
 *   route de création,
 * - iPad (large) : master-détail plein écran (liste à gauche, détail éditable OU
 *   création à droite), en réutilisant les MÊMES vues partagées.
 *
 * « + Nouveau » n'est visible que pour les rôles élevés (admin/manager/super_admin) ;
 * le backend applique de toute façon la permission `work_orders.create`.
 */
import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { MasterDetail } from '../../../src/components/MasterDetail';
import { WorkOrderDetailView } from '../../../src/views/WorkOrderDetailView';
import { WorkOrderCreateView } from '../../../src/views/WorkOrderCreateView';
import { workOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useClientMap } from '../../../src/api/useClientMap';
import { useAuth } from '../../../src/auth/AuthContext';
import { isElevated } from '../../../src/auth/access';
import { useResponsive } from '../../../src/lib/responsive';
import { formatDate, workOrderStatusStyle } from '../../../src/lib/format';
import type { WorkOrderListItem } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

function WorkOrderRow({
  item,
  clientName,
  selected,
  onPress,
}: {
  item: WorkOrderListItem;
  clientName: string;
  selected: boolean;
  onPress: () => void;
}) {
  const status = workOrderStatusStyle(item.status);
  return (
    <Card style={selected ? { ...styles.card, ...styles.cardSelected } : styles.card} onPress={onPress}>
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
      {item.serviceDate ? (
        <View style={styles.metaLine}>
          <Ionicons name="calendar-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta}>{formatDate(item.serviceDate)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** En-tête de liste : bouton « + Nouveau bon de travail » (rôles élevés). */
function NewWorkOrderButton({ onPress, active }: { onPress: () => void; active?: boolean }) {
  return (
    <Pressable
      style={[styles.newBtn, active && styles.newBtnActive]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name="add-circle" size={20} color={colors.textOnNavy} />
      <Text style={styles.newBtnText}>Nouveau bon de travail</Text>
    </Pressable>
  );
}

/** Liste réutilisable (téléphone plein écran OU panneau maître iPad). */
function WorkOrdersList({
  selectedId,
  onSelect,
  canCreate,
  onCreate,
  creatingActive,
  reloadToken,
}: {
  selectedId?: string | null;
  onSelect: (id: string) => void;
  canCreate: boolean;
  onCreate: () => void;
  creatingActive?: boolean;
  reloadToken: number;
}) {
  const { clientName } = useClientMap();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => workOrders.list(),
    [reloadToken],
  );

  // Rafraîchir en revenant sur l'écran (ex. après création depuis la route).
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
      keyExtractor={(w) => String(w.id)}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      ListHeaderComponent={
        canCreate ? <NewWorkOrderButton onPress={onCreate} active={creatingActive} /> : null
      }
      renderItem={({ item }) => (
        <WorkOrderRow
          item={item}
          clientName={clientName(item.clientId)}
          selected={selectedId === String(item.id)}
          onPress={() => onSelect(String(item.id))}
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

export default function WorkOrdersScreen() {
  const router = useRouter();
  const { twoPane } = useResponsive();
  const { user } = useAuth();
  const canCreate = !!user && isElevated(user);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const handleCreated = (id: number) => {
    setReloadToken((t) => t + 1);
    setCreating(false);
    setSelectedId(String(id));
  };

  if (twoPane) {
    return (
      <MasterDetail
        master={
          <WorkOrdersList
            selectedId={creating ? null : selectedId}
            onSelect={(id) => {
              setCreating(false);
              setSelectedId(id);
            }}
            canCreate={canCreate}
            creatingActive={creating}
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
              onCreated={handleCreated}
              onCancel={() => setCreating(false)}
            />
          ) : selectedId ? (
            <WorkOrderDetailView id={selectedId} embedded />
          ) : null
        }
        empty={{ icon: 'construct-outline', message: 'Sélectionnez un bon de travail.' }}
      />
    );
  }

  return (
    <WorkOrdersList
      onSelect={(id) => router.push(`/work-orders/${id}`)}
      canCreate={canCreate}
      onCreate={() => router.push('/work-orders/new')}
      reloadToken={reloadToken}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.xs },
  cardSelected: { borderColor: colors.navy, borderWidth: 2 },
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

  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    minHeight: 50,
    marginBottom: spacing.xs,
  },
  newBtnActive: { opacity: 0.85 },
  newBtnText: {
    color: colors.textOnNavy,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
  },
});
