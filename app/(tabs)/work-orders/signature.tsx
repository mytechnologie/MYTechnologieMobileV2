/**
 * Signature du client (maquette écran 4) : le client signe au doigt, la
 * signature part comme photo du bon (légende « Signature du client »), puis
 * le bon passe à « complété ».
 */
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import SignatureScreen, { type SignatureViewRef } from 'react-native-signature-canvas';
import { Button } from '../../../src/components/Primitives';
import { workOrders } from '../../../src/api/endpoints';
import { colors, radius, spacing, typography } from '../../../src/theme';

const WEB_STYLE = `
  .m-signature-pad { box-shadow: none; border: none; }
  .m-signature-pad--body { border: none; }
  .m-signature-pad--footer { display: none; margin: 0; }
  body, html { background: #ffffff; }
`;

export default function SignatureScreenRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ref = useRef<SignatureViewRef>(null);
  const [sending, setSending] = useState(false);

  const onSigned = async (dataUrl: string) => {
    setSending(true);
    try {
      await workOrders.addSignature(String(id), dataUrl);
      await workOrders.changeStatus({ id: String(id), status: 'complete' });
      router.back();
    } catch (e) {
      Alert.alert('Signature', e instanceof Error ? e.message : 'Envoi impossible. Réessayez.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.help}>
        Faites signer le client dans le cadre ci-dessous. Le bon sera ensuite marqué complété.
      </Text>
      <View style={styles.pad}>
        <SignatureScreen
          ref={ref}
          onOK={onSigned}
          onEmpty={() => Alert.alert('Signature', 'Le cadre est vide.')}
          webStyle={WEB_STYLE}
          imageType="image/png"
          autoClear={false}
        />
      </View>
      <View style={styles.actions}>
        <Button
          title="Effacer"
          variant="secondary"
          fullWidth={false}
          style={styles.action}
          disabled={sending}
          onPress={() => ref.current?.clearSignature()}
        />
        <Button
          title="Confirmer et terminer"
          variant="gold"
          fullWidth={false}
          style={styles.action}
          loading={sending}
          onPress={() => ref.current?.readSignature()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg, gap: spacing.md, backgroundColor: colors.background },
  help: { fontSize: typography.small, color: colors.textMuted },
  pad: {
    flex: 1,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  actions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  action: { flex: 1 },
});
