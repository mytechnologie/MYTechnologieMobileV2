/**
 * Formulaire complet d'un bon de travail — partagé par la CRÉATION et l'ÉDITION,
 * sur téléphone comme sur iPad.
 *
 * Deux niveaux selon le rôle (`elevated`) :
 * - admin / manager / super_admin : TOUS les champs (client, technicien, type de
 *   service, adresse, date, durée, matériel, problème, actions, suivi) ;
 * - technicien / employé : seulement le compte-rendu terrain (durée, matériel,
 *   problème, actions, suivi) — le backend ignore le reste pour ce rôle. Un
 *   rappel est affiché sur les champs non persistés.
 *
 * Le composant est purement contrôlé en interne et émet des valeurs normalisées
 * via `onSubmit`. Il charge lui-même clients / techniciens / types de service
 * (dégrade proprement si l'API refuse la liste des utilisateurs).
 */
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextField } from './Primitives';
import { EntityPicker, type PickerOption } from './EntityPicker';
import { clients as clientsApi, serviceTypes as serviceTypesApi, users as usersApi } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import { formatDate, formatDuration, roleLabel, splitDuration } from '../lib/format';
import type {
  ApiDate,
  ClientListItem,
  ServiceTypeItem,
  UserListItem,
  WorkOrder,
} from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

export interface WorkOrderFormValues {
  clientId: number | null;
  technicianId: number | null;
  serviceType: string | null;
  location: string | null;
  serviceDate: Date | null;
  durationMinutes: number | null;
  materialsInternal: string | null;
  problemDescription: string | null;
  actionsTaken: string | null;
  followUp: string | null;
}

/** ApiDate (string | Date | null) → Date | null (pour préremplissage). */
function toDate(value: ApiDate | undefined): Date | null {
  if (!value) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Rôles internes assignables (exclut les clients). Tolère anciens + nouveaux libellés. */
const ASSIGNABLE_ROLES = new Set([
  'super_admin',
  'admin',
  'manager',
  'directeur',
  'technician',
  'technicien',
  'employee',
]);

export function WorkOrderForm({
  mode,
  elevated,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onCancel,
  onOpenMaps,
}: {
  mode: 'create' | 'edit';
  elevated: boolean;
  initial?: WorkOrder;
  submitting: boolean;
  submitLabel?: string;
  onSubmit: (values: WorkOrderFormValues) => void;
  onCancel?: () => void;
  /** Édition seulement : ouvrir l'adresse dans Google Maps. */
  onOpenMaps?: (location: string) => void;
}) {
  // Listes (chargées seulement pour les rôles élevés qui éditent ces champs).
  const clientsQ = useQuery<ClientListItem[]>(
    () => (elevated ? clientsApi.list() : Promise.resolve([])),
    [elevated],
  );
  const usersQ = useQuery<UserListItem[]>(
    () => (elevated ? usersApi.list().catch(() => []) : Promise.resolve([])),
    [elevated],
  );
  const serviceTypesQ = useQuery<ServiceTypeItem[]>(
    () => (elevated ? serviceTypesApi.listActive().catch(() => []) : Promise.resolve([])),
    [elevated],
  );

  const initDuration = splitDuration(initial?.durationMinutes);

  const [clientId, setClientId] = useState<number | null>(initial?.clientId ?? null);
  const [technicianId, setTechnicianId] = useState<number | null>(
    initial?.technicianId ?? null,
  );
  const [serviceType, setServiceType] = useState(initial?.serviceType ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [serviceDate, setServiceDate] = useState<Date | null>(() => toDate(initial?.serviceDate));
  const [durationH, setDurationH] = useState(
    initial?.durationMinutes != null ? String(initDuration.hours) : '',
  );
  const [durationM, setDurationM] = useState(
    initial?.durationMinutes != null ? String(initDuration.minutes) : '',
  );
  const [materials, setMaterials] = useState(initial?.materialsInternal ?? '');
  const [problem, setProblem] = useState(initial?.problemDescription ?? '');
  const [actions, setActions] = useState(initial?.actionsTaken ?? '');
  const [followUp, setFollowUp] = useState(initial?.followUp ?? '');
  const [error, setError] = useState<string | null>(null);

  const clientOptions = useMemo<PickerOption[]>(
    () =>
      (clientsQ.data ?? []).map((c) => ({
        id: String(c.id),
        label: c.name,
        sublabel: c.city ?? c.address ?? undefined,
      })),
    [clientsQ.data],
  );

  const technicianOptions = useMemo<PickerOption[]>(
    () =>
      (usersQ.data ?? [])
        .filter((u) => u.isActive !== false && ASSIGNABLE_ROLES.has(String(u.role)))
        .map((u) => ({
          id: String(u.id),
          label: u.name || u.email || `Utilisateur #${u.id}`,
          sublabel: roleLabel(String(u.role)),
        })),
    [usersQ.data],
  );

  const serviceTypeOptions = useMemo<PickerOption[]>(
    () => (serviceTypesQ.data ?? []).map((t) => ({ id: t.name, label: t.name })),
    [serviceTypesQ.data],
  );

  const shiftDate = (days: number) => {
    const base = serviceDate ?? new Date();
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
    setServiceDate(d);
  };

  const durationTotal = useMemo(() => {
    const h = Math.max(0, parseInt(durationH, 10) || 0);
    const m = Math.min(59, Math.max(0, parseInt(durationM, 10) || 0));
    return h > 0 || m > 0 ? h * 60 + m : null;
  }, [durationH, durationM]);

  const handleSubmit = () => {
    setError(null);
    if (elevated && clientId == null) {
      setError('Veuillez sélectionner un client.');
      return;
    }
    const h = durationH.trim() === '' ? 0 : Number(durationH.trim());
    const m = durationM.trim() === '' ? 0 : Number(durationM.trim());
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
      setError('Durée invalide : heures ≥ 0 et minutes entre 0 et 59.');
      return;
    }
    const durationMinutes = h > 0 || m > 0 ? Math.floor(h) * 60 + Math.floor(m) : null;

    onSubmit({
      clientId,
      technicianId,
      serviceType: serviceType.trim() || null,
      location: location.trim() || null,
      serviceDate,
      durationMinutes,
      materialsInternal: materials.trim() || null,
      problemDescription: problem.trim() || null,
      actionsTaken: actions.trim() || null,
      followUp: followUp.trim() || null,
    });
  };

  const selectedClientLabel = useMemo<string | null>(() => {
    if (clientId == null) return null;
    return (
      clientOptions.find((o) => o.id === String(clientId))?.label ??
      `Client #${clientId}`
    );
  }, [clientId, clientOptions]);

  return (
    <View>
      {elevated ? (
        <>
          <Text style={styles.sectionLabel}>Informations générales</Text>
          <Card style={styles.card}>
            <EntityPicker
              label="Client"
              required
              placeholder="Sélectionner un client"
              triggerIcon="business-outline"
              modalTitle="Choisir un client"
              searchPlaceholder="Rechercher un client…"
              value={clientId != null ? String(clientId) : null}
              displayLabel={selectedClientLabel}
              options={clientOptions}
              loading={clientsQ.loading}
              error={error && clientId == null ? error : null}
              onSelect={(o) => {
                if (!o) return;
                setClientId(Number(o.id));
                // Pré-remplir l'adresse depuis le client si le champ est vide.
                if (!location.trim()) {
                  const c = (clientsQ.data ?? []).find((x) => x.id === Number(o.id));
                  if (c?.address) setLocation(c.address);
                }
              }}
            />

            <EntityPicker
              label="Type de service"
              placeholder="Sélectionner ou saisir un type"
              triggerIcon="construct-outline"
              modalTitle="Type de service"
              searchPlaceholder="Rechercher ou saisir…"
              allowNone
              noneLabel="Aucun"
              allowCustom
              value={serviceType || null}
              displayLabel={serviceType || null}
              options={serviceTypeOptions}
              loading={serviceTypesQ.loading}
              onSelect={(o) => setServiceType(o?.label ?? '')}
            />

            <EntityPicker
              label="Technicien assigné"
              placeholder="Sélectionner un technicien"
              triggerIcon="person-outline"
              modalTitle="Assigner à"
              searchPlaceholder="Rechercher un technicien…"
              allowNone
              noneLabel="Non assigné"
              value={technicianId != null ? String(technicianId) : null}
              options={technicianOptions}
              loading={usersQ.loading}
              emptyLabel={
                usersQ.data && usersQ.data.length === 0
                  ? 'Liste des utilisateurs indisponible.'
                  : 'Aucun technicien.'
              }
              onSelect={(o) => setTechnicianId(o ? Number(o.id) : null)}
            />

            {/* Date de service (stepper — pas de dépendance native). */}
            <Text style={styles.fieldLabel}>Date de service</Text>
            <View style={styles.dateRow}>
              <Button
                title="◀"
                variant="secondary"
                fullWidth={false}
                onPress={() => shiftDate(-1)}
                style={styles.dateBtn}
              />
              <View style={styles.dateLabel}>
                <Text style={[styles.dateText, !serviceDate && styles.datePlaceholder]}>
                  {serviceDate ? formatDate(serviceDate) : 'Aucune date'}
                </Text>
              </View>
              <Button
                title="▶"
                variant="secondary"
                fullWidth={false}
                onPress={() => shiftDate(1)}
                style={styles.dateBtn}
              />
            </View>
            <View style={styles.dateActions}>
              <Button
                title="Aujourd'hui"
                variant="ghost"
                fullWidth={false}
                onPress={() => setServiceDate(new Date())}
              />
              {serviceDate ? (
                <Button
                  title="Effacer"
                  variant="ghost"
                  fullWidth={false}
                  onPress={() => setServiceDate(null)}
                />
              ) : null}
            </View>

            <TextField
              label="Adresse de service"
              value={location}
              onChangeText={setLocation}
              placeholder="Adresse du site (si différente du client)"
            />
            {onOpenMaps && location.trim() ? (
              <Button
                title="Ouvrir dans Google Maps"
                variant="secondary"
                fullWidth={false}
                onPress={() => onOpenMaps(location.trim())}
                style={styles.mapsBtn}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <Text style={styles.sectionLabel}>Compte-rendu</Text>
      <Card style={styles.card}>
        <View style={styles.durationRow}>
          <View style={styles.durationFieldLeft}>
            <TextField
              label="Durée — heures"
              value={durationH}
              onChangeText={setDurationH}
              keyboardType="number-pad"
              placeholder="0"
            />
          </View>
          <View style={styles.durationField}>
            <TextField
              label="Minutes"
              value={durationM}
              onChangeText={setDurationM}
              keyboardType="number-pad"
              placeholder="00"
            />
          </View>
        </View>
        <Text style={styles.durationHint}>Total : {formatDuration(durationTotal)}</Text>

        <TextField
          label="Matériel utilisé"
          value={materials}
          onChangeText={setMaterials}
          placeholder="Matériel posé / consommé…"
          multiline
          style={styles.multiline}
        />
        <TextField
          label="Problème rapporté"
          value={problem}
          onChangeText={setProblem}
          placeholder="Description du problème…"
          multiline
          style={styles.multiline}
        />
        <TextField
          label="Actions réalisées"
          value={actions}
          onChangeText={setActions}
          placeholder="Interventions effectuées…"
          multiline
          style={styles.multiline}
        />
        <TextField
          label="Suivi"
          value={followUp}
          onChangeText={setFollowUp}
          placeholder="À prévoir / retour requis…"
          multiline
          style={styles.multiline}
        />
        {!elevated ? (
          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
            <Text style={styles.note}>
              Votre rôle enregistre le problème, les actions et le matériel. La durée
              et le suivi ne sont sauvegardés que par un gestionnaire.
            </Text>
          </View>
        ) : null}
      </Card>

      {error && !(elevated && clientId == null) ? (
        <Text style={styles.formError}>{error}</Text>
      ) : null}

      <Button
        title={submitLabel ?? (mode === 'create' ? 'Créer le bon de travail' : 'Enregistrer')}
        onPress={handleSubmit}
        loading={submitting}
      />
      {onCancel ? (
        <Button title="Annuler" variant="ghost" onPress={onCancel} style={styles.cancelBtn} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: typography.h3,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },
  card: { marginBottom: spacing.lg },
  fieldLabel: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dateBtn: { minWidth: 52, paddingHorizontal: spacing.md },
  dateLabel: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  datePlaceholder: { color: colors.disabled, fontWeight: typography.weightMedium },
  dateActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  mapsBtn: { marginTop: -spacing.sm },
  durationRow: { flexDirection: 'row' },
  durationFieldLeft: { flex: 1, marginRight: spacing.md },
  durationField: { flex: 1 },
  durationHint: {
    fontSize: typography.small,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },
  multiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  noteRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  note: { flex: 1, fontSize: typography.tiny, color: colors.textMuted, lineHeight: 16 },
  formError: { color: colors.danger, fontSize: typography.small, marginBottom: spacing.md },
  cancelBtn: { marginTop: spacing.xs },
});
