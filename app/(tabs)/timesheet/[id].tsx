/**
 * Édition d'une saisie d'heures en brouillon.
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { TimesheetForm } from '../../../src/components/TimesheetForm';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { timesheet } from '../../../src/api/endpoints';
import { useMutation, useQuery } from '../../../src/api/useApi';
import type { CreateTimesheetEntryInput } from '../../../src/api/types';

export default function EditTimesheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const entryId = String(id);

  // On récupère l'entrée depuis la liste (pas d'endpoint getById dédié pour timesheet).
  const entriesQ = useQuery(() => timesheet.myEntries(), []);
  const update = useMutation(timesheet.updateEntry);

  if (entriesQ.loading) return <LoadingState />;
  if (entriesQ.error) {
    return <ErrorState message={entriesQ.error.message} onRetry={entriesQ.refetch} />;
  }

  const entry = (entriesQ.data ?? []).find((e) => e.id === entryId);
  if (!entry) {
    return <ErrorState message="Saisie introuvable ou déjà soumise." />;
  }

  const onSubmit = async (input: CreateTimesheetEntryInput) => {
    try {
      await update.mutate({ ...input, id: entryId });
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Mise à jour impossible.');
    }
  };

  return (
    <Screen scroll>
      <TimesheetForm
        entry={entry}
        submitting={update.loading}
        submitLabel="Mettre à jour"
        onSubmit={onSubmit}
      />
    </Screen>
  );
}
