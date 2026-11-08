/**
 * Vue partagée (téléphone : route [id] ; iPad : panneau de droite).
 * Suivi de projet (maquette écran « Projet ») : avancement, phases avec leurs
 * sous-phases à cocher, et appareils du chantier (statut, relevé, scan).
 * Les changements passent par les routes terrain du portail
 * (projects.fieldSetPhaseStatus / fieldUpdateDevice).
 */
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, ProgressBar } from '../components/Primitives';
import { Screen } from '../components/Screen';
import { ErrorState, LoadingState } from '../components/States';
import { projects as projectsApi } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import { deviceStatusStyle, projectStatusStyle, taskStatusStyle } from '../lib/format';
import { formatHours } from '../lib/time';
import type { PhaseStatus, ProjectDevice, ProjectPhase } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

type Tab = 'phases' | 'devices';

/** Avancement d'une phase : part des sous-phases terminées, sinon son statut. */
function phasePct(ph: ProjectPhase): number {
  if (ph.children.length > 0) {
    const done = ph.children.filter(c => c.status === 'terminee').length;
    return Math.round((done / ph.children.length) * 100);
  }
  return ph.status === 'terminee' ? 100 : ph.status === 'en_cours' ? 50 : 0;
}

function PhaseCard({
  phase,
  index,
  onSet,
  busyId,
}: {
  phase: ProjectPhase;
  index: number;
  onSet: (id: string, status: PhaseStatus) => void;
  busyId: string | null;
}) {
  const pct = phasePct(phase);
  const st = taskStatusStyle(phase.status);
  const current = phase.status === 'en_cours';
  const next: { status: PhaseStatus; label: string } | null =
    phase.status === 'a_venir'
      ? { status: 'en_cours', label: 'Démarrer la phase' }
      : phase.status === 'en_cours'
        ? { status: 'terminee', label: 'Terminer la phase' }
        : null;

  return (
    <Card style={[styles.phase, current && styles.phaseCurrent]}>
      <View style={styles.rowBetween}>
        <Text style={styles.phaseName}>
          {index + 1}. {phase.name}
        </Text>
        <Badge
          label={current && phase.children.length > 0 ? `${st.label} · ${pct} %` : st.label}
          color={st.color}
          bg={st.bg}
        />
      </View>
      <ProgressBar value={pct} />
      {phase.hoursPct != null ? (
        <Text style={styles.muted}>Heures : {phase.hoursPct} % du budget</Text>
      ) : null}
      {phase.children.map(c => {
        const done = c.status === 'terminee';
        return (
          <Pressable
            key={c.id}
            style={styles.check}
            disabled={busyId === c.id}
            onPress={() => onSet(c.id, done ? 'en_cours' : 'terminee')}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
          >
            <Ionicons
              name={done ? 'checkbox' : 'square-outline'}
              size={24}
              color={busyId === c.id ? colors.disabled : colors.navy}
            />
            <Text style={[styles.checkLabel, done && styles.checkDone]}>{c.name}</Text>
          </Pressable>
        );
      })}
      {next ? (
        <Button
          title={next.label}
          variant="secondary"
          loading={busyId === phase.id}
          onPress={() => onSet(phase.id, next.status)}
        />
      ) : null}
    </Card>
  );
}

function DeviceRow({ device, onPress }: { device: ProjectDevice; onPress: () => void }) {
  const st = deviceStatusStyle(device.status);
  const meta = [device.model, device.serialNumber && `S/N ${device.serialNumber}`, device.ipAddress]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable style={styles.device} onPress={onPress} accessibilityRole="button">
      <View style={styles.deviceText}>
        <Text style={styles.deviceName}>{device.name}</Text>
        <Text style={styles.muted} numberOfLines={1}>
          {meta || device.location || 'Aucun relevé'}
        </Text>
      </View>
      <Badge label={st.label} color={st.color} bg={st.bg} />
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export function ProjectDetailView({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const navigation = useNavigation();
  const router = useRouter();
  const projectId = String(id);
  const [tab, setTab] = useState<Tab>('phases');
  const [busyId, setBusyId] = useState<string | null>(null);

  const q = useQuery(() => projectsApi.getById(projectId), [projectId]);

  useEffect(() => {
    if (!embedded && q.data?.code) navigation.setOptions({ title: q.data.code });
  }, [embedded, navigation, q.data?.code]);

  // Retour de la fiche d'un appareil : relevés à jour.
  useFocusEffect(
    useCallback(() => {
      q.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const byZone = useMemo(() => {
    const groups = new Map<string, ProjectDevice[]>();
    for (const d of q.data?.devices ?? []) {
      const key = d.zone ?? 'Sans zone';
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    return [...groups.entries()];
  }, [q.data?.devices]);

  if (q.loading) return <LoadingState label="Chargement du projet…" />;
  if (q.error || !q.data) return <ErrorState message={q.error?.message} onRetry={q.refetch} />;

  const project = q.data;
  const status = projectStatusStyle(project.status);
  const progress = project.progress ?? 0;
  const installed = project.devices.filter(d => d.status !== 'prevu').length;

  const setPhase = async (phaseId: string, next: PhaseStatus) => {
    setBusyId(phaseId);
    try {
      await projectsApi.setPhaseStatus(phaseId, next);
      q.refetch();
    } catch (e) {
      Alert.alert('Phase', e instanceof Error ? e.message : 'Mise à jour impossible.');
    } finally {
      setBusyId(null);
    }
  };

  const openDevice = (deviceId: string) =>
    router.push({ pathname: '/(tabs)/projects/device', params: { projectId, deviceId } });

  return (
    <Screen scroll refreshing={q.refreshing} onRefresh={q.refetch}>
      <Card style={styles.header}>
        <View style={styles.rowBetween}>
          <Text style={styles.kicker} numberOfLines={1}>
            {[project.code, project.client].filter(Boolean).join(' · ')}
          </Text>
          <Badge label={status.label} color={status.color} bg={status.bg} />
        </View>
        <Text style={styles.title}>{project.title}</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.body}>Avancement {Math.round(progress)} %</Text>
          <Text style={styles.muted}>
            {formatHours(project.spentHours ?? 0)} / {formatHours(project.budgetHours ?? 0)}
          </Text>
        </View>
        <ProgressBar value={progress} />
      </Card>

      <View style={styles.tabs}>
        {(
          [
            ['phases', `Phases (${project.phases.length})`],
            ['devices', `Appareils (${installed}/${project.devices.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <Pressable
            key={key}
            style={[styles.tab, tab === key && styles.tabOn]}
            onPress={() => setTab(key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'phases' ? (
        project.phases.length === 0 ? (
          <Card>
            <Text style={styles.muted}>Aucune phase définie au portail.</Text>
          </Card>
        ) : (
          project.phases.map((ph, i) => (
            <PhaseCard key={ph.id} phase={ph} index={i} onSet={setPhase} busyId={busyId} />
          ))
        )
      ) : project.devices.length === 0 ? (
        <Card>
          <Text style={styles.muted}>Aucun appareil prévu sur ce projet.</Text>
        </Card>
      ) : (
        byZone.map(([zone, devices]) => (
          <View key={zone} style={styles.zone}>
            <Text style={styles.zoneTitle}>{zone}</Text>
            <Card style={styles.deviceList}>
              {devices.map(d => (
                <DeviceRow key={d.id} device={d} onPress={() => openDevice(d.id)} />
              ))}
            </Card>
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginBottom: spacing.md, gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  kicker: { flex: 1, fontSize: typography.small, color: colors.textMuted, fontWeight: typography.weightSemibold },
  title: { fontSize: typography.h3, fontWeight: typography.weightBold, color: colors.text },
  body: { fontSize: typography.body, color: colors.text },
  muted: { fontSize: typography.small, color: colors.textMuted },
  tabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  tab: {
    flex: 1,
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  tabText: { fontSize: typography.small, fontWeight: typography.weightSemibold, color: colors.navy },
  tabTextOn: { color: colors.textOnNavy },
  phase: { marginBottom: spacing.md, gap: spacing.sm },
  phaseCurrent: { borderWidth: 2, borderColor: colors.gold },
  phaseName: { flex: 1, fontSize: typography.body, fontWeight: typography.weightBold, color: colors.text },
  check: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 40 },
  checkLabel: { flex: 1, fontSize: typography.body, color: colors.text },
  checkDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  zone: { marginBottom: spacing.md },
  zoneTitle: {
    fontSize: typography.tiny,
    fontWeight: typography.weightBold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  deviceList: { paddingVertical: 0 },
  device: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  deviceText: { flex: 1 },
  deviceName: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
});
