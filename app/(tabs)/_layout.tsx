/**
 * Navigation par onglets, filtrée selon le rôle.
 * Employé régulier : Accueil + Heures. Admin/manager/super_admin : les 4 sections.
 */
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/auth/AuthContext';
import { canAccess } from '../../src/auth/access';
import { colors, typography } from '../../src/theme';

export default function TabsLayout() {
  const { user } = useAuth();

  // Sans utilisateur (transition de déconnexion), la garde racine redirige.
  const showProjects = !!user && canAccess('projects', user);
  const showWorkOrders = !!user && canAccess('work-orders', user);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: typography.tiny,
          fontWeight: typography.weightMedium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: 'Projets',
          href: showProjects ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="briefcase-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="work-orders"
        options={{
          title: 'Bons',
          href: showWorkOrders ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="construct-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="timesheet"
        options={{
          title: 'Heures',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
