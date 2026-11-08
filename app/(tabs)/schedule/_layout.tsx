import { Stack } from 'expo-router';
import { colors, typography } from '../../../src/theme';

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
