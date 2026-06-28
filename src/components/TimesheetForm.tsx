/**
 * Formulaire de saisie d'heures : date, projet/bon, début + fin + pause (total live), notes.
 * Utilisé pour la création et l'édition d'un brouillon.
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextField } from './Primitives';
import { ReferencePicker, type LinkSelection } from './ReferencePicker';
import type { CreateTimesheetEntryInput, TimesheetEntry } from '../api/types';
import { formatDate, toISODate } from '../lib/format';
import { computeWorkedHours, formatHours } from '../lib/time';
import { colors, radius, spacing, typography } from '../theme';

export interface TimesheetFormValues {
  date: string;
  link: LinkSelection;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  notes: string;
}

function initialLink(entry?: TimesheetEntry): LinkSelection {
  if (entry?.projectId) {
    return { kind: 'project', id: entry.projectId, label: entry.projectName ?? 'Projet' };
  }
  if (entry?.workOrderId) {
    return {
      kind: 'workOrder',
      id: entry.workOrderId,
      label: entry.workOrderNumber ? `#${entry.workOrderNumber}` : 'Bon de travail',
    };
  }
  return { kind: 'none' };
}

export function TimesheetForm({
  entry,
  submitting,
  submitLabel,
  onSubmit,
}: {
  entry?: TimesheetEntry;
  submitting: boolean;
  submitLabel: string;
  onSubmit: (input: CreateTimesheetEntryInput) => void;
}) {
  const [date, setDate] = useState(entry?.date?.slice(0, 10) ?? toISODate(new Date()));
  const [link, setLink] = useState<LinkSelection>(initialLink(entry));
  const [startTime, setStartTime] = useState(entry?.startTime ?? '08:00');
  const [endTime, setEndTime] = useState(entry?.endTime ?? '16:00');
  const [breakMinutes, setBreakMinutes] = useState(String(entry?.breakMinutes ?? 30));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  const duration = useMemo(
    () => computeWorkedHours(startTime, endTime, Number(breakMinutes) || 0),
    [startTime, endTime, breakMinutes],
  );

  const shiftDate = (days: number) => {
    const d = new Date(`${date}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    d.setDate(d.getDate() + days);
    setDate(toISODate(d));
  };

  const handleSubmit = () => {
    setError(null);
    if (!duration.valid) {
      setError('Heures invalides. Utilisez le format HH:mm (ex. 08:30).');
      return;
    }
    if (duration.hours <= 0) {
      setError('La durée doit être supérieure à 0.');
      return;
    }
    onSubmit({
      date,
      projectId: link.kind === 'project' ? link.id : null,
      workOrderId: link.kind === 'workOrder' ? link.id : null,
      startTime,
      endTime,
      breakMinutes: Number(breakMinutes) || 0,
      notes: notes.trim() || null,
    });
  };

  return (
    <View>
      {/* Date */}
      <Text style={styles.label}>Date</Text>
      <View style={styles.dateRow}>
        <Button title="◀" variant="secondary" fullWidth={false} onPress={() => shiftDate(-1)} style={styles.dateBtn} />
        <View style={styles.dateLabel}>
          <Text style={styles.dateText}>{formatDate(date)}</Text>
        </View>
        <Button title="▶" variant="secondary" fullWidth={false} onPress={() => shiftDate(1)} style={styles.dateBtn} />
      </View>
      <Button
        title="Aujourd'hui"
        variant="ghost"
        fullWidth={false}
        onPress={() => setDate(toISODate(new Date()))}
        style={styles.today}
      />

      {/* Rattachement */}
      <ReferencePicker value={link} onChange={setLink} />

      {/* Heures */}
      <View style={styles.timeRow}>
        <View style={styles.timeField}>
          <TextField
            label="Début"
            placeholder="08:00"
            keyboardType="numbers-and-punctuation"
            value={startTime}
            onChangeText={setStartTime}
            maxLength={5}
          />
        </View>
        <View style={styles.timeField}>
          <TextField
            label="Fin"
            placeholder="16:00"
            keyboardType="numbers-and-punctuation"
            value={endTime}
            onChangeText={setEndTime}
            maxLength={5}
          />
        </View>
        <View style={styles.timeField}>
          <TextField
            label="Pause (min)"
            placeholder="30"
            keyboardType="number-pad"
            value={breakMinutes}
            onChangeText={setBreakMinutes}
            maxLength={3}
          />
        </View>
      </View>

      {/* Total live */}
      <Card style={styles.totalCard}>
        <View style={styles.totalRow}>
          <View style={styles.totalLeft}>
            <Ionicons name="time-outline" size={22} color={colors.navy} />
            <Text style={styles.totalLabel}>Total</Text>
          </View>
          <Text style={styles.totalValue}>
            {duration.valid ? formatHours(duration.hours) : '—'}
          </Text>
        </View>
        {duration.overnight ? (
          <Text style={styles.overnight}>Quart de nuit (passage à minuit pris en compte)</Text>
        ) : null}
      </Card>

      <TextField
        label="Notes"
        placeholder="Détails du travail effectué…"
        value={notes}
        onChangeText={setNotes}
        multiline
        numberOfLines={3}
        style={styles.notes}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={submitLabel}
        variant="primary"
        loading={submitting}
        onPress={handleSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtn: { minWidth: 52, paddingHorizontal: spacing.md },
  dateLabel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  today: { alignSelf: 'center', marginTop: spacing.xs, marginBottom: spacing.lg },
  timeRow: { flexDirection: 'row', gap: spacing.sm },
  timeField: { flex: 1 },
  totalCard: { marginBottom: spacing.lg, backgroundColor: colors.surfaceAlt },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  totalLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  totalLabel: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  totalValue: {
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.navy,
  },
  overnight: { fontSize: typography.tiny, color: colors.textMuted, marginTop: spacing.sm },
  notes: { minHeight: 88, textAlignVertical: 'top', paddingTop: spacing.md },
  error: { color: colors.danger, fontSize: typography.small, marginBottom: spacing.md },
});
