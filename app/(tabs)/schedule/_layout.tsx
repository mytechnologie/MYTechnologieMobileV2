import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

/** Garde l'écran liste sous un écran ouvert depuis un autre onglet (bouton retour). */
export const unstable_settings = { initialRouteName: 'index' };

export default function ScheduleLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerTitleStyle: { fontWeight: typography.weightSemibold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Cédule' }} />
      <Stack.Screen name="form" options={{ title: 'Horaire' }} />
    </Stack>
  );
}
