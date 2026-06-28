/**
 * Connexion administrateur / gestionnaire : email + mot de passe (adminAuth.login).
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
  const { signInWithPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    setError(null);
    if (!email.trim() || !password) {
      setError('Entrez votre email et votre mot de passe.');
      return;
    }
    setBusy(true);
    try {
      await signInWithPassword(email.trim().toLowerCase(), password);
      // Redirection automatique via la garde de navigation.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Identifiants invalides.');
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

          <Text style={styles.title}>Administration</Text>
          <Text style={styles.subtitle}>
            Réservé aux administrateurs et gestionnaires.
          </Text>

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
              onPress={onSubmit}
            />
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
});
