import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

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
    </Stack>
  );
}
