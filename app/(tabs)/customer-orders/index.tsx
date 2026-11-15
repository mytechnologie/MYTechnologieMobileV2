/**
 * Liste des commandes en cours.
 * La recherche part au serveur (client, notes, description, code QuickBooks,
 * numéro de facture), avec un court délai. « Toutes » n'envoie pas de statut.
 * Les autres puces envoient l'un des quatre statuts.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { customerOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { canCustomerOrder } from '../../../src/auth/access';
import {
  CUSTOMER_ORDER_STATUSES,
  type CustomerOrder,
  type CustomerOrderStatus,
} from '../../../src/api/types';
import {
  countCustomerOrdersByStatus,
  customerOrderStatusStyle,
  formatOrderDate,
  summarizeOrderLines,
} from '../../../src/lib/format';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Filter = CustomerOrderStatus | 'all';

const SEARCH_DELAY_MS = 300;

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipOn]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipText, selected && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

function OrderCard({ item, onPress }: { item: CustomerOrder; onPress: () => void }) {
  const status = customerOrderStatusStyle(item.status);
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.client} numberOfLines={1}>
          {item.clientName}
        </Text>
        <Badge label={status.label} color={status.color} bg={status.bg} />
      </View>
      <Text style={styles.summary} numberOfLines={2}>
        {summarizeOrderLines(item.lines)}
      </Text>
      <Text style={styles.date}>{formatOrderDate(item.orderDate)}</Text>
      {item.status === 'facture' && item.invoiceNumber ? (
        <Text style={styles.invoice}>Facture {item.invoiceNumber}</Text>
      ) : null}
    </Card>
  );
}

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = canCustomerOrder('create', user);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, loading, error, refetch, refreshing } = useQuery(async () => {
    const searchArg = search || undefined;
    // Comptes des quatre statuts : un appel sans status (toutes).
    const all = await customerOrders.list(searchArg ? { search: searchArg } : undefined);
    const counts = countCustomerOrdersByStatus(all);
    if (filter === 'all') return { rows: all, counts };
    const rows = await customerOrders.list({
      status: filter,
      ...(searchArg ? { search: searchArg } : {}),
    });
    return { rows, counts };
  }, [filter, search]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const visible = data?.rows ?? [];
  const counts = data?.counts ?? {
    nouveau: 0,
    envoye: 0,
    a_facturer: 0,
    facture: 0,
  };

  return (
    <CustomerOrdersList
      searchInput={searchInput}
      onSearch={setSearchInput}
      filter={filter}
      onFilter={setFilter}
      counts={counts}
      rows={visible}
      loading={loading && !data}
      errorMessage={error?.message ?? null}
      refreshing={refreshing}
      onRefresh={refetch}
      onRetry={refetch}
      search={search}
      canCreate={canCreate}
      onCreate={() => router.push('/(tabs)/customer-orders/new')}
      onOpen={(id) => router.push(`/(tabs)/customer-orders/${id}`)}
    />
  );
}

function CustomerOrdersList({
  searchInput,
  onSearch,
  filter,
  onFilter,
  counts,
  rows,
  loading,
  errorMessage,
  refreshing,
  onRefresh,
  onRetry,
  search,
  canCreate,
  onCreate,
  onOpen,
}: {
  searchInput: string;
  onSearch: (value: string) => void;
  filter: Filter;
  onFilter: (filter: Filter) => void;
  counts: Record<CustomerOrderStatus, number>;
  rows: CustomerOrder[];
  loading: boolean;
  errorMessage: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  search: string;
  canCreate: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchInput}
            onChangeText={onSearch}
            placeholder="Client, besoin ou n° de facture…"
            placeholderTextColor={colors.disabled}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Rechercher un client, un besoin ou un numéro de facture"
          />
        </View>
        <View style={styles.chips}>
          {CUSTOMER_ORDER_STATUSES.map((status) => {
            const label = customerOrderStatusStyle(status).label;
            return (
              <Chip
                key={status}
                label={`${label} · ${counts[status]}`}
                selected={filter === status}
                onPress={() => onFilter(status)}
              />
            );
          })}
          <Chip label="Toutes" selected={filter === 'all'} onPress={() => onFilter('all')} />
        </View>
      </View>

      <View style={styles.listWrap}>
        {loading ? (
          <LoadingState label="Chargement des commandes…" />
        ) : errorMessage ? (
          <ErrorState message={errorMessage} onRetry={onRetry} />
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(order) => order.id}
            contentContainerStyle={[styles.list, rows.length === 0 && styles.listEmpty]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <OrderCard item={item} onPress={() => onOpen(item.id)} />
            )}
            ListEmptyComponent={
              <EmptyState
                icon="clipboard-outline"
                title={emptyCopy(filter, search).title}
                message={emptyCopy(filter, search).message}
              />
            }
          />
        )}
      </View>

      {canCreate ? (
        <View style={styles.footer}>
          <Button
            title="+ Nouvelle commande"
            onPress={onCreate}
          />
        </View>
      ) : null}
    </View>
  );
}

function emptyCopy(filter: Filter, search: string) {
  if (search) {
    return {
      title: 'Aucun résultat',
      message: 'Aucune commande ne correspond à la recherche.',
    };
  }
  if (filter === 'nouveau') {
    return {
      title: 'Aucune commande nouvelle',
      message: 'Les commandes qui viennent d’être créées apparaîtront ici.',
    };
  }
  if (filter === 'envoye') {
    return {
      title: 'Aucune commande envoyée',
      message: 'Les commandes envoyées apparaîtront ici.',
    };
  }
  if (filter === 'a_facturer') {
    return {
      title: 'Rien à facturer',
      message: 'Aucune commande en attente de facturation.',
    };
  }
  if (filter === 'facture') {
    return {
      title: 'Aucune commande facturée',
      message: 'Les commandes marquées facturées apparaîtront ici.',
    };
  }
  return {
    title: 'Aucune commande',
    message: 'Les besoins des clients apparaîtront ici.',
  };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.body,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: {
    fontSize: typography.small,
    color: colors.text,
    fontWeight: typography.weightSemibold,
  },
  chipTextOn: { color: colors.textOnNavy },
  listWrap: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.md },
  listEmpty: { flexGrow: 1 },
  card: { gap: spacing.xs },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  client: {
    flex: 1,
    fontSize: typography.body,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  summary: { fontSize: typography.small, color: colors.text, lineHeight: 20 },
  date: { fontSize: typography.small, color: colors.textMuted },
  invoice: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.success,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
