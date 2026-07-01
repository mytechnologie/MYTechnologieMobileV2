/**
 * Accueil — dashboard adapté au rôle.
 * Employé : résumé d'heures + bouton « Saisir des heures ».
 * Admin/manager : projets actifs, bons de travail du jour.
 */
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Button, Card, SectionTitle } from '../../src/components/Primitives';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthContext';
import { isElevated } from '../../src/auth/access';
import { projects as projectsApi, timesheet, workOrders } from '../../src/api/endpoints';
import { useQuery } from '../../src/api/useApi';
import { formatHours } from '../../src/lib/time';
import { toISODate } from '../../src/lib/format';
import { colors, radius, spacing, typography } from '../../src/theme';

/** Lundi 00:00 de la semaine courante. */
function startOfWeek(now: Date): Date {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = (d.getDay() + 6) % 7; // 0 = lundi
  d.setDate(d.getDate() - day);
  return d;
}

function StatCard({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <Card style={styles.stat}>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Ionicons name={icon} size={20} color={colors.navy} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Card>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const elevated = !!user && isElevated(user);

  const entriesQ = useQuery(() => timesheet.myEntries(), []);
  const projectsQ = useQuery(
    () => (elevated ? projectsApi.list() : Promise.resolve([])),
    [elevated],
  );
  const workOrdersQ = useQuery(
    () => (elevated ? workOrders.list() : Promise.resolve([])),
    [elevated],
  );

  const weekSummary = useMemo(() => {
    const entries = entriesQ.data ?? [];
    const weekStart = startOfWeek(new Date());
    let total = 0;
    let drafts = 0;
    let submitted = 0;
    for (const e of entries) {
      const d = new Date(e.date);
      if (!Number.isNaN(d.getTime()) && d >= weekStart) total += e.totalHours || 0;
      if (e.status === 'draft') drafts += 1;
      if (e.status === 'submitted') submitted += 1;
    }
    return { total, drafts, submitted };
  }, [entriesQ.data]);

  const todayISO = toISODate(new Date());
  const todaysWorkOrders = (workOrdersQ.data ?? []).filter((w) => {
    if (!w.serviceDate) return false;
    const d = new Date(w.serviceDate);
    return !Number.isNaN(d.getTime()) && toISODate(d) === todayISO;
  }).length;
  const activeProjects = (projectsQ.data ?? []).filter(
    (p) => p.status === 'en_cours' || p.status === 'planification',
  ).length;

  const refreshing =
    entriesQ.refreshing || projectsQ.refreshing || workOrdersQ.refreshing;
  const onRefresh = () => {
    entriesQ.refetch();
    if (elevated) {
      projectsQ.refetch();
      workOrdersQ.refetch();
    }
  };

  return (
    <Screen scroll padded={false} refreshing={refreshing} onRefresh={onRefresh} edges={['top']}>
      <AppHeader />

      <View style={styles.body}>
        {/* Résumé d'heures — visible pour tous. */}
        <SectionTitle>Mes heures cette semaine</SectionTitle>
        <Card style={styles.hoursCard}>
          <View style={styles.hoursMain}>
            <Text style={styles.hoursTotal}>{formatHours(weekSummary.total)}</Text>
            <Text style={styles.hoursCaption}>cumulées depuis lundi</Text>
          </View>
          <View style={styles.hoursMeta}>
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{weekSummary.drafts}</Text>
              <Text style={styles.metaLabel}>brouillon(s)</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaValue}>{weekSummary.submitted}</Text>
              <Text style={styles.metaLabel}>en attente</Text>
            </View>
          </View>
        </Card>

        <Button
          title="Saisir des heures"
          variant="gold"
          onPress={() => router.push('/(tabs)/timesheet/new')}
          style={styles.cta}
        />

        {/* Section admin/manager. */}
        {elevated ? (
          <View style={styles.adminBlock}>
            <SectionTitle>Aperçu</SectionTitle>
            <View style={styles.statsRow}>
              <StatCard
                icon="briefcase-outline"
                value={String(activeProjects)}
                label="Projets actifs"
                tint={colors.infoBg}
              />
              <StatCard
                icon="construct-outline"
                value={String(todaysWorkOrders)}
                label="Bons aujourd'hui"
                tint={colors.warningBg}
              />
            </View>

            <View style={styles.quickLinks}>
              <Button
                title="Voir les projets"
                variant="secondary"
                onPress={() => router.push('/(tabs)/projects')}
              />
              <View style={{ height: spacing.sm }} />
              <Button
                title="Voir les bons de travail"
                variant="secondary"
                onPress={() => router.push('/(tabs)/work-orders')}
              />
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { padding: spacing.lg },
  hoursCard: { marginBottom: spacing.lg },
  hoursMain: { alignItems: 'flex-start' },
  hoursTotal: {
    fontSize: 40,
    fontWeight: typography.weightBold,
    color: colors.navy,
  },
  hoursCaption: { color: colors.textMuted, fontSize: typography.small },
  hoursMeta: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  metaValue: {
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  metaLabel: { fontSize: typography.tiny, color: colors.textMuted },
  cta: { marginBottom: spacing.xl },
  adminBlock: { marginTop: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
  stat: { flex: 1, alignItems: 'flex-start' },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  statValue: {
    fontSize: typography.h1,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  statLabel: { fontSize: typography.small, color: colors.textMuted },
  quickLinks: { marginTop: spacing.xs },
});
