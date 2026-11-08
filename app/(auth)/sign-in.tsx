/**
 * Connexion unique (techniciens et administrateurs), même compte que le portail :
 * étape 1 courriel + mot de passe, étape 2 code SMS à 6 chiffres.
 */
import { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, TextField } from '../../src/components/Primitives';
import { useAuth, type OtpChallenge } from '../../src/auth/AuthContext';
import { colors, radius, spacing, typography } from '../../src/theme';

function message(e: unknown, fallback: string): string {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function SignInScreen() {
  const { signIn, verifyCode, resendCode } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState<OtpChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const onContinue = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Entrez votre courriel et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      // null = compte dispensé de code : la garde de navigation prend le relais.
      const next = await signIn(email.trim().toLowerCase(), password);
      if (next) {
        setChallenge(next);
        setInfo('Code envoyé par SMS au numéro de votre compte.');
      }
    } catch (e) {
      setError(message(e, 'Identifiants incorrects.'));
    } finally {
      setBusy(false);
    }
  };

  const onVerify = async () => {
    if (!challenge) return;
    setError(null);
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Entrez le code à 6 chiffres reçu par SMS.');
      return;
    }
    setBusy(true);
    try {
      await verifyCode(challenge, code.trim());
    } catch (e) {
      setError(message(e, 'Code invalide.'));
    } finally {
      setBusy(false);
    }
  };

  const onResend = async () => {
    if (!challenge) return;
    setError(null);
    try {
      await resendCode(challenge);
      setInfo('Nouveau code envoyé.');
    } catch (e) {
      setError(message(e, "Impossible de renvoyer le code pour l'instant."));
    }
  };

  const restart = () => {
    setChallenge(null);
    setCode('');
    setError(null);
    setInfo(null);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require('../../assets/icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.brand}>MY Tech Service</Text>
            <Text style={styles.sub}>M.Y. Technologie & Sécurité</Text>
          </View>

          <Card style={styles.card}>
            {challenge ? (
              <>
                <Text style={styles.title}>Code de vérification</Text>
                <Text style={styles.subtitle}>{info ?? `Compte ${challenge.email}`}</Text>
                <TextField
                  label="Code reçu par SMS"
                  placeholder="123456"
                  keyboardType="number-pad"
                  autoComplete="sms-otp"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  value={code}
                  onChangeText={setCode}
                  error={error}
                />
                <Button title="Se connecter" variant="gold" loading={busy} onPress={onVerify} />
                <View style={styles.row}>
                  <Pressable onPress={restart} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.link}>Changer de compte</Text>
                  </Pressable>
                  <Pressable onPress={onResend} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.link}>Renvoyer le code</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Connexion</Text>
                <Text style={styles.subtitle}>
                  Même compte que le portail. Techniciens et administrateurs.
                </Text>
                <TextField
                  label="Courriel"
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
                <Button title="Continuer" variant="gold" loading={busy} onPress={onContinue} />
                <View style={styles.hint}>
                  <Ionicons name="phone-portrait-outline" size={18} color={colors.navy} />
                  <Text style={styles.hintText}>
                    Un code à 6 chiffres vous sera envoyé par SMS à l'étape suivante.
                  </Text>
                </View>
              </>
            )}
          </Card>

          <Text style={styles.footer}>Connecté 8 h, puis la connexion est redemandée.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  flex: { flex: 1 },
  content: { flexGrow: 1, padding: spacing.xl, justifyContent: 'center', gap: spacing.xl },
  header: { alignItems: 'center', gap: spacing.sm },
  logo: { width: 80, height: 80, borderRadius: radius.lg },
  brand: {
    color: colors.textOnNavy,
    fontSize: typography.h1,
    fontWeight: typography.weightBold,
  },
  sub: { color: colors.textOnNavy, opacity: 0.85, fontSize: typography.small },
  card: { gap: spacing.sm },
  title: { fontSize: typography.h2, fontWeight: typography.weightBold, color: colors.text },
  subtitle: { fontSize: typography.small, color: colors.textMuted, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  link: { color: colors.navy, fontSize: typography.small, fontWeight: typography.weightSemibold },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hintText: { flex: 1, fontSize: typography.tiny, color: colors.text },
  footer: { color: colors.textOnNavy, opacity: 0.7, fontSize: typography.tiny, textAlign: 'center' },
});
