import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

/** Garde l'écran liste sous un écran ouvert depuis un autre onglet (bouton retour). */
export const unstable_settings = { initialRouteName: 'index' };

export default function WorkOrdersLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerTitleStyle: { fontWeight: typography.weightSemibold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Bons de travail' }} />
      <Stack.Screen name="new" options={{ title: 'Nouveau bon' }} />
      <Stack.Screen name="[id]" options={{ title: 'Bon de travail' }} />
      <Stack.Screen name="signature" options={{ title: 'Signature du client' }} />
    </Stack>
  );
}
