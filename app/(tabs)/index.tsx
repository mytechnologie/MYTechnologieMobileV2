/**
 * Accueil — dashboard adapté au rôle.
 * Employé : résumé d'heures + bouton « Saisir des heures ».
 * Technicien et gestion : « Mes bons aujourd'hui » (bons du jour et bons en
 * route / sur place), ouverts d'un toucher.
 * Admin/manager : projets actifs, bons de travail du jour.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppHeader } from '../../src/components/AppHeader';
import { Badge, Button, Card, SectionTitle } from '../../src/components/Primitives';
import { Screen } from '../../src/components/Screen';
import { useAuth } from '../../src/auth/AuthContext';
import { canAccess, isElevated } from '../../src/auth/access';
import { approvals, projects as projectsApi, timesheet, workOrders } from '../../src/api/endpoints';
import { PunchCard } from '../../src/components/PunchCard';
import { useQuery } from '../../src/api/useApi';
import { formatHours } from '../../src/lib/time';
import { formatDate, toISODate, workOrderStatusStyle } from '../../src/lib/format';
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
  const { user, mode } = useAuth();
  const elevated = !!user && mode === 'token' && isElevated(user);
  const fieldUser = !!user && canAccess('work-orders', user, mode);

  const [punchKey, setPunchKey] = useState(0);
  const entriesQ = useQuery(() => timesheet.myEntries(), []);
  // Approbations : le portail refuse (FORBIDDEN) ceux qui n'ont aucun droit
  // d'approbation ; la section reste alors cachée.
  const approvalsQ = useQuery(() => approvals.queue().catch(() => null), []);
  const projectsQ = useQuery(
    () => (elevated ? projectsApi.list() : Promise.resolve([])),
    [elevated],
  );
  const workOrdersQ = useQuery(
    () => (fieldUser ? workOrders.list() : Promise.resolve([])),
    [fieldUser],
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
  const todaysWorkOrders = (workOrdersQ.data ?? []).filter(
    (w) => !!w.scheduledDate && toISODate(new Date(w.scheduledDate)) === todayISO,
  ).length;
  // Mes bons : ceux du jour et ceux déjà en route / sur place (le portail
  // ne renvoie au technicien que ses propres bons).
  const myWorkOrders = (workOrdersQ.data ?? [])
    .filter(
      (w) =>
        w.status === 'en_route' ||
        w.status === 'en_cours' ||
        (!!w.scheduledDate &&
          toISODate(new Date(w.scheduledDate)) === todayISO &&
          !['complete', 'en_revision', 'a_facturer', 'facture', 'non_facture'].includes(w.status)),
    )
    .slice(0, 8);
  const approvalGroups = approvalsQ.data ?? [];
  const approvalHours = approvalGroups.reduce((sum, g) => sum + g.totalHours, 0);
  const activeProjects = (projectsQ.data ?? []).filter(
    (p) => p.status === 'en_cours' || p.status === 'preparation' || p.status === 'reception',
  ).length;

  const refreshing =
    entriesQ.refreshing || projectsQ.refreshing || workOrdersQ.refreshing;
  const onRefresh = () => {
    entriesQ.refetch();
    approvalsQ.refetch();
    setPunchKey((k) => k + 1);
    if (fieldUser) workOrdersQ.refetch();
    if (elevated) projectsQ.refetch();
  };

  return (
    <Screen scroll padded={false} refreshing={refreshing} onRefresh={onRefresh} edges={['top']}>
      <AppHeader />

      <View style={styles.body}>
        <PunchCard refreshKey={punchKey} />

        {approvalGroups.length > 0 ? (
          <View style={styles.myBlock}>
            <SectionTitle>À approuver</SectionTitle>
            <Card style={styles.woCard} onPress={() => router.push('/(tabs)/timesheet/approvals', { withAnchor: true })}>
              <View style={styles.woTop}>
                <Text style={styles.woTitle}>
                  {approvalGroups.length} employé{approvalGroups.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.woNumber}>{formatHours(approvalHours)}</Text>
              </View>
              <Text style={styles.woMeta} numberOfLines={1}>
                {approvalGroups.map((g) => g.userName).join(', ')}
              </Text>
            </Card>
          </View>
        ) : null}

        {fieldUser ? (
          <View style={styles.myBlock}>
            <SectionTitle>Mes bons aujourd'hui</SectionTitle>
            {myWorkOrders.length === 0 ? (
              <Card>
                <Text style={styles.empty}>
                  {workOrdersQ.loading ? 'Chargement…' : "Aucun bon prévu aujourd'hui."}
                </Text>
              </Card>
            ) : (
              myWorkOrders.map((w) => {
                const st = workOrderStatusStyle(w.status);
                return (
                  <Card
                    key={w.id}
                    style={styles.woCard}
                    onPress={() => router.push(`/(tabs)/work-orders/${w.id}`, { withAnchor: true })}
                  >
                    <View style={styles.woTop}>
                      <Text style={styles.woNumber}>{w.number}</Text>
                      <Badge label={st.label} color={st.color} bg={st.bg} />
                    </View>
                    <Text style={styles.woTitle} numberOfLines={1}>
                      {w.client ? `${w.client} · ` : ''}
                      {w.title}
                    </Text>
                    {w.address ? (
                      <Text style={styles.woMeta} numberOfLines={1}>{w.address}</Text>
                    ) : w.scheduledDate ? (
                      <Text style={styles.woMeta}>{formatDate(w.scheduledDate)}</Text>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        ) : null}

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
          onPress={() => router.push('/(tabs)/timesheet/new', { withAnchor: true })}
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
  myBlock: { marginBottom: spacing.lg },
  empty: { color: colors.textMuted, fontSize: typography.small },
  woCard: { marginBottom: spacing.sm, gap: spacing.xs },
  woTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  woNumber: { fontSize: typography.small, fontWeight: typography.weightBold, color: colors.navy },
  woTitle: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  woMeta: { fontSize: typography.small, color: colors.textMuted },
});
