/**
 * Détail « travaillable » d'un bon de travail :
 * - édition de TOUS les champs via le formulaire partagé (WorkOrderForm) —
 *   complet pour admin/manager, restreint au compte-rendu pour un technicien,
 * - adresse cliquable → Google Maps,
 * - photos avant/après (caméra ou galerie, upload multipart REST + suppression),
 * - changement de statut (workflow).
 *
 * ⚠️ Réalité backend (workOrders.update) : pour le rôle `technician`, seuls
 * problemDescription, actionsTaken et materialsInternal sont persistés (et si le
 * statut est en_attente/assigne/en_cours, fenêtre 7 jours). Le formulaire prévient
 * l'utilisateur ; on n'envoie donc que ces champs pour ce rôle.
 */
import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
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
import {
  Badge,
  Button,
  Card,
  InfoRow,
  SectionTitle,
} from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { WorkOrderForm, type WorkOrderFormValues } from '../components/WorkOrderForm';
import { workOrders } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import { useClientMap } from '../api/useClientMap';
import { useAuth } from '../auth/AuthContext';
import { isElevated } from '../auth/access';
import {
  WORK_ORDER_STATUS_OPTIONS,
  formatDate,
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

  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(null);
  const [uploading, setUploading] = useState(false);

  const wo = woQ.data;

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

  const openMaps = (address: string) => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    Linking.openURL(url).catch(() =>
      Alert.alert('Erreur', "Impossible d'ouvrir la carte."),
    );
  };

  const onSubmitEdit = async (v: WorkOrderFormValues) => {
    try {
      if (elevated) {
        await save.mutate({
          id: workOrderId,
          clientId: v.clientId ?? undefined,
          technicianId: v.technicianId,
          serviceType: v.serviceType,
          location: v.location,
          serviceDate: v.serviceDate,
          durationMinutes: v.durationMinutes,
          materialsInternal: v.materialsInternal,
          problemDescription: v.problemDescription,
          actionsTaken: v.actionsTaken,
          followUp: v.followUp,
        });
      } else {
        // Technicien : le backend n'accepte que ces trois champs.
        await save.mutate({
          id: workOrderId,
          problemDescription: v.problemDescription,
          actionsTaken: v.actionsTaken,
          materialsInternal: v.materialsInternal,
        });
      }
      woQ.refetch();
      Alert.alert('Enregistré', 'Le bon de travail a été mis à jour.');
    } catch (e) {
      Alert.alert('Erreur', e instanceof Error ? e.message : 'Enregistrement impossible.');
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

      {/* Rappel lecture seule pour le technicien (le formulaire ne montre pas
          client/date/adresse pour ce rôle). Les rôles élevés éditent tout via le
          formulaire, adresse → Maps incluse. */}
      {!elevated ? (
        <>
          <SectionTitle>Informations</SectionTitle>
          <Card style={styles.block}>
            <InfoRow label="Client" value={clientName(wo.clientId)} />
            {wo.serviceDate ? (
              <InfoRow label="Date de service" value={formatDate(wo.serviceDate)} />
            ) : null}
            {wo.location ? (
              <Pressable
                onPress={() => openMaps(wo.location as string)}
                style={styles.addressRow}
                accessibilityRole="button"
              >
                <View style={styles.addressText}>
                  <Text style={styles.addressLabel}>Adresse</Text>
                  <Text style={styles.addressValue}>{wo.location}</Text>
                </View>
                <Ionicons name="navigate-circle" size={26} color={colors.navy} />
              </Pressable>
            ) : null}
          </Card>
        </>
      ) : null}

      <WorkOrderForm
        key={wo.id}
        mode="edit"
        elevated={elevated}
        initial={wo}
        submitting={save.loading}
        onSubmit={onSubmitEdit}
        onOpenMaps={openMaps}
      />

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
  saveBtn: { marginTop: spacing.xs },

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
