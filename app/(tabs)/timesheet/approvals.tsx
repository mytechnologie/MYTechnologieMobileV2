/**
 * Approbation des heures (gestion et directeurs de département) : entrées
 * soumises regroupées par employé, approbation en bloc, refus par entrée avec
 * motif. Le portail limite chaque approbateur à son périmètre.
 */
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card } from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { approvals, type ApprovalEntry, type ApprovalGroup } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { formatDate } from '../../../src/lib/format';
import { formatHours } from '../../../src/lib/time';
import { colors, radius, spacing, typography } from '../../../src/theme';

function EntryLine({
  entry,
  onRejected,
}: {
  entry: ApprovalEntry;
  onRejected: () => void;
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const confirmReject = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await approvals.reject(entry.id, reason.trim());
      onRejected();
    } catch (e) {
      Alert.alert('Refus', e instanceof Error ? e.message : 'Refus impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.entry}>
      <View style={styles.entryTop}>
        <Text style={styles.entryDate}>{formatDate(entry.date)}</Text>
        <Text style={styles.entryHours}>{formatHours(entry.hours)}</Text>
      </View>
      <Text style={styles.entryMeta} numberOfLines={2}>
        {entry.startTime && entry.endTime ? `${entry.startTime} – ${entry.endTime}` : ''}
        {entry.label ? ` · ${entry.label}` : ''}
      </Text>
      {entry.notes ? <Text style={styles.entryNotes}>{entry.notes}</Text> : null}
      {rejecting ? (
        <View style={styles.rejectBox}>
          <TextInput
            style={styles.reason}
            placeholder="Motif du refus (visible par l'employé)"
            placeholderTextColor={colors.disabled}
            value={reason}
            onChangeText={setReason}
            autoFocus
          />
          <View style={styles.row}>
            <Button title="Annuler" variant="ghost" fullWidth={false} style={styles.flex} onPress={() => setRejecting(false)} />
            <Button
              title="Refuser"
              variant="danger"
              fullWidth={false}
              style={styles.flex}
              loading={busy}
              disabled={!reason.trim()}
              onPress={confirmReject}
            />
          </View>
        </View>
      ) : (
        <Text style={styles.rejectLink} onPress={() => setRejecting(true)} accessibilityRole="button">
          Refuser cette entrée
        </Text>
      )}
    </View>
  );
}

function GroupCard({ group, onChanged }: { group: ApprovalGroup; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  const approveAll = async () => {
    setBusy(true);
    try {
      await approvals.approve(group.entries.map(e => e.id));
      onChanged();
    } catch (e) {
      Alert.alert('Approbation', e instanceof Error ? e.message : 'Approbation impossible.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.group}>
      <View style={styles.entryTop}>
        <Text style={styles.name}>{group.userName}</Text>
        <Text style={styles.total}>{formatHours(group.totalHours)}</Text>
      </View>
      <Text style={styles.entryMeta}>
        {group.entries.length} entrée{group.entries.length > 1 ? 's' : ''} soumise
        {group.entries.length > 1 ? 's' : ''}
      </Text>
      {group.entries.map(e => (
        <EntryLine key={e.id} entry={e} onRejected={onChanged} />
      ))}
      <Button title={`Approuver tout (${formatHours(group.totalHours)})`} loading={busy} onPress={approveAll} />
    </Card>
  );
}

export default function ApprovalsScreen() {
  const q = useQuery(() => approvals.queue(), []);

  if (q.loading) return <LoadingState label="Chargement des heures soumises…" />;
  if (q.error) return <ErrorState message={q.error.message} onRetry={q.refetch} />;

  const groups = q.data ?? [];
  if (groups.length === 0) {
    return (
      <EmptyState
        icon="checkmark-done-outline"
        title="Rien à approuver"
        message="Aucune heure soumise en attente."
      />
    );
  }

  return (
    <Screen scroll refreshing={q.refreshing} onRefresh={q.refetch}>
      {groups.map(g => (
        <GroupCard key={g.userId} group={g} onChanged={q.refetch} />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { marginBottom: spacing.md, gap: spacing.sm },
  name: { fontSize: typography.body, fontWeight: typography.weightBold, color: colors.text, flex: 1 },
  total: { fontSize: typography.body, fontWeight: typography.weightBold, color: colors.navy },
  entry: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    gap: 2,
  },
  entryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  entryDate: { fontSize: typography.small, fontWeight: typography.weightSemibold, color: colors.text },
  entryHours: { fontSize: typography.small, fontWeight: typography.weightBold, color: colors.text },
  entryMeta: { fontSize: typography.small, color: colors.textMuted },
  entryNotes: { fontSize: typography.small, color: colors.text },
  rejectLink: {
    fontSize: typography.small,
    color: colors.danger,
    fontWeight: typography.weightSemibold,
    paddingVertical: spacing.xs,
  },
  rejectBox: { gap: spacing.sm, marginTop: spacing.xs },
  reason: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.text,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
