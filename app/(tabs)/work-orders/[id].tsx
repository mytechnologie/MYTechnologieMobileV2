/**
 * Route téléphone : détail d'un bon de travail. Le contenu vit dans une vue
 * partagée (src/views/WorkOrderDetailView) réutilisée par le layout iPad
 * master-détail. Ici on ne fait que lire l'id de la route.
 */
import { useLocalSearchParams } from 'expo-router';
import { WorkOrderDetailView } from '../../../src/views/WorkOrderDetailView';

export default function WorkOrderDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkOrderDetailView id={String(id)} />;
}
