import { useLocalSearchParams } from 'expo-router';
import { ProjectReportView } from '../../../src/views/ProjectReportView';

export default function ProjectReportRoute() {
  const { reportId } = useLocalSearchParams<{ projectId: string; reportId: string }>();
  return <ProjectReportView reportId={Number(reportId)} />;
}
