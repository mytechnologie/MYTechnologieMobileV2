/**
 * Commandes en cours — pile sous l'onglet (masqué). La barre du bas reste
 * celle de l'app. Le retour de la liste ramène à l'accueil.
 */
import { Stack, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { useAuth } from '../../../src/auth/AuthContext';
import { canAccess } from '../../../src/auth/access';
import { colors, spacing, typography } from '../../../src/theme';

/** Garde l'écran liste sous un écran ouvert depuis un autre onglet. */
export const unstable_settings = { initialRouteName: 'index' };

function HomeBackLink() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)')}
      style={styles.back}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Retour à l'accueil"
    >
      <Ionicons name="chevron-back" size={22} color={colors.textOnNavy} />
      <Text style={styles.backText}>Accueil</Text>
    </Pressable>
  );
}

export default function CustomerOrdersLayout() {
  const { user, mode } = useAuth();
  const router = useRouter();
  const allowed = !!user && canAccess('customer-orders', user, mode);

  useEffect(() => {
    if (user && !allowed) router.replace('/(tabs)');
  }, [user, allowed, router]);

  if (!allowed) return null;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerTitleStyle: { fontWeight: typography.weightSemibold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Commandes en cours',
          headerBackVisible: false,
          headerLeft: () => <HomeBackLink />,
        }}
      />
      <Stack.Screen name="new" options={{ title: 'Nouvelle commande' }} />
      <Stack.Screen name="[id]" options={{ title: 'Commande' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: spacing.xs,
    marginRight: spacing.sm,
  },
  backText: {
    color: colors.textOnNavy,
    fontSize: typography.body,
    fontWeight: typography.weightMedium,
  },
});
