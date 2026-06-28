/**
 * Écran d'accueil de connexion : choix du mode (employé OTP / admin mot de passe).
 */
import { useRouter } from 'expo-router';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../../src/components/Primitives';
import { colors, radius, spacing, typography } from '../../src/theme';

export default function SignInScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.brand}>
            M.Y. <Text style={styles.gold}>Technologie</Text>
          </Text>
          <Text style={styles.sub}>& Sécurité</Text>
          <Text style={styles.tagline}>Portail terrain</Text>
        </View>

        <View style={styles.actions}>
          <Button
            title="Connexion employé (SMS)"
            variant="gold"
            onPress={() => router.push('/(auth)/employee-otp')}
          />
          <View style={styles.spacer} />
          <Button
            title="Connexion administrateur"
            variant="secondary"
            onPress={() => router.push('/(auth)/admin-login')}
          />
        </View>

        <View style={styles.footerRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.gold} />
          <Text style={styles.footer}>Accès sécurisé · session 8 h</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.navy },
  content: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'space-between',
  },
  header: { alignItems: 'center', marginTop: spacing.xxxl },
  logo: {
    width: 96,
    height: 96,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  brand: {
    color: colors.textOnNavy,
    fontSize: typography.h1,
    fontWeight: typography.weightBold,
    letterSpacing: 0.5,
  },
  gold: { color: colors.gold },
  sub: {
    color: colors.textOnNavy,
    fontSize: typography.body,
    opacity: 0.85,
    letterSpacing: 2,
  },
  tagline: {
    color: colors.gold,
    fontSize: typography.small,
    marginTop: spacing.md,
    fontWeight: typography.weightMedium,
  },
  actions: { marginVertical: spacing.xl },
  spacer: { height: spacing.md },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  footer: { color: colors.textOnNavy, opacity: 0.7, fontSize: typography.tiny },
});
