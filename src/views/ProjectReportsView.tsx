/**
 * Rapports d'un projet : liste filtrable par type + création + fiche.
 *
 * Sur iPad (deux panneaux), la liste reste à gauche et la fiche (ou le
 * formulaire de création) occupe le panneau de droite — on ne perd jamais le
 * contexte du chantier. Sur téléphone, la liste pousse la fiche sur la pile.
 */
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { MasterDetail } from '../components/MasterDetail';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { ProjectReportView } from './ProjectReportView';
import { ProjectReportCreateView } from './ProjectReportCreateView';
import { projectReports } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import { useResponsive } from '../lib/responsive';
import {
  PROJECT_REPORT_TYPES,
  formatCAD,
  formatDate,
  projectReportStatusStyle,
  projectReportTypeStyle,
} from '../lib/format';
import type { ProjectReportListItem, ProjectReportType } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

type Filter = ProjectReportType | 'all';

/** Carte d'un rapport dans la liste. */
function ReportCard({
  item,
  selected,
  onPress,
}: {
  item: ProjectReportListItem;
  selected?: boolean;
  onPress: () => void;
}) {
  const t = projectReportTypeStyle(item.type);
  const s = projectReportStatusStyle(item.status);
  const isExtra = item.type === 'travaux_extra';

  return (
    <Card
      style={selected ? { ...styles.card, ...styles.cardSelected } : styles.card}
      onPress={onPress}
    >
      <View style={[styles.typeStrip, { backgroundColor: t.color }]} />
      <View style={styles.rowTop}>
        <Text style={styles.number}>{item.reportNumber}</Text>
        <Badge label={s.label} color={s.color} bg={s.bg} />
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      <View style={styles.metaLine}>
        <View style={[styles.typeChip, { backgroundColor: t.bg }]}>
          <Ionicons name={t.icon} size={12} color={t.color} />
          <Text style={[styles.typeChipText, { color: t.color }]}>{t.label}</Text>
        </View>
        <Text style={styles.muted}>{formatDate(item.createdAt)}</Text>
        {item.photoCount > 0 ? (
          <View style={styles.photoCount}>
            <Ionicons name="camera-outline" size={12} color={colors.textMuted} />
            <Text style={styles.muted}>{item.photoCount}</Text>
          </View>
        ) : null}
      </View>
      {isExtra ? (
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>À facturer</Text>
          <Text style={styles.amountValue}>{formatCAD(item.billingAmount)}</Text>
        </View>
      ) : null}
    </Card>
  );
}

/** Panneau liste : total à facturer, filtres par type, cartes. */
function ReportsList({
  reports,
  loading,
  error,
  refreshing,
  onRefresh,
  onRetry,
  selectedId,
  onSelect,
  onCreate,
}: {
  reports: ProjectReportListItem[];
  loading: boolean;
  error?: Error | null;
  refreshing: boolean;
  onRefresh: () => void;
  onRetry: () => void;
  selectedId?: number | null;
  onSelect: (id: number) => void;
  onCreate: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');

  const extraTotal = useMemo(
    () =>
      reports
        .filter((r) => r.type === 'travaux_extra')
        .reduce((sum, r) => sum + (Number(r.billingAmount ?? 0) || 0), 0),
    [reports],
  );
  const extraCount = reports.filter((r) => r.type === 'travaux_extra').length;
  const shown = filter === 'all' ? reports : reports.filter((r) => r.type === filter);

  if (loading) return <LoadingState label="Chargement des rapports…" />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={onRefresh}>
      <Button title="+ Nouveau rapport" onPress={onCreate} style={styles.createBtn} />

      {extraCount > 0 ? (
        <Card style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <Ionicons name="cash-outline" size={20} color={colors.goldDark} />
          </View>
          <View style={styles.totalText}>
            <Text style={styles.totalLabel}>Travaux extra à facturer</Text>
            <Text style={styles.totalValue}>{formatCAD(extraTotal)}</Text>
          </View>
          <Text style={styles.muted}>
            {extraCount} rapport{extraCount > 1 ? 's' : ''}
          </Text>
        </Card>
      ) : null}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="Tous"
          count={reports.length}
          active={filter === 'all'}
          color={colors.navy}
          bg={colors.surfaceAlt}
          onPress={() => setFilter('all')}
        />
        {PROJECT_REPORT_TYPES.map((opt) => {
          const t = projectReportTypeStyle(opt);
          return (
            <FilterChip
              key={opt}
              label={t.label}
              count={reports.filter((r) => r.type === opt).length}
              active={filter === opt}
              color={t.color}
              bg={t.bg}
              icon={t.icon}
              onPress={() => setFilter(opt)}
            />
          );
        })}
      </ScrollView>

      {shown.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="document-text-outline"
            title={reports.length === 0 ? 'Aucun rapport' : 'Aucun rapport de ce type'}
            message={
              reports.length === 0
                ? 'Créez un rapport de travaux extra, d’avancement, de fin de projet ou de déficiences.'
                : undefined
            }
          />
        </View>
      ) : (
        <View style={styles.list}>
          {shown.map((r) => (
            <ReportCard
              key={r.id}
              item={r}
              selected={selectedId === r.id}
              onPress={() => onSelect(r.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function FilterChip({
  label,
  count,
  active,
  color,
  bg,
  icon,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  color: string;
  bg: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        { borderColor: active ? color : colors.border },
        active && { backgroundColor: bg },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? color : colors.textMuted} /> : null}
      <Text style={[styles.filterChipText, { color: active ? color : colors.text }]}>
        {label} ({count})
      </Text>
    </Pressable>
  );
}

export function ProjectReportsView({ projectId }: { projectId: string }) {
  const router = useRouter();
  const { twoPane } = useResponsive();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const listQ = useQuery(() => projectReports.listByProject(projectId), [projectId]);
  const reports = listQ.data ?? [];

  const openOnPhone = (id: number) =>
    router.push(`/projects/report?projectId=${projectId}&reportId=${id}`);

  const list = (
    <ReportsList
      reports={reports}
      loading={listQ.loading}
      error={listQ.error}
      refreshing={listQ.refreshing}
      onRefresh={listQ.refetch}
      onRetry={listQ.refetch}
      selectedId={twoPane ? selectedId : null}
      onSelect={(id) => {
        if (twoPane) {
          setCreating(false);
          setSelectedId(id);
        } else {
          openOnPhone(id);
        }
      }}
      onCreate={() => {
        if (twoPane) {
          setSelectedId(null);
          setCreating(true);
        } else {
          router.push(`/projects/report-new?projectId=${projectId}`);
        }
      }}
    />
  );

  if (!twoPane) return list;

  // iPad : liste à gauche, fiche ou création à droite.
  const detail = creating ? (
    <ProjectReportCreateView
      projectId={projectId}
      embedded
      onCreated={(id) => {
        setCreating(false);
        setSelectedId(id);
        listQ.refetch();
      }}
      onCancel={() => setCreating(false)}
    />
  ) : selectedId != null ? (
    <ProjectReportView reportId={selectedId} embedded onChanged={listQ.refetch} />
  ) : null;

  return (
    <MasterDetail
      master={list}
      detail={detail}
      empty={{ icon: 'document-text-outline', message: 'Sélectionnez un rapport.' }}
    />
  );
}

const styles = StyleSheet.create({
  createBtn: { marginBottom: spacing.lg },

  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderColor: colors.gold,
    borderWidth: 1.5,
  },
  totalIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.warningBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalText: { flex: 1 },
  totalLabel: {
    fontSize: typography.tiny,
    fontWeight: typography.weightSemibold,
    color: colors.goldDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  totalValue: {
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.navy,
  },

  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.lg },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    backgroundColor: colors.surface,
  },
  filterChipText: { fontSize: typography.tiny, fontWeight: typography.weightSemibold },
  pressed: { opacity: 0.7 },

  list: { gap: spacing.md },
  card: { gap: spacing.xs, overflow: 'hidden', paddingLeft: spacing.lg + 4 },
  cardSelected: { borderColor: colors.navy, borderWidth: 2 },
  typeStrip: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  number: { fontSize: typography.tiny, color: colors.textMuted, letterSpacing: 0.5 },
  title: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  typeChipText: { fontSize: typography.tiny, fontWeight: typography.weightSemibold },
  photoCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  muted: { fontSize: typography.tiny, color: colors.textMuted },

  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  amountLabel: {
    fontSize: typography.tiny,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: typography.body,
    fontWeight: typography.weightBold,
    color: colors.navy,
  },

  emptyWrap: { minHeight: 220 },
});
