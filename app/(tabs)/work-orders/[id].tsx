/**
 * Détail d'un bon de travail : informations, description du problème, actions
 * réalisées, suivi, et changement de statut (workflow réel).
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Badge,
  Card,
  InfoRow,
  SectionTitle,
} from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { workOrders } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { useClientMap } from '../../../src/api/useClientMap';
import {
  WORK_ORDER_STATUS_OPTIONS,
  formatDate,
  workOrderStatusStyle,
} from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import type { WorkOrderStatus } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const workOrderId = String(id);
  const { clientName } = useClientMap();

  const woQ = useQuery(() => workOrders.getById(workOrderId), [workOrderId]);
  const changeStatus = useMutation(workOrders.changeStatus);

  useEffect(() => {
    if (woQ.data?.ticketNumber) {
      navigation.setOptions({ title: `Bon #${woQ.data.ticketNumber}` });
    }
  }, [navigation, woQ.data?.ticketNumber]);

  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(null);

  if (woQ.loading) return <LoadingState label="Chargement du bon…" />;
  if (woQ.error || !woQ.data) {
    return <ErrorState message={woQ.error?.message} onRetry={woQ.refetch} />;
  }

  const wo = woQ.data;
  const status = workOrderStatusStyle(wo.status);

  const applyStatus = (next: WorkOrderStatus) => {
    if (next === wo.status) return;
    Alert.alert(
      'Changer le statut',
      `Passer le bon au statut « ${workOrderStatusStyle(next).label} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setPendingStatus(next);
            try {
              await changeStatus.mutate({ id: workOrderId, status: next });
              woQ.refetch();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error ? e.message : 'Changement de statut impossible.',
              );
            } finally {
              setPendingStatus(null);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll refreshing={woQ.refreshing} onRefresh={woQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{wo.serviceType || 'Bon de travail'}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        <Text style={styles.number}>#{wo.ticketNumber}</Text>
      </Card>

      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.block}>
        <InfoRow label="Client" value={clientName(wo.clientId)} />
        {wo.location ? <InfoRow label="Adresse" value={wo.location} /> : null}
        {wo.serviceDate ? (
          <InfoRow label="Date de service" value={formatDate(wo.serviceDate)} />
        ) : null}
        {wo.durationMinutes != null ? (
          <InfoRow label="Durée" value={formatHours(wo.durationMinutes / 60)} />
        ) : null}
      </Card>

      {wo.problemDescription ? (
        <>
          <SectionTitle>Problème rapporté</SectionTitle>
          <Card style={styles.block}>
            <Text style={styles.body}>{wo.problemDescription}</Text>
          </Card>
        </>
      ) : null}

      {wo.actionsTaken ? (
        <>
          <SectionTitle>Actions réalisées</SectionTitle>
          <Card style={styles.block}>
            <Text style={styles.body}>{wo.actionsTaken}</Text>
          </Card>
        </>
      ) : null}

      {wo.followUp ? (
        <>
          <SectionTitle>Suivi</SectionTitle>
          <Card style={styles.block}>
            <Text style={styles.body}>{wo.followUp}</Text>
          </Card>
        </>
      ) : null}

      <SectionTitle>Changer le statut</SectionTitle>
      <View style={styles.statusGrid}>
        {WORK_ORDER_STATUS_OPTIONS.map((opt) => {
          const s = workOrderStatusStyle(opt);
          const active = opt === wo.status;
          const busy = pendingStatus === opt;
          return (
            <Pressable
              key={opt}
              disabled={changeStatus.loading || active}
              onPress={() => applyStatus(opt)}
              style={({ pressed }) => [
                styles.statusChip,
                { borderColor: active ? s.color : colors.border },
                active && { backgroundColor: s.bg },
                pressed && styles.pressed,
                changeStatus.loading && !busy && styles.dim,
              ]}
            >
              <Text
                style={[
                  styles.statusChipText,
                  { color: active ? s.color : colors.text },
                ]}
              >
                {busy ? '…' : s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.lg, gap: spacing.xs },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  number: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.navy,
  },
  block: { marginBottom: spacing.lg },
  body: { fontSize: typography.small, color: colors.text, lineHeight: 20 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  statusChipText: { fontSize: typography.small, fontWeight: typography.weightSemibold },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
});
