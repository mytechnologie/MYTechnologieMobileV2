/**
 * Route téléphone : création d'un bon de travail. Le contenu vit dans une vue
 * partagée (src/views/WorkOrderCreateView) réutilisée par le panneau iPad.
 */
import { WorkOrderCreateView } from '../../../src/views/WorkOrderCreateView';

export default function WorkOrderNewRoute() {
  return <WorkOrderCreateView />;
}
