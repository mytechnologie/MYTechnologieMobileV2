/**
 * Lecteur de code-barres / QR plein écran (expo-camera). Sert à relever le
 * numéro de série ou l'adresse MAC imprimés sur l'étiquette d'un appareil.
 */
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRef } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Primitives';
import { colors, radius, spacing, typography } from '../theme';

export function BarcodeScanner({
  visible,
  title,
  onScanned,
  onClose,
}: {
  visible: boolean;
  title: string;
  onScanned: (value: string) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  // La caméra renvoie le même code plusieurs fois par seconde : un seul suffit.
  const done = useRef(false);

  const handle = ({ data }: { data: string }) => {
    if (done.current || !data) return;
    done.current = true;
    onScanned(data.trim());
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onShow={() => {
        done.current = false;
      }}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>{title}</Text>
        {permission?.granted ? (
          <View style={styles.frame}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'datamatrix', 'pdf417'],
              }}
              onBarcodeScanned={handle}
            />
          </View>
        ) : (
          <View style={styles.permission}>
            <Text style={styles.text}>
              La caméra sert à lire l'étiquette de l'appareil (code-barres ou QR).
            </Text>
            <Button title="Autoriser la caméra" variant="gold" onPress={requestPermission} />
          </View>
        )}
        <Text style={styles.hint}>Visez l'étiquette : la lecture est automatique.</Text>
        <Button title="Annuler" variant="secondary" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.navy, padding: spacing.lg, gap: spacing.md },
  title: { color: colors.textOnNavy, fontSize: typography.h3, fontWeight: typography.weightBold },
  frame: { flex: 1, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#000' },
  permission: { flex: 1, justifyContent: 'center', gap: spacing.md },
  text: { color: colors.textOnNavy, fontSize: typography.body, textAlign: 'center' },
  hint: { color: colors.textOnNavy, opacity: 0.8, fontSize: typography.small, textAlign: 'center' },
});
