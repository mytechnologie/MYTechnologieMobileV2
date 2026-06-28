/**
 * Saisie d'heures — historique + actions.
 * Liste des entrées avec statut, édition des brouillons, soumission groupée.
 */
import { useCallback, useMemo } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { timesheet } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { formatDate, timesheetStatusStyle } from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import type { TimesheetEntry } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

function EntryRow({
  entry,
  onPress,
}: {
  entry: TimesheetEntry;
  onPress?: () => void;
}) {
  const s = timesheetStatusStyle(entry.status);
  const linked =
    entry.projectName ??
    (entry.workOrderNumber ? `Bon #${entry.workOrderNumber}` : null);
  const editable = entry.status === 'draft';

  return (
    <Card style={styles.card} onPress={editable ? onPress : undefined}>
      <View style={styles.rowTop}>
        <Text style={styles.date}>{formatDate(entry.date)}</Text>
        <Badge label={s.label} color={s.color} bg={s.bg} />
      </View>
      <View style={styles.rowMid}>
        <Text style={styles.hours}>{formatHours(entry.totalHours)}</Text>
        <Text style={styles.times}>
          {entry.startTime} – {entry.endTime}
          {entry.breakMinutes ? ` · ${entry.breakMinutes} min pause` : ''}
        </Text>
      </View>
      {linked ? (
        <View style={styles.metaLine}>
          <Ionicons name="link-outline" size={14} color={colors.textMuted} />
          <Text style={styles.meta} numberOfLines={1}>
            {linked}
          </Text>
        </View>
      ) : null}
      {editable ? (
        <View style={styles.editHint}>
          <Ionicons name="create-outline" size={14} color={colors.navy} />
          <Text style={styles.editHintText}>Toucher pour modifier</Text>
        </View>
      ) : null}
    </Card>
  );
}

export default function TimesheetScreen() {
  const router = useRouter();
  const { data, loading, error, refetch, refreshing } = useQuery(
    () => timesheet.myEntries(),
    [],
  );
  const submit = useMutation(timesheet.submitEntries);

  // Rafraîchit la liste au retour des écrans de création/édition.
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const entries = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data],
  );
  const draftIds = useMemo(
    () => entries.filter((e) => e.status === 'draft').map((e) => e.id),
    [entries],
  );

  const onSubmitDrafts = () => {
    if (draftIds.length === 0) return;
    Alert.alert(
      'Soumettre',
      `Soumettre ${draftIds.length} brouillon(s) pour approbation ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Soumettre',
          onPress: async () => {
            try {
              await submit.mutate({ ids: draftIds });
              refetch();
            } catch (e) {
              Alert.alert('Erreur', e instanceof Error ? e.message : 'Soumission impossible.');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingState label="Chargement des saisies…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        onRefresh={refetch}
        refreshing={refreshing}
        renderItem={({ item }) => (
          <EntryRow
            entry={item}
            onPress={() => router.push(`/(tabs)/timesheet/${item.id}`)}
          />
        )}
        ListEmptyComponent={
          <EmptyState
            icon="time-outline"
            title="Aucune saisie"
            message="Commencez par saisir vos heures."
          />
        }
      />

      <View style={styles.footer}>
        {draftIds.length > 0 ? (
          <Button
            title={`Soumettre ${draftIds.length} brouillon(s)`}
            variant="secondary"
            loading={submit.loading}
            onPress={onSubmitDrafts}
            style={styles.footerBtn}
          />
        ) : null}
        <Button
          title="Nouvelle saisie"
          variant="gold"
          onPress={() => router.push('/(tabs)/timesheet/new')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  card: { gap: spacing.sm },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  date: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  rowMid: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  hours: { fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.navy },
  times: { fontSize: typography.small, color: colors.textMuted },
  metaLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  meta: { fontSize: typography.small, color: colors.textMuted, flex: 1 },
  editHint: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editHintText: { fontSize: typography.tiny, color: colors.navy },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerBtn: {},
});
