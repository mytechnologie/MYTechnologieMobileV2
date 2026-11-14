/**
 * Détail d'une commande : besoin (lignes), notes, passage à « Facturé »
 * et retour à « À facturer ». La suppression est volontairement discrète.
 */
import { useCallback } from 'react';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Badge, Button, Card, SectionTitle } from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { customerOrders } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { canCustomerOrder, canUpdateCustomerOrder } from '../../../src/auth/access';
import type { CustomerOrder, CustomerOrderStatus } from '../../../src/api/types';
import {
  customerOrderStatusStyle,
  formatOrderDate,
  formatQuantity,
} from '../../../src/lib/format';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function CustomerOrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = String(id ?? '');
  const { user } = useAuth();
  const canSetStatus = canCustomerOrder('setStatus', user);
  const canDelete = canCustomerOrder('delete', user);
  const q = useQuery(() => customerOrders.get(orderId), [orderId]);
  const setStatus = useMutation(customerOrders.setStatus);
  const remove = useMutation(customerOrders.delete);

  useFocusEffect(
    useCallback(() => {
      q.refetch();
    }, [q.refetch]),
  );

  const order = q.data;

  const changeStatus = async (status: CustomerOrderStatus) => {
    try {
      await setStatus.mutate({ id: orderId, status });
      q.refetch();
    } catch (e) {
      Alert.alert(
        'Statut',
        e instanceof Error ? e.message : 'Impossible de modifier le statut.',
      );
    }
  };

  const askDelete = () => {
    Alert.alert(
      'Supprimer la commande',
      order ? `Supprimer la commande de ${order.clientName} ?` : 'Supprimer cette commande ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await remove.mutate(orderId);
                router.back();
              } catch (e) {
                Alert.alert(
                  'Suppression',
                  e instanceof Error ? e.message : 'Impossible de supprimer la commande.',
                );
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['left', 'right']} padded={false}>
      <Stack.Screen options={{ title: order?.clientName ?? 'Commande' }} />
      {q.loading && !order ? (
        <LoadingState label="Chargement de la commande…" />
      ) : q.error || !order ? (
        <ErrorState message={q.error?.message ?? 'Cette commande est introuvable.'} onRetry={q.refetch} />
      ) : (
        <OrderBody
          order={order}
          refreshing={q.refreshing}
          onRefresh={q.refetch}
          statusLoading={setStatus.loading}
          onStatus={canSetStatus ? changeStatus : undefined}
          onEdit={
            canUpdateCustomerOrder(user, order)
              ? () =>
                  router.push({
                    pathname: '/(tabs)/customer-orders/new',
                    params: { orderId },
                  })
              : undefined
          }
          deleteLoading={remove.loading}
          onDelete={canDelete ? askDelete : undefined}
        />
      )}
    </Screen>
  );
}

function OrderBody({
  order,
  refreshing,
  onRefresh,
  statusLoading,
  onStatus,
  onEdit,
  deleteLoading,
  onDelete,
}: {
  order: CustomerOrder;
  refreshing: boolean;
  onRefresh: () => void;
  statusLoading: boolean;
  onStatus?: (status: CustomerOrderStatus) => void;
  onEdit?: () => void;
  deleteLoading: boolean;
  onDelete?: () => void;
}) {
  const status = customerOrderStatusStyle(order.status);
  const billed = order.status === 'facture';
  const showFooter = !!onStatus || !!onEdit || !!onDelete;

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.navy}
            colors={[colors.navy]}
          />
        }
      >
        <View style={styles.metaRow}>
          <Text style={styles.date}>{formatOrderDate(order.orderDate)}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>

        <SectionTitle>Besoin</SectionTitle>
        <Card style={styles.block}>
          {order.lines.length === 0 ? (
            <Text style={styles.muted}>Aucun article indiqué.</Text>
          ) : (
            order.lines.map((line, index) => (
              <View
                key={line.id}
                style={[styles.line, index === order.lines.length - 1 && styles.lineLast]}
              >
                <View style={styles.lineMain}>
                  <Text style={styles.description}>{line.description}</Text>
                  {line.qbProductCode ? (
                    <Text style={styles.code}>{line.qbProductCode}</Text>
                  ) : (
                    <Text style={styles.noCode}>Pas de code QuickBooks</Text>
                  )}
                </View>
                <Text style={styles.qty}>Qté {formatQuantity(line.quantity)}</Text>
              </View>
            ))
          )}
        </Card>

        <SectionTitle>Notes</SectionTitle>
        <Card>
          <Text style={order.notes?.trim() ? styles.notes : styles.muted}>
            {order.notes?.trim() ? order.notes : 'Aucune note.'}
          </Text>
        </Card>
      </ScrollView>

      {showFooter ? (
        <View style={styles.footer}>
          {onStatus ? (
            billed ? (
              <Button
                title="Remettre à facturer"
                variant="secondary"
                loading={statusLoading}
                onPress={() => onStatus('a_facturer')}
              />
            ) : (
              <Button
                title="Marquer facturé"
                variant="gold"
                loading={statusLoading}
                onPress={() => onStatus('facture')}
              />
            )
          ) : null}
          {onEdit || onDelete ? (
            <View style={styles.quietRow}>
              {onEdit ? (
                <Pressable onPress={onEdit} style={styles.deleteBtn} accessibilityRole="button">
                  <Text style={styles.editText}>Modifier</Text>
                </Pressable>
              ) : null}
              {onDelete ? (
                <Pressable
                  onPress={onDelete}
                  disabled={deleteLoading}
                  style={styles.deleteBtn}
                  accessibilityRole="button"
                >
                  <Text style={styles.deleteText}>
                    {deleteLoading ? 'Suppression…' : 'Supprimer'}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.md },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  date: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  block: { marginBottom: spacing.lg },
  line: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  lineLast: { borderBottomWidth: 0 },
  lineMain: { flex: 1 },
  description: {
    fontSize: typography.body,
    color: colors.text,
    fontWeight: typography.weightMedium,
  },
  qty: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.navy,
  },
  code: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    fontFamily: typography.fontMono,
    fontSize: typography.tiny,
    color: colors.navy,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  noCode: {
    marginTop: spacing.xs,
    fontSize: typography.tiny,
    color: colors.textMuted,
  },
  notes: { fontSize: typography.body, color: colors.text, lineHeight: 22 },
  muted: { fontSize: typography.small, color: colors.textMuted },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  quietRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl },
  deleteBtn: { alignItems: 'center', paddingVertical: spacing.xs },
  editText: {
    color: colors.navy,
    fontSize: typography.small,
    fontWeight: typography.weightMedium,
  },
  deleteText: {
    color: colors.danger,
    fontSize: typography.small,
    fontWeight: typography.weightMedium,
  },
});
