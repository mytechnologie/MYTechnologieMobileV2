/**
 * Création d'un bon de travail — vue partagée (téléphone plein écran OU panneau
 * détail iPad). Réutilise le formulaire complet (WorkOrderForm) puis, en cas de
 * succès, bascule vers le détail du BT créé (pour photos, statut, etc.).
 *
 * Réservé aux rôles élevés (le bouton « + Nouveau » ne s'affiche que pour eux) ;
 * le backend applique de toute façon la permission `work_orders.create`.
 */
import { useEffect } from 'react';
import { useNavigation, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { Screen } from '../components/Screen';
import { SectionTitle } from '../components/Primitives';
import { WorkOrderForm, type WorkOrderFormValues } from '../components/WorkOrderForm';
import { workOrders } from '../api/endpoints';
import { useMutation } from '../api/useApi';

export function WorkOrderCreateView({
  embedded = false,
  onCreated,
  onCancel,
}: {
  /** true quand rendu dans le panneau détail iPad (ne touche pas le titre du Stack). */
  embedded?: boolean;
  /** iPad : bascule vers le détail du BT créé, dans le même panneau. */
  onCreated?: (id: number) => void;
  onCancel?: () => void;
}) {
  const navigation = useNavigation();
  const router = useRouter();
  const create = useMutation(workOrders.create);

  useEffect(() => {
    if (!embedded) navigation.setOptions({ title: 'Nouveau bon' });
  }, [embedded, navigation]);

  const submit = async (values: WorkOrderFormValues) => {
    if (values.clientId == null) {
      Alert.alert('Client requis', 'Veuillez sélectionner un client.');
      return;
    }
    try {
      const res = await create.mutate({
        clientId: values.clientId,
        // omis → le backend assigne le créateur ; sinon la sélection.
        technicianId: values.technicianId ?? undefined,
        serviceType: values.serviceType ?? undefined,
        location: values.location ?? undefined,
        serviceDate: values.serviceDate ?? undefined,
        durationMinutes: values.durationMinutes ?? undefined,
        materialsInternal: values.materialsInternal ?? undefined,
        problemDescription: values.problemDescription ?? undefined,
        actionsTaken: values.actionsTaken ?? undefined,
        followUp: values.followUp ?? undefined,
      });
      const id = res.workOrder?.id;
      if (id == null) {
        Alert.alert('Erreur', 'Bon de travail créé mais identifiant introuvable.');
        return;
      }
      if (onCreated) onCreated(id);
      else router.replace(`/work-orders/${id}`);
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Création impossible.');
    }
  };

  return (
    <Screen scroll>
      <SectionTitle>Nouveau bon de travail</SectionTitle>
      <WorkOrderForm
        mode="create"
        elevated
        submitting={create.loading}
        onSubmit={submit}
        onCancel={onCancel}
      />
    </Screen>
  );
}
