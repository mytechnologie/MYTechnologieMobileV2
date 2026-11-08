/**
 * Rendez-vous de la Cédule : création, modification, suppression. Mise en
 * page de Calendrier : titre et lieu, journée entière, début et fin, pour qui
 * (admins), couleur, deux alertes, notes. Les alertes sont replanifiées sur
 * l'appareil après chaque enregistrement.
 *
 * Portail : un non-admin ne gère que son propre calendrier.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../../src/components/Primitives';
import { DateTimeField } from '../../../src/components/DateTimeField';
import { LoadingState } from '../../../src/components/States';
import { schedule } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { isElevated } from '../../../src/auth/access';
import { syncCalendarReminders } from '../../../src/notifications/reminders';
import { EVENT_COLORS, REMINDER_OPTIONS, at, hm, parseYmd, reminderLabel, ymd } from '../../../src/lib/calendar';
import type { ScheduleInput } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

type Sheet = null | 'reminder' | 'reminder2' | 'person';

export default function ScheduleFormScreen() {
  const params = useLocalSearchParams<{ id?: string; date?: string; userId?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();
  const me = user ? Number(user.id) : null;
  const admin = !!user && isElevated(user);

  const editing = !!params.id;
  const eventId = editing ? Number(params.id) : null;
  const ownerParam = params.userId ? Number(params.userId) : me;
  const dateParam = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : ymd(new Date());

  // Pas de getById au portail : on relit la journée du propriétaire.
  const existingQ = useQuery(
    () =>
      editing && ownerParam != null
        ? schedule.agenda({ startDate: dateParam, endDate: dateParam, userIds: [ownerParam], includeWorkOrders: false })
        : Promise.resolve([]),
    [editing, dateParam, ownerParam],
  );
  const existing = useMemo(
    () => existingQ.data?.find(e => e.kind === 'event' && e.id === eventId),
    [existingQ.data, eventId],
  );
  const peopleQ = useQuery(() => (admin ? schedule.people().catch(() => []) : Promise.resolve([])), [admin]);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(() => defaultStart(dateParam));
  const [end, setEnd] = useState(() => new Date(defaultStart(dateParam).getTime() + 60 * 60000));
  const [ownerId, setOwnerId] = useState<number | null>(ownerParam);
  const [color, setColor] = useState<string | null>(null);
  const [reminder, setReminder] = useState<number | null>(15);
  const [reminder2, setReminder2] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [sheet, setSheet] = useState<Sheet>(null);
  const inited = useRef(false);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Rendez-vous' : 'Nouveau rendez-vous' });
  }, [navigation, editing]);

  useEffect(() => {
    if (!existing || inited.current) return;
    inited.current = true;
    setTitle(existing.title);
    setLocation(existing.location ?? '');
    setAllDay(existing.allDay);
    setStart(at(existing.date, existing.allDay ? '09:00' : existing.start));
    setEnd(at(existing.date, existing.allDay ? '10:00' : existing.end));
    setOwnerId(existing.userId);
    setColor(existing.color);
    setReminder(existing.reminderMinutes);
    setReminder2(existing.reminder2Minutes);
    setNotes(existing.notes ?? '');
  }, [existing]);

  const save = useMutation<ScheduleInput, unknown>(input =>
    editing && eventId != null ? schedule.update(eventId, input) : schedule.create(input),
  );
  const remove = useMutation((id: number) => schedule.remove(id));

  if (editing && existingQ.loading) return <LoadingState label="Chargement…" />;

  // Déplacer le début garde la durée, comme Calendrier.
  const onStart = (d: Date) => {
    const duration = end.getTime() - start.getTime();
    setStart(d);
    setEnd(new Date(d.getTime() + Math.max(duration, 15 * 60000)));
  };
  // La date se choisit sur le début ; la fin suit le même jour.
  const onDate = (d: Date) => {
    const s = new Date(d);
    s.setHours(start.getHours(), start.getMinutes(), 0, 0);
    const e = new Date(d);
    e.setHours(end.getHours(), end.getMinutes(), 0, 0);
    setStart(s);
    setEnd(e);
  };

  const onSave = async () => {
    if (!title.trim()) return Alert.alert('Titre requis', 'Donnez un titre au rendez-vous.');
    if (!allDay && end <= start) {
      return Alert.alert('Heures', "L'heure de fin doit suivre l'heure de début.");
    }
    if (ownerId == null) return Alert.alert('Erreur', 'Utilisateur introuvable.');
    try {
      await save.mutate({
        userId: ownerId,
        workDate: ymd(start),
        startTime: allDay ? '00:00' : hm(start),
        endTime: allDay ? '23:59' : hm(end),
        allDay,
        title: title.trim(),
        location: location.trim() || null,
        notes: notes.trim() || null,
        color,
        reminderMinutes: reminder,
        reminder2Minutes: reminder2,
      });
      void syncCalendarReminders(me);
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  const onDelete = () => {
    if (eventId == null) return;
    Alert.alert('Supprimer le rendez-vous', 'Il sera retiré de la cédule.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutate(eventId);
            void syncCalendarReminders(me);
            router.back();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  const people = peopleQ.data ?? [];
  const ownerName =
    ownerId === me ? 'Moi' : people.find(p => p.id === ownerId)?.name ?? existing?.userName ?? '—';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.group}>
        <TextInput
          style={[styles.input, styles.divider]}
          value={title}
          onChangeText={setTitle}
          placeholder="Titre"
          placeholderTextColor={colors.disabled}
          accessibilityLabel="Titre"
        />
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="Lieu"
          placeholderTextColor={colors.disabled}
          accessibilityLabel="Lieu"
        />
      </View>

      <View style={styles.group}>
        <View style={[styles.row, styles.divider]}>
          <Text style={styles.label}>Toute la journée</Text>
          <Switch
            value={allDay}
            onValueChange={setAllDay}
            trackColor={{ true: colors.success, false: colors.border }}
            accessibilityLabel="Toute la journée"
          />
        </View>
        <View style={[styles.row, !allDay && styles.divider]}>
          <Text style={styles.label}>{allDay ? 'Date' : 'Début'}</Text>
          <View style={styles.pickers}>
            <DateTimeField value={start} mode="date" onChange={onDate} accessibilityLabel="Date" />
            {!allDay ? (
              <DateTimeField value={start} mode="time" onChange={onStart} accessibilityLabel="Heure de début" />
            ) : null}
          </View>
        </View>
        {!allDay ? (
          <View style={styles.row}>
            <Text style={styles.label}>Fin</Text>
            <DateTimeField
              value={end}
              mode="time"
              onChange={d => {
                const e = new Date(start);
                e.setHours(d.getHours(), d.getMinutes(), 0, 0);
                setEnd(e);
              }}
              accessibilityLabel="Heure de fin"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.group}>
        {admin ? (
          <Pressable style={[styles.row, styles.divider]} onPress={() => setSheet('person')} accessibilityRole="button">
            <Text style={styles.label}>Pour</Text>
            <Text style={styles.value}>{ownerName} ›</Text>
          </Pressable>
        ) : null}
        <View style={styles.row}>
          <Text style={styles.label}>Couleur</Text>
          <View style={styles.swatches}>
            {EVENT_COLORS.map(c => (
              <Pressable
                key={c}
                onPress={() => setColor(color === c ? null : c)}
                style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === c }}
                accessibilityLabel={`Couleur ${c}`}
              />
            ))}
          </View>
        </View>
      </View>

      <View style={styles.group}>
        <Pressable style={[styles.row, styles.divider]} onPress={() => setSheet('reminder')} accessibilityRole="button">
          <Text style={styles.label}>Alerte</Text>
          <Text style={styles.value}>{reminderLabel(reminder)} ›</Text>
        </Pressable>
        <Pressable style={styles.row} onPress={() => setSheet('reminder2')} accessibilityRole="button">
          <Text style={styles.label}>Deuxième alerte</Text>
          <Text style={styles.value}>{reminderLabel(reminder2)} ›</Text>
        </Pressable>
      </View>
      <Text style={styles.hint}>
        {"Les alertes arrivent en notification sur ce téléphone, même si l'app est fermée."}
      </Text>

      <View style={styles.group}>
        <TextInput
          style={[styles.input, styles.notes]}
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes"
          placeholderTextColor={colors.disabled}
          multiline
          accessibilityLabel="Notes"
        />
      </View>

      <Button title={editing ? 'Enregistrer' : 'Ajouter'} onPress={onSave} loading={save.loading} />
      {editing ? (
        <Button
          title="Supprimer le rendez-vous"
          variant="danger"
          onPress={onDelete}
          loading={remove.loading}
          style={styles.delete}
        />
      ) : null}

      <OptionSheet
        visible={sheet === 'reminder' || sheet === 'reminder2'}
        title={sheet === 'reminder2' ? 'Deuxième alerte' : 'Alerte'}
        options={REMINDER_OPTIONS.map(o => ({ key: String(o.minutes), label: o.label }))}
        selected={String(sheet === 'reminder2' ? reminder2 : reminder)}
        onPick={key => {
          const v = key === 'null' ? null : Number(key);
          if (sheet === 'reminder2') setReminder2(v);
          else setReminder(v);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'person'}
        title="Pour"
        options={people.map(p => ({ key: String(p.id), label: p.id === me ? `${p.name} (moi)` : p.name }))}
        selected={String(ownerId)}
        onPick={key => {
          setOwnerId(Number(key));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </ScrollView>
  );
}

function defaultStart(date: string): Date {
  // Prochaine heure pleine si c'est aujourd'hui, sinon 9 h.
  const d = parseYmd(date);
  const now = new Date();
  if (ymd(now) === date) {
    d.setHours(Math.min(now.getHours() + 1, 23), 0, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
}

function OptionSheet({
  visible,
  title,
  options,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { key: string; label: string }[];
  selected: string;
  onPick: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
            <Text style={styles.sheetClose}>Fermer</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetList}>
          <View style={styles.group}>
            {options.map((o, i) => (
              <Pressable
                key={o.key}
                onPress={() => onPick(o.key)}
                style={[styles.row, i < options.length - 1 && styles.divider]}
                accessibilityRole="radio"
                accessibilityState={{ selected: o.key === selected }}
              >
                <Text style={styles.label}>{o.label}</Text>
                {o.key === selected ? <Ionicons name="checkmark" size={20} color={colors.navy} /> : null}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxxl },
  group: { backgroundColor: colors.surface, borderRadius: radius.md, overflow: 'hidden' },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.surfaceAlt },
  input: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, fontSize: typography.body, color: colors.text },
  notes: { minHeight: 96, textAlignVertical: 'top' },
  row: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  label: { fontSize: typography.body, color: colors.text },
  value: { fontSize: typography.body, color: colors.textMuted, flexShrink: 1, textAlign: 'right' },
  pickers: { flexDirection: 'row', gap: spacing.xs, alignItems: 'center' },
  swatches: { flexDirection: 'row', gap: spacing.sm },
  swatch: { width: 24, height: 24, borderRadius: 12 },
  swatchOn: { borderWidth: 3, borderColor: colors.navy },
  hint: { fontSize: typography.tiny, color: colors.textMuted, marginTop: -spacing.md, paddingHorizontal: spacing.xs },
  delete: { marginTop: -spacing.sm },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
  },
  sheetTitle: { fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.text },
  sheetClose: { fontSize: typography.body, color: colors.info, fontWeight: typography.weightSemibold },
  sheetList: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
});
