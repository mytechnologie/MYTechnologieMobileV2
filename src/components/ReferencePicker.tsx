/**
 * Sélecteur de rattachement d'une saisie d'heures : projet (puis phase) OU
 * dossier d'enquête, comme sur le portail web. Les listes viennent de
 * timesheet.projectOptions / investigationOptions (session portail employé).
 */
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { timesheet } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import type { ProjectOption, TimesheetLink } from '../api/types';
import { colors, radius, spacing, typography } from '../theme';

export interface LinkSelection {
  link: TimesheetLink;
  label: string | null;
}

export const NO_LINK: LinkSelection = { link: { linkType: null }, label: null };

type Option =
  | { kind: 'project'; key: string; label: string; sublabel: string; project: ProjectOption }
  | { kind: 'investigation'; key: string; label: string; sublabel: string; id: number };

export function ReferencePicker({
  value,
  onChange,
}: {
  value: LinkSelection;
  onChange: (next: LinkSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  /** Projet choisi dont on attend la phase. */
  const [pendingProject, setPendingProject] = useState<ProjectOption | null>(null);

  const projectsQ = useQuery(() => timesheet.projectOptions().catch(() => []), []);
  const investigationsQ = useQuery(
    () => timesheet.investigationOptions().catch(() => []),
    [],
  );

  const options = useMemo<Option[]>(() => {
    const p: Option[] = (projectsQ.data ?? []).map(x => ({
      kind: 'project',
      key: `p:${x.id}`,
      label: x.code ? `${x.code} — ${x.name}` : x.name,
      sublabel: x.clientName ?? 'Projet',
      project: x,
    }));
    const i: Option[] = (investigationsQ.data ?? []).map(x => ({
      kind: 'investigation',
      key: `i:${x.id}`,
      label: x.ticketNumber ? `Enquête ${x.ticketNumber}` : `Enquête #${x.id}`,
      sublabel: x.clientName ?? 'Enquête',
      id: x.id,
    }));
    return [...p, ...i];
  }, [projectsQ.data, investigationsQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      o => o.label.toLowerCase().includes(q) || o.sublabel.toLowerCase().includes(q),
    );
  }, [options, search]);

  const close = () => {
    setOpen(false);
    setSearch('');
    setPendingProject(null);
  };

  const select = (o: Option) => {
    if (o.kind === 'investigation') {
      onChange({ link: { linkType: 'investigation', investigationId: o.id }, label: o.label });
      close();
      return;
    }
    // Projet avec phases : la phase est demandée, comme sur le portail web.
    if (o.project.phases.length > 0) {
      setPendingProject(o.project);
      return;
    }
    onChange({
      link: { linkType: 'project', projectId: o.project.id, projectPhaseId: null },
      label: o.project.name,
    });
    close();
  };

  const selectPhase = (project: ProjectOption, phase: { id: number; name: string }) => {
    onChange({
      link: { linkType: 'project', projectId: project.id, projectPhaseId: phase.id },
      label: `${project.name} › ${phase.name}`,
    });
    close();
  };

  const display = value.label ?? 'Aucun (facultatif)';
  const loading = projectsQ.loading || investigationsQ.loading;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Projet / enquête</Text>
      <Pressable style={styles.selector} onPress={() => setOpen(true)} accessibilityRole="button">
        <Ionicons name="link-outline" size={18} color={colors.textMuted} />
        <Text
          style={[styles.selectorText, value.link.linkType === null && styles.placeholder]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            {pendingProject ? (
              <Pressable onPress={() => setPendingProject(null)} hitSlop={8}>
                <Ionicons name="chevron-back" size={26} color={colors.text} />
              </Pressable>
            ) : null}
            <Text style={styles.modalTitle} numberOfLines={1}>
              {pendingProject ? 'Choisir la phase' : 'Rattacher'}
            </Text>
            <Pressable onPress={close} hitSlop={8}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>

          {pendingProject ? (
            <FlatList
              data={pendingProject.phases}
              keyExtractor={ph => String(ph.id)}
              ListHeaderComponent={<Text style={styles.phaseProject}>{pendingProject.name}</Text>}
              renderItem={({ item }) => (
                <Pressable style={styles.optionRow} onPress={() => selectPhase(pendingProject, item)}>
                  <Ionicons name="git-branch-outline" size={20} color={colors.navy} />
                  <Text style={[styles.optionLabel, styles.optionTextWrap]} numberOfLines={2}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
              contentContainerStyle={styles.listContent}
            />
          ) : (
            <>
              <View style={styles.searchRow}>
                <Ionicons name="search" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un projet, un client, une enquête…"
                  placeholderTextColor={colors.disabled}
                  value={search}
                  onChangeText={setSearch}
                  autoCorrect={false}
                />
              </View>

              <FlatList
                data={filtered}
                keyExtractor={o => o.key}
                ListHeaderComponent={
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => {
                      onChange(NO_LINK);
                      close();
                    }}
                  >
                    <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                    <Text style={styles.optionLabel}>Aucun (facultatif)</Text>
                  </Pressable>
                }
                renderItem={({ item }) => (
                  <Pressable style={styles.optionRow} onPress={() => select(item)}>
                    <Ionicons
                      name={item.kind === 'project' ? 'briefcase-outline' : 'search-outline'}
                      size={20}
                      color={colors.navy}
                    />
                    <View style={styles.optionTextWrap}>
                      <Text style={styles.optionLabel} numberOfLines={1}>
                        {item.label}
                      </Text>
                      <Text style={styles.optionSub} numberOfLines={1}>
                        {item.sublabel}
                      </Text>
                    </View>
                    {item.kind === 'project' && item.project.phases.length > 0 ? (
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    ) : null}
                  </Pressable>
                )}
                ListEmptyComponent={
                  <Text style={styles.empty}>
                    {loading
                      ? 'Chargement…'
                      : 'Aucun élément disponible. Vous pouvez laisser ce champ vide.'}
                  </Text>
                }
                contentContainerStyle={styles.listContent}
              />
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
  },
  selectorText: { flex: 1, fontSize: typography.body, color: colors.text },
  placeholder: { color: colors.disabled },

  modal: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xxl },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  phaseProject: {
    fontSize: typography.small,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    flex: 1,
    marginHorizontal: spacing.sm,
    fontSize: typography.h2,
    fontWeight: typography.weightBold,
    color: colors.text,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginHorizontal: spacing.lg,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontSize: typography.body, color: colors.text },
  listContent: { padding: spacing.lg, gap: spacing.xs },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  optionTextWrap: { flex: 1 },
  optionLabel: { fontSize: typography.small, color: colors.text, fontWeight: typography.weightMedium },
  optionSub: { fontSize: typography.tiny, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
});
