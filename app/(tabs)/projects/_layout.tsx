import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

/** Garde l'écran liste sous un écran ouvert depuis un autre onglet (bouton retour). */
export const unstable_settings = { initialRouteName: 'index' };

export default function ProjectsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerTitleStyle: { fontWeight: typography.weightSemibold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Projets' }} />
      <Stack.Screen name="[id]" options={{ title: 'Projet' }} />
      <Stack.Screen name="device" options={{ title: 'Appareil' }} />
    </Stack>
  );
}
