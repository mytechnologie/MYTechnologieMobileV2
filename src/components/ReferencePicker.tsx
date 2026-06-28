/**
 * Sélecteur recherché de projet OU bon de travail à rattacher à une saisie d'heures.
 * Charge les listes accessibles ; dégrade proprement si l'API les refuse (employé).
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
import { projects as projectsApi, workOrders } from '../api/endpoints';
import { useQuery } from '../api/useApi';
import { colors, radius, spacing, typography } from '../theme';

export type LinkSelection =
  | { kind: 'none' }
  | { kind: 'project'; id: string; label: string }
  | { kind: 'workOrder'; id: string; label: string };

interface Option {
  kind: 'project' | 'workOrder';
  id: string;
  label: string;
  sublabel: string;
}

export function ReferencePicker({
  value,
  onChange,
}: {
  value: LinkSelection;
  onChange: (next: LinkSelection) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const projectsQ = useQuery(
    () => projectsApi.list().catch(() => []),
    [],
  );
  const workOrdersQ = useQuery(
    () => workOrders.list().catch(() => []),
    [],
  );

  const options = useMemo<Option[]>(() => {
    const p: Option[] = (projectsQ.data ?? []).map((x) => ({
      kind: 'project',
      id: x.id,
      label: x.name,
      sublabel: x.client ?? 'Projet',
    }));
    const w: Option[] = (workOrdersQ.data ?? []).map((x) => ({
      kind: 'workOrder',
      id: x.id,
      label: `#${x.number} — ${x.title}`,
      sublabel: x.client ?? 'Bon de travail',
    }));
    return [...p, ...w];
  }, [projectsQ.data, workOrdersQ.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.sublabel.toLowerCase().includes(q),
    );
  }, [options, search]);

  const display =
    value.kind === 'none' ? 'Aucun (facultatif)' : value.label;

  const select = (o: Option) => {
    onChange({ kind: o.kind, id: o.id, label: o.label });
    setOpen(false);
    setSearch('');
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Projet / bon de travail</Text>
      <Pressable
        style={styles.selector}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        <Ionicons name="link-outline" size={18} color={colors.textMuted} />
        <Text
          style={[
            styles.selectorText,
            value.kind === 'none' && styles.placeholder,
          ]}
          numberOfLines={1}
        >
          {display}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rattacher</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un projet ou un bon…"
              placeholderTextColor={colors.disabled}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(o) => `${o.kind}:${o.id}`}
            ListHeaderComponent={
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  onChange({ kind: 'none' });
                  setOpen(false);
                  setSearch('');
                }}
              >
                <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                <Text style={styles.optionLabel}>Aucun (facultatif)</Text>
              </Pressable>
            }
            renderItem={({ item }) => (
              <Pressable style={styles.optionRow} onPress={() => select(item)}>
                <Ionicons
                  name={item.kind === 'project' ? 'briefcase-outline' : 'construct-outline'}
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
              </Pressable>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {projectsQ.loading || workOrdersQ.loading
                  ? 'Chargement…'
                  : 'Aucun élément disponible. Vous pouvez laisser ce champ vide.'}
              </Text>
            }
            contentContainerStyle={styles.listContent}
          />
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
  modalTitle: {
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
