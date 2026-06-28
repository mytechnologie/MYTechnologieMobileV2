import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

export default function TimesheetLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.navy },
        headerTintColor: colors.textOnNavy,
        headerTitleStyle: { fontWeight: typography.weightSemibold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Saisie d'heures" }} />
      <Stack.Screen name="new" options={{ title: 'Nouvelle saisie', presentation: 'modal' }} />
      <Stack.Screen name="[id]" options={{ title: 'Modifier la saisie', presentation: 'modal' }} />
    </Stack>
  );
}
