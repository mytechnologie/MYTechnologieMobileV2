/** Route téléphone : détail d'un bon (vue partagée avec le panneau iPad). */
import { useLocalSearchParams } from 'expo-router';
import { WorkOrderDetailView } from '../../../src/views/WorkOrderDetailView';

export default function WorkOrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkOrderDetailView id={String(id)} />;
}
