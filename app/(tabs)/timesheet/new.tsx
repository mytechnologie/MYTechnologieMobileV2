/**
 * Création d'une saisie d'heures (brouillon).
 */
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '../../../src/components/Screen';
import { TimesheetForm } from '../../../src/components/TimesheetForm';
import { timesheet } from '../../../src/api/endpoints';
import { useMutation } from '../../../src/api/useApi';
import type { CreateTimesheetEntryInput } from '../../../src/api/types';

export default function NewTimesheetScreen() {
  const router = useRouter();
  const create = useMutation(timesheet.createEntry);

  const onSubmit = async (input: CreateTimesheetEntryInput) => {
    try {
      await create.mutate(input);
      router.back();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Screen scroll>
      <TimesheetForm submitting={create.loading} submitLabel="Enregistrer" onSubmit={onSubmit} />
    </Screen>
  );
}
