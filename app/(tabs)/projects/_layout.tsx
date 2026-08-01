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
      <Stack.Screen name="task" options={{ title: 'Tâche' }} />
      <Stack.Screen name="plan" options={{ title: 'Plan' }} />
      <Stack.Screen name="reports" options={{ title: 'Rapports' }} />
      <Stack.Screen name="report" options={{ title: 'Rapport' }} />
      <Stack.Screen name="report-new" options={{ title: 'Nouveau rapport' }} />
    </Stack>
  );
}
