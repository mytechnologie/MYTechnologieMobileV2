/**
 * Section photos réutilisable (bons de travail ET tâches projet) : affichage en
 * grille, ajout par caméra/galerie (expo-image-picker en import PARESSEUX pour
 * éviter tout coût natif au démarrage) et suppression. L'appelant fournit les
 * URLs présignées et les callbacks d'upload/suppression (endpoint spécifique).
 */
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Primitives';
import type { PhotoFile, PhotoUrls } from '../api/endpoints';
import { colors, radius, spacing, typography } from '../theme';

/** Dérive un nom/type de fichier compatibles backend (jpg/jpeg/png/webp). */
function fileFromAsset(asset: {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  assetId?: string | null;
}): PhotoFile {
  const type = asset.mimeType ?? 'image/jpeg';
  const raw = type.split('/')[1] || 'jpg';
  const ext = raw === 'jpeg' ? 'jpg' : raw;
  const name = asset.fileName ?? `photo-${asset.assetId ?? 'x'}.${ext}`;
  return { uri: asset.uri, name, type };
}

export function PhotoSection({
  urls,
  loading,
  upload,
  remove,
  onChanged,
}: {
  urls: PhotoUrls | null;
  loading: boolean;
  upload: (file: PhotoFile) => Promise<unknown>;
  remove: (photoId: number) => Promise<unknown>;
  onChanged: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const photos = Object.entries(urls ?? {}).map(([pid, url]) => ({ id: Number(pid), url }));

  const uploadFrom = async (source: 'camera' | 'library') => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
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
          ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;

      setUploading(true);
      await upload(fileFromAsset(asset));
      onChanged();
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
            await remove(photoId);
            onChanged();
          } catch (e) {
            Alert.alert('Erreur', e instanceof Error ? e.message : 'Suppression impossible.');
          }
        },
      },
    ]);
  };

  return (
    <View>
      {loading ? (
        <Text style={styles.muted}>Chargement des photos…</Text>
      ) : photos.length === 0 ? (
        <Text style={styles.muted}>Aucune photo pour l'instant.</Text>
      ) : (
        <View style={styles.grid}>
          {photos.map((p) => (
            <View key={p.id} style={styles.wrap}>
              <Image source={{ uri: p.url }} style={styles.photo} />
              <Pressable
                style={styles.delete}
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
        style={styles.addBtn}
      />
      {uploading ? (
        <ActivityIndicator color={colors.navy} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  muted: { fontSize: typography.small, color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  wrap: { position: 'relative' },
  photo: { width: 104, height: 104, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  delete: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
  },
  addBtn: { marginTop: spacing.xs },
});
