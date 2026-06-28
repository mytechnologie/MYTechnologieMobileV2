/**
 * Connexion employé par OTP SMS (portalAuth). Étape 1 : téléphone → code.
 * Étape 2 : saisie du code → ouverture de session (x-portal-session).
 */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextField } from '../../src/components/Primitives';
import { useAuth } from '../../src/auth/AuthContext';
import { colors, spacing, typography } from '../../src/theme';

/** Normalise un numéro saisi vers un format E.164 best-effort. */
function normalizePhone(input: string): string {
  const trimmed = input.replace(/[^\d+]/g, '');
  if (trimmed.startsWith('+')) return trimmed;
  // 10 chiffres (Amérique du Nord) → préfixe +1.
  if (trimmed.length === 10) return `+1${trimmed}`;
  if (trimmed.length === 11 && trimmed.startsWith('1')) return `+${trimmed}`;
  return `+${trimmed}`;
}

export default function EmployeeOtpScreen() {
  const router = useRouter();
  const { requestOtp, signInWithOtp } = useAuth();

  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const e164 = normalizePhone(phone);

  const onSendCode = async () => {
    setError(null);
    if (e164.replace(/\D/g, '').length < 10) {
      setError('Entrez un numéro de téléphone valide.');
      return;
    }
    setBusy(true);
    try {
      await requestOtp(e164);
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'envoi du code.");
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    setError(null);
    if (code.trim().length < 4) {
      setError('Entrez le code reçu par SMS.');
      return;
    }
    setBusy(true);
    try {
      await signInWithOtp(e164, code.trim());
      // La garde de navigation redirige automatiquement vers l'app.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide ou expiré.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8}>
            <Ionicons name="chevron-back" size={24} color={colors.textOnNavy} />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>

          <Text style={styles.title}>Connexion employé</Text>
          <Text style={styles.subtitle}>
            {step === 'phone'
              ? 'Recevez un code de vérification par SMS.'
              : `Code envoyé au ${e164}.`}
          </Text>

          <Card style={styles.card}>
            {step === 'phone' ? (
              <>
                <TextField
                  label="Téléphone"
                  placeholder="+1 514 555 1234"
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  value={phone}
                  onChangeText={setPhone}
                  error={error}
                  hint="Format nord-américain accepté (+1 ajouté automatiquement)."
                />
                <Button
                  title="Recevoir le code"
                  variant="primary"
                  loading={busy}
                  onPress={onSendCode}
                />
              </>
            ) : (
              <>
                <TextField
                  label="Code de vérification"
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={8}
                  value={code}
                  onChangeText={setCode}
                  error={error}
                />
                <Button
                  title="Se connecter"
                  variant="primary"
                  loading={busy}
                  onPress={onVerify}
                />
                <Pressable
                  onPress={() => {
                    setStep('phone');
                    setCode('');
                    setError(null);
                  }}
                  style={styles.linkBtn}
                >
                  <Text style={styles.link}>Modifier le numéro</Text>
                </Pressable>
              </>
            )}
          </Card>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  content: { flex: 1, padding: spacing.xl },
  back: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl },
  backText: { color: colors.textOnNavy, fontSize: typography.body },
  title: {
    color: colors.textOnNavy,
    fontSize: typography.h1,
    fontWeight: typography.weightBold,
  },
  subtitle: {
    color: colors.textOnNavy,
    opacity: 0.8,
    fontSize: typography.small,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  card: { gap: spacing.xs },
  linkBtn: { alignItems: 'center', marginTop: spacing.md },
  link: { color: colors.navy, fontWeight: typography.weightSemibold },
});
