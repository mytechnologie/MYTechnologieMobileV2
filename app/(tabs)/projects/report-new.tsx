import { useLocalSearchParams, useRouter } from 'expo-router';
import { ProjectReportCreateView } from '../../../src/views/ProjectReportCreateView';

export default function ProjectReportNewRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const pid = String(projectId);

  return (
    <ProjectReportCreateView
      projectId={pid}
      onCreated={(reportId) =>
        // On remplace l'écran de création : « retour » ramène à la liste, pas au formulaire.
        router.replace(`/projects/report?projectId=${pid}&reportId=${reportId}`)
      }
      onCancel={() => router.back()}
    />
  );
}
