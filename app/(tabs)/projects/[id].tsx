/** Route téléphone : suivi d'un projet (vue partagée avec le panneau iPad). */
import { useLocalSearchParams } from 'expo-router';
import { ProjectDetailView } from '../../../src/views/ProjectDetailView';

export default function ProjectDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ProjectDetailView id={String(id)} />;
}
