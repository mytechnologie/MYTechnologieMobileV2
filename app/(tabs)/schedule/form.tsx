/**
 * Formulaire de bloc d'horaire (création + édition + suppression).
 * Réutilisable (mode « new » si pas d'`id`, sinon édition). Volontairement en
 * champs texte validés (YYYY-MM-DD / HH:MM) pour rester 100% JS — testable via
 * reload Metro, sans dépendance native de date-picker (à ajouter plus tard si voulu).
 *
 * Backend : un non-admin ne peut créer/modifier que ses propres blocs.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Alert, StyleSheet, View } from 'react-native';
import { Button, TextField } from '../../../src/components/Primitives';
import { Screen } from '../../../src/components/Screen';
import { LoadingState } from '../../../src/components/States';
import { schedule } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { toISODate } from '../../../src/lib/format';
import type { ScheduleInput } from '../../../src/api/types';
import { spacing } from '../../../src/theme';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

export default function ScheduleFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const navigation = useNavigation();
  const router = useRouter();
  const { user } = useAuth();

  const editing = id != null && id !== '';
  const scheduleId = editing ? Number(id) : null;

  // En édition : on retrouve le bloc dans la liste de l'utilisateur (pas de getById).
  const userId = user ? Number(user.id) : undefined;
  const listQ = useQuery(
    () => (editing ? schedule.list({ userId }) : Promise.resolve([])),
    [editing, userId],
  );
  const existing = useMemo(
    () => (scheduleId != null ? listQ.data?.find((s) => s.id === scheduleId) : undefined),
    [listQ.data, scheduleId],
  );

  const [title, setTitle] = useState('');
  const [workDate, setWorkDate] = useState(toISODate(new Date()));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const inited = useRef(false);

  const save = useMutation<ScheduleInput, { id: number } | { success: boolean }>(
    (input) =>
      editing && scheduleId != null
        ? schedule.update(scheduleId, input)
        : schedule.create(input),
  );
  const remove = useMutation((sid: number) => schedule.remove(sid));

  useEffect(() => {
    navigation.setOptions({ title: editing ? "Modifier l'horaire" : 'Nouvel horaire' });
  }, [navigation, editing]);

  // Préremplissage en édition (une seule fois).
  useEffect(() => {
    if (existing && !inited.current) {
      inited.current = true;
      setTitle(existing.title);
      setWorkDate(existing.workDate);
      setStartTime(existing.startTime);
      setEndTime(existing.endTime);
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  if (editing && listQ.loading) return <LoadingState label="Chargement…" />;

  const onSave = async () => {
    if (!title.trim()) return Alert.alert('Titre requis', 'Entrez un titre.');
    if (!DATE_RE.test(workDate)) return Alert.alert('Date invalide', 'Format attendu : AAAA-MM-JJ.');
    if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime)) {
      return Alert.alert('Heure invalide', 'Format attendu : HH:MM (ex. 08:30).');
    }
    if (endTime <= startTime) {
      return Alert.alert('Plage invalide', "L'heure de fin doit suivre l'heure de début.");
    }
    if (userId == null) return Alert.alert('Erreur', 'Utilisateur introuvable.');

    try {
      await save.mutate({
        userId,
        workDate,
        startTime,
        endTime,
        title: title.trim(),
        notes: notes.trim() || null,
      });
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  const onDelete = () => {
    if (scheduleId == null) return;
    Alert.alert('Supprimer', 'Supprimer ce bloc d’horaire ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await remove.mutate(scheduleId);
            router.back();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  return (
    <Screen scroll>
      <TextField
        label="Titre"
        value={title}
        onChangeText={setTitle}
        placeholder="ex. Installation caméras — client X"
      />
      <TextField
        label="Date (AAAA-MM-JJ)"
        value={workDate}
        onChangeText={setWorkDate}
        placeholder="2026-07-03"
        autoCapitalize="none"
        keyboardType="numbers-and-punctuation"
      />
      <View style={styles.row}>
        <View style={styles.col}>
          <TextField
            label="Début (HH:MM)"
            value={startTime}
            onChangeText={setStartTime}
            placeholder="08:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={styles.col}>
          <TextField
            label="Fin (HH:MM)"
            value={endTime}
            onChangeText={setEndTime}
            placeholder="17:00"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <TextField
        label="Notes"
        value={notes}
        onChangeText={setNotes}
        placeholder="Détails, adresse, rappels…"
        multiline
        style={styles.multiline}
      />

      <Button
        title={editing ? 'Enregistrer' : 'Créer le bloc'}
        onPress={onSave}
        loading={save.loading}
        style={styles.action}
      />
      {editing ? (
        <Button
          title="Supprimer"
          variant="danger"
          onPress={onDelete}
          loading={remove.loading}
          style={styles.action}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  col: { flex: 1 },
  multiline: { minHeight: 96, paddingTop: spacing.md, textAlignVertical: 'top' },
  action: { marginTop: spacing.sm },
});
