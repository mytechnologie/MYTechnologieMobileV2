/**
 * Détail « travaillable » d'un bon de travail (technicien terrain) :
 * - adresse cliquable → Google Maps,
 * - saisie durée / matériel / problème / actions / suivi,
 * - photos avant/après (caméra ou galerie, upload multipart REST + suppression),
 * - changement de statut (workflow) et sauvegarde.
 *
 * ⚠️ Réalité backend (workOrders.update) : pour le rôle `technician`, seuls
 * problemDescription, actionsTaken et materialsInternal sont persistés (et si le
 * statut est en_attente/assigne/en_cours, fenêtre 7 jours). durationMinutes et
 * followUp ne sont enregistrés que pour admin/manager. On prévient l'utilisateur.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import * as ImagePicker from 'expo-image-picker';
import {
  Badge,
  Button,
  Card,
  InfoRow,
  SectionTitle,
  TextField,
} from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { workOrders } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import { useClientMap } from '../api/useClientMap';
import { useAuth } from '../auth/AuthContext';
import { isElevated } from '../auth/access';
import {
  WORK_ORDER_STATUS_OPTIONS,
  formatDate,
  formatDuration,
  splitDuration,
  workOrderStatusStyle,
} from '../lib/format';
import type { WorkOrderStatus } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

/** Dérive un nom/type de fichier compatibles backend (jpg/jpeg/png/webp). */
function fileFromAsset(asset: any): {
  uri: string;
  name: string;
  type: string;
} {
  const type = asset.mimeType ?? 'image/jpeg';
  const raw = type.split('/')[1] || 'jpg';
  const ext = raw === 'jpeg' ? 'jpg' : raw;
  const name = asset.fileName ?? `photo-${asset.assetId ?? 'wo'}.${ext}`;
  return { uri: asset.uri, name, type };
}

export function WorkOrderDetailView({
  id,
  embedded = false,
}: {
  id: string;
  /** true quand rendu dans un panneau détail iPad (n'écrit pas le titre du Stack). */
  embedded?: boolean;
}) {
  const navigation = useNavigation();
  const workOrderId = String(id);
  const { clientName } = useClientMap();
  const { user } = useAuth();
  const elevated = !!user && isElevated(user);

  const woQ = useQuery(() => workOrders.getById(workOrderId), [workOrderId]);
  const photosQ = useQuery(() => workOrders.getPhotoUrls(workOrderId), [workOrderId]);
  const changeStatus = useMutation(workOrders.changeStatus);
  const save = useMutation(workOrders.update);

  // Champs éditables (initialisés une fois depuis le bon chargé).
  // Durée saisie en heures + minutes (convertie en minutes à l'envoi).
  const [durationH, setDurationH] = useState('');
  const [durationM, setDurationM] = useState('');
  const [materials, setMaterials] = useState('');
  const [problem, setProblem] = useState('');
  const [actions, setActions] = useState('');
  const [followUp, setFollowUp] = useState('');
  const initedFor = useRef<number | null>(null);

  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(null);
  const [uploading, setUploading] = useState(false);

  const wo = woQ.data;

  useEffect(() => {
    if (wo && initedFor.current !== wo.id) {
      initedFor.current = wo.id;
      if (wo.durationMinutes != null) {
        const { hours, minutes } = splitDuration(wo.durationMinutes);
        setDurationH(String(hours));
        setDurationM(String(minutes));
      } else {
        setDurationH('');
        setDurationM('');
      }
      setMaterials(wo.materialsInternal ?? '');
      setProblem(wo.problemDescription ?? '');
      setActions(wo.actionsTaken ?? '');
      setFollowUp(wo.followUp ?? '');
    }
  }, [wo]);

  useEffect(() => {
    if (!embedded && wo?.ticketNumber) {
      navigation.setOptions({ title: `Bon #${wo.ticketNumber}` });
    }
  }, [embedded, navigation, wo?.ticketNumber]);

  if (woQ.loading) return <LoadingState label="Chargement du bon…" />;
  if (woQ.error || !wo) {
    return <ErrorState message={woQ.error?.message} onRetry={woQ.refetch} />;
  }

  const status = workOrderStatusStyle(wo.status);

  const openMaps = () => {
    if (!wo.location) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wo.location)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir la carte."),
    );
  };

  const onSave = async () => {
    const h = durationH.trim() === '' ? 0 : Number(durationH.trim());
    const m = durationM.trim() === '' ? 0 : Number(durationM.trim());
    if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || m < 0 || m > 59) {
      Alert.alert('Durée invalide', 'Heures ≥ 0 et minutes entre 0 et 59.');
      return;
    }
    const parsedDuration = h > 0 || m > 0 ? Math.floor(h) * 60 + Math.floor(m) : null;
    try {
      await save.mutate({
        id: workOrderId,
        durationMinutes: parsedDuration,
        materialsInternal: materials.trim() || null,
        problemDescription: problem.trim() || null,
        actionsTaken: actions.trim() || null,
        followUp: followUp.trim() || null,
      });
      woQ.refetch();
      Alert.alert('Enregistré', 'Le bon de travail a été mis à jour.');
    } catch (e) {
      Alert.alert(
        'Erreur',
        e instanceof Error ? e.message : 'Enregistrement impossible.',
      );
    }
  };

  const applyStatus = (next: WorkOrderStatus) => {
    if (next === wo.status) return;
    Alert.alert(
      'Changer le statut',
      `Passer le bon au statut « ${workOrderStatusStyle(next).label} » ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Confirmer',
          onPress: async () => {
            setPendingStatus(next);
            try {
              await changeStatus.mutate({ id: workOrderId, status: next });
              woQ.refetch();
            } catch (e) {
              Alert.alert(
                'Erreur',
                e instanceof Error ? e.message : 'Changement de statut impossible.',
              );
            } finally {
              setPendingStatus(null);
            }
          },
        },
      ],
    );
  };

  const uploadFrom = async (source: 'camera' | 'library') => {
    try {
      const perm =
        source === 'camera'
          ? await (await import('expo-image-picker')).requestCameraPermissionsAsync()
          : await (await import('expo-image-picker')).requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission requise',
          source === 'camera'
            ? "Autorisez l'accès à la caméra dans les réglages."
            : "Autorisez l'accès aux photos dans les réglages.",
        );
        return;
      }
      const result =
        source === 'camera'
          ? await (await import('expo-image-picker')).launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
          : await (await import('expo-image-picker')).launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;

      setUploading(true);
      await workOrders.uploadPhoto(workOrderId, fileFromAsset(asset));
      photosQ.refetch();
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : "Échec de l'envoi de la photo.");
    } finally {
      setUploading(false);
    }
  };

  const addPhoto = () => {
    Alert.alert('Ajouter une photo', undefined, [
      { text: 'Prendre une photo', onPress: () => void uploadFrom('camera') },
      { text: 'Choisir dans la galerie', onPress: () => void uploadFrom('library') },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const removePhoto = (photoId: number) => {
    Alert.alert('Supprimer la photo', 'Cette action est définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await workOrders.deletePhoto(photoId);
            photosQ.refetch();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  const photos = Object.entries(photosQ.data ?? {}).map(([pid, url]) => ({
    id: Number(pid),
    url,
  }));

  return (
    <Screen scroll refreshing={woQ.refreshing} onRefresh={woQ.refetch}>
      <Card style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>{wo.serviceType || 'Bon de travail'}</Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        <Text style={styles.number}>#{wo.ticketNumber}</Text>
      </Card>

      <SectionTitle>Informations</SectionTitle>
      <Card style={styles.block}>
        <InfoRow label="Client" value={clientName(wo.clientId)} />
        {wo.serviceDate ? (
          <InfoRow label="Date de service" value={formatDate(wo.serviceDate)} />
        ) : null}
        {wo.location ? (
          <Pressable onPress={openMaps} style={styles.addressRow} accessibilityRole="button">
            <View style={styles.addressText}>
              <Text style={styles.addressLabel}>Adresse</Text>
              <Text style={styles.addressValue}>{wo.location}</Text>
            </View>
            <Ionicons name="navigate-circle" size={26} color={colors.navy} />
          </Pressable>
        ) : null}
      </Card>

      <SectionTitle>Compte-rendu</SectionTitle>
      <Card style={styles.block}>
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
        <Text style={styles.durationHint}>
          Total : {formatDuration(
            (() => {
              const h = Math.max(0, parseInt(durationH, 10) || 0);
              const m = Math.min(59, Math.max(0, parseInt(durationM, 10) || 0));
              return h > 0 || m > 0 ? h * 60 + m : null;
            })(),
          )}
        </Text>
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
          <Text style={styles.note}>
            Note : votre rôle enregistre le problème, les actions et le matériel. La
            durée et le suivi ne sont sauvegardés que par un gestionnaire.
          </Text>
        ) : null}
        <Button
          title="Enregistrer"
          onPress={onSave}
          loading={save.loading}
          style={styles.saveBtn}
        />
      </Card>

      <SectionTitle>Photos</SectionTitle>
      <Card style={styles.block}>
        {photosQ.loading ? (
          <Text style={styles.muted}>Chargement des photos…</Text>
        ) : photos.length === 0 ? (
          <Text style={styles.muted}>Aucune photo pour l'instant.</Text>
        ) : (
          <View style={styles.photoGrid}>
            {photos.map((p) => (
              <View key={p.id} style={styles.photoWrap}>
                <Image source={{ uri: p.url }} style={styles.photo} />
                <Pressable
                  style={styles.photoDelete}
                  onPress={() => removePhoto(p.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Ionicons name="close-circle" size={22} color={colors.danger} />
                </Pressable>
              </View>
            ))}
          </View>
        )}
        <Button
          title={uploading ? 'Envoi…' : 'Ajouter une photo'}
          variant="secondary"
          onPress={addPhoto}
          disabled={uploading}
          style={styles.saveBtn}
        />
        {uploading ? (
          <ActivityIndicator color={colors.navy} style={{ marginTop: spacing.sm }} />
        ) : null}
      </Card>

      <SectionTitle>Changer le statut</SectionTitle>
      <View style={styles.statusGrid}>
        {WORK_ORDER_STATUS_OPTIONS.map((opt) => {
          const s = workOrderStatusStyle(opt);
          const active = opt === wo.status;
          const busy = pendingStatus === opt;
          return (
            <Pressable
              key={opt}
              disabled={changeStatus.loading || active}
              onPress={() => applyStatus(opt)}
              style={({ pressed }) => [
                styles.statusChip,
                { borderColor: active ? s.color : colors.border },
                active && { backgroundColor: s.bg },
                pressed && styles.pressed,
                changeStatus.loading && !busy && styles.dim,
              ]}
            >
              <Text
                style={[styles.statusChipText, { color: active ? s.color : colors.text }]}
              >
                {busy ? '…' : s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerCard: { marginBottom: spacing.lg, gap: spacing.xs },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  number: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.navy,
  },
  block: { marginBottom: spacing.lg },
  muted: { fontSize: typography.small, color: colors.textMuted },
  note: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  multiline: { minHeight: 92, paddingTop: spacing.md, textAlignVertical: 'top' },
  saveBtn: { marginTop: spacing.xs },
  durationRow: { flexDirection: 'row' },
  durationFieldLeft: { flex: 1, marginRight: spacing.md },
  durationField: { flex: 1 },
  durationHint: {
    fontSize: typography.small,
    color: colors.textMuted,
    marginTop: -spacing.xs,
    marginBottom: spacing.md,
  },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  addressText: { flex: 1 },
  addressLabel: { fontSize: typography.small, color: colors.textMuted },
  addressValue: {
    fontSize: typography.small,
    color: colors.navy,
    fontWeight: typography.weightMedium,
    textDecorationLine: 'underline',
  },

  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  photoWrap: { position: 'relative' },
  photo: {
    width: 104,
    height: 104,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  photoDelete: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },

  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  statusChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  statusChipText: { fontSize: typography.small, fontWeight: typography.weightSemibold },
  pressed: { opacity: 0.7 },
  dim: { opacity: 0.5 },
});
