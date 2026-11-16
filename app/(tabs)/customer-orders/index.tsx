/**
 * Liste des commandes en cours.
 * La recherche part au serveur (client, notes, description, code QuickBooks),
 * avec un court délai. « Toutes » n'envoie pas de statut : list() sans filtre
 * de statut renvoie les deux. Les autres puces envoient status.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { keyboardDismissMode } from '../../../src/lib/keyboard';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { customerOrders } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { canCustomerOrder } from '../../../src/auth/access';
import type { CustomerOrder, CustomerOrderStatus } from '../../../src/api/types';
import {
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
    </Card>
  );
}

export default function CustomerOrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const canCreate = canCustomerOrder('create', user);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('a_facturer');

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, loading, error, refetch, refreshing } = useQuery(async () => {
    const searchArg = search || undefined;
    // Comptes des deux statuts : un appel sans status (tous).
    const all = await customerOrders.list(searchArg ? { search: searchArg } : undefined);
    const pending = all.filter((order) => order.status === 'a_facturer').length;
    const billed = all.filter((order) => order.status === 'facture').length;
    if (filter === 'all') return { rows: all, pending, billed };
    const rows = await customerOrders.list({
      status: filter,
      ...(searchArg ? { search: searchArg } : {}),
    });
    return { rows, pending, billed };
  }, [filter, search]);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const visible = data?.rows ?? [];
  const pendingCount = data?.pending ?? 0;
  const billedCount = data?.billed ?? 0;

  const emptyCopy = () => {
    if (search) {
      return {
        title: 'Aucun résultat',
        message: 'Aucune commande ne correspond à la recherche.',
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
  };

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={searchInput}
            onChangeText={setSearchInput}
            placeholder="Rechercher un client ou un besoin…"
            placeholderTextColor={colors.disabled}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            accessibilityLabel="Rechercher un client ou un besoin"
          />
        </View>
        <View style={styles.chips}>
          <Chip
            label={`À facturer · ${pendingCount}`}
            selected={filter === 'a_facturer'}
            onPress={() => setFilter('a_facturer')}
          />
          <Chip
            label={`Facturé · ${billedCount}`}
            selected={filter === 'facture'}
            onPress={() => setFilter('facture')}
          />
          <Chip label="Toutes" selected={filter === 'all'} onPress={() => setFilter('all')} />
        </View>
      </View>

      <View style={styles.listWrap}>
        {loading && !data ? (
          <LoadingState label="Chargement des commandes…" />
        ) : error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(order) => order.id}
            contentContainerStyle={[styles.list, visible.length === 0 && styles.listEmpty]}
            onRefresh={refetch}
            refreshing={refreshing}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardDismissMode}
            renderItem={({ item }) => (
              <OrderCard
                item={item}
                onPress={() => router.push(`/(tabs)/customer-orders/${item.id}`)}
              />
            )}
            ListEmptyComponent={
              <EmptyState icon="clipboard-outline" title={emptyCopy().title} message={emptyCopy().message} />
            }
          />
        )}
      </View>

      {canCreate ? (
        <View style={styles.footer}>
          <Button
            title="+ Nouvelle commande"
            onPress={() => router.push('/(tabs)/customer-orders/new')}
          />
        </View>
      ) : null}
    </View>
  );
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
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
});
