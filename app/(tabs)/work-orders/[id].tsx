/**
 * Détail d'un bon de travail : infos, équipement, photos, changement de statut.
 */
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import {
  WORK_ORDER_STATUS_OPTIONS,
  formatDate,
  workOrderStatusStyle,
} from '../../../src/lib/format';
import type { WorkOrderStatus } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

export default function WorkOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const workOrderId = String(id);

  const woQ = useQuery(() => workOrders.getById(workOrderId), [workOrderId]);
  const changeStatus = useMutation(workOrders.changeStatus);

  useEffect(() => {
    if (woQ.data?.number) {
      navigation.setOptions({ title: `Bon #${woQ.data.number}` });
    }
  }, [navigation, woQ.data?.number]);

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

  const photos = wo.photos ?? [];

  return (
    <Screen scroll refreshing={woQ.refreshing} onRefresh={woQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{wo.title}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        <Text style={styles.number}>#{wo.number}</Text>
        {wo.description ? <Text style={styles.desc}>{wo.description}</Text> : null}
      </Card>

      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.block}>
        {wo.client ? <InfoRow label="Client" value={wo.client} /> : null}
        {wo.address ? <InfoRow label="Adresse" value={wo.address} /> : null}
        {wo.scheduledDate ? (
          <InfoRow label="Planifié" value={formatDate(wo.scheduledDate)} />
        ) : null}
        {wo.equipment ? <InfoRow label="Équipement" value={wo.equipment} /> : null}
        {wo.contactName ? <InfoRow label="Contact" value={wo.contactName} /> : null}
        {wo.contactPhone ? <InfoRow label="Téléphone" value={wo.contactPhone} /> : null}
      </Card>

      {/* Photos */}
      <SectionTitle>Photos</SectionTitle>
      {photos.length === 0 ? (
        <Card style={styles.block}>
          <Text style={styles.muted}>Aucune photo.</Text>
        </Card>
      ) : (
        <View style={styles.photoGrid}>
          {photos.map((p) => (
            <Image key={p.id} source={{ uri: p.url }} style={styles.photo} />
          ))}
        </View>
      )}

      {/* Changement de statut */}
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
  desc: { fontSize: typography.small, color: colors.text, lineHeight: 20, marginTop: spacing.xs },
  block: { marginBottom: spacing.lg },
  muted: { fontSize: typography.small, color: colors.textMuted },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  photo: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
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
