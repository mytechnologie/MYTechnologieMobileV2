import { useLocalSearchParams } from 'expo-router';
import { ProjectReportsView } from '../../../src/views/ProjectReportsView';

export default function ProjectReportsRoute() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  return <ProjectReportsView projectId={String(projectId)} />;
}
