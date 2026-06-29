/**
 * Connexion administrateur / gestionnaire : email + mot de passe (auth.login),
 * avec 2e étape OTP SMS conditionnelle (auth.verifyLoginOtp / resendLoginOtp).
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

export default function AdminLoginScreen() {
  const router = useRouter();
  const { signInWithPassword, verifyAdminOtp, resendAdminOtp } = useAuth();

  const [step, setStep] = useState<'credentials' | 'otp'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmitCredentials = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim() || !password) {
      setError('Entrez votre email et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      const outcome = await signInWithPassword(email.trim().toLowerCase(), password);
      if (outcome.status === 'otp') {
        setChallengeId(outcome.challengeId);
        setStep('otp');
        setInfo('Un code de vérification a été envoyé par SMS.');
      }
      // status 'authenticated' → redirection automatique via la garde de navigation.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identifiants invalides.');
    } finally {
      setBusy(false);
    }
  };

  const onVerifyOtp = async () => {
    setError(null);
    if (!challengeId) {
      setStep('credentials');
      return;
    }
    if (code.trim().length < 4) {
      setError('Entrez le code reçu par SMS.');
      return;
    }
    setBusy(true);
    try {
      await verifyAdminOtp(challengeId, code.trim());
      // Redirection automatique via la garde de navigation.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Code invalide ou expiré.');
    } finally {
      setBusy(false);
    }
  };

  const onResendOtp = async () => {
    if (!challengeId) return;
    setError(null);
    setInfo(null);
    setBusy(true);
    try {
      await resendAdminOtp(challengeId);
      setInfo('Nouveau code envoyé par SMS.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Renvoi impossible.');
    } finally {
      setBusy(false);
    }
  };

  const goBackToCredentials = () => {
    setStep('credentials');
    setCode('');
    setChallengeId(null);
    setError(null);
    setInfo(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <Pressable
            onPress={() => (step === 'otp' ? goBackToCredentials() : router.back())}
            style={styles.back}
            hitSlop={8}
          >
            <Ionicons name="chevron-back" size={24} color={colors.textOnNavy} />
            <Text style={styles.backText}>Retour</Text>
          </Pressable>

          <Text style={styles.title}>Administration</Text>
          <Text style={styles.subtitle}>
            {step === 'credentials'
              ? 'Réservé aux administrateurs et gestionnaires.'
              : 'Saisissez le code de vérification reçu par SMS.'}
          </Text>

          {info ? <Text style={styles.info}>{info}</Text> : null}

          {step === 'credentials' ? (
            <Card style={styles.card}>
              <TextField
                label="Email"
                placeholder="nom@mytechnologie.ca"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Mot de passe"
                placeholder="••••••••"
                secureTextEntry
                autoCapitalize="none"
                autoComplete="password"
                value={password}
                onChangeText={setPassword}
                error={error}
              />
              <Button
                title="Se connecter"
                variant="primary"
                loading={busy}
                onPress={onSubmitCredentials}
              />
            </Card>
          ) : (
            <Card style={styles.card}>
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
                title="Vérifier et se connecter"
                variant="primary"
                loading={busy}
                onPress={onVerifyOtp}
              />
              <Pressable onPress={onResendOtp} disabled={busy} style={styles.linkBtn}>
                <Text style={styles.link}>Renvoyer le code</Text>
              </Pressable>
            </Card>
          )}
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
  info: {
    color: colors.gold,
    fontSize: typography.small,
    marginBottom: spacing.md,
  },
  card: { gap: spacing.xs },
  linkBtn: { alignItems: 'center', marginTop: spacing.md },
  link: { color: colors.navy, fontWeight: typography.weightSemibold },
});
