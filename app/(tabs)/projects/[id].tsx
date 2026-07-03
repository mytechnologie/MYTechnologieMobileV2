/**
 * Route téléphone : détail d'un projet. Le contenu vit dans une vue partagée
 * (src/views/ProjectDetailView) réutilisée par le layout iPad master-détail.
 */
import { useLocalSearchParams } from 'expo-router';
import { ProjectDetailView } from '../../../src/views/ProjectDetailView';

export default function ProjectDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectDetailView id={String(id)} />;
}
