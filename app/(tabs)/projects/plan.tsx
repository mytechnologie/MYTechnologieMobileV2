/**
 * Route : annotateur de plan de chantier plein écran. Le contenu vit dans la vue
 * partagée src/views/PlanAnnotatorView (réutilisable téléphone + iPad).
 */
import { useLocalSearchParams } from 'expo-router';
import { PlanAnnotatorView } from '../../../src/views/PlanAnnotatorView';

export default function PlanRoute() {
  const { projectId, planId } = useLocalSearchParams<{ projectId: string; planId: string }>();
  return <PlanAnnotatorView projectId={String(projectId)} planId={Number(planId)} />;
}
