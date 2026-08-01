/**
 * Sélecteur générique « single-select » recherché (modal plein écran).
 * Réutilisable pour le client, le technicien assigné, le type de service…
 *
 * - `allowNone` : ajoute une ligne « Aucun » (désélection / valeur facultative).
 * - `allowCustom` : autorise une valeur libre saisie (ex. type de service hors
 *   liste) — la saisie devient un choix « Utiliser « … » ».
 *
 * Modelé sur ReferencePicker mais paramétrable (options fournies par l'appelant).
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
import { colors, radius, spacing, typography } from '../theme';

export interface PickerOption {
  id: string;
  label: string;
  sublabel?: string;
}

export function EntityPicker({
  label,
  placeholder = 'Sélectionner…',
  value,
  displayLabel,
  options,
  loading = false,
  onSelect,
  required = false,
  allowNone = false,
  noneLabel = 'Aucun',
  allowCustom = false,
  triggerIcon,
  modalTitle,
  searchPlaceholder = 'Rechercher…',
  emptyLabel = 'Aucun élément disponible.',
  error,
  disabled = false,
}: {
  label: string;
  placeholder?: string;
  /** Id sélectionné (ou null). */
  value: string | null;
  /** Libellé à afficher quand une valeur est sélectionnée (sinon résolu depuis options). */
  displayLabel?: string | null;
  options: PickerOption[];
  loading?: boolean;
  /** null quand on choisit « Aucun ». */
  onSelect: (option: PickerOption | null) => void;
  required?: boolean;
  allowNone?: boolean;
  noneLabel?: string;
  allowCustom?: boolean;
  triggerIcon?: keyof typeof Ionicons.glyphMap;
  modalTitle?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  error?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.sublabel ?? '').toLowerCase().includes(q),
    );
  }, [options, search]);

  const resolvedLabel =
    displayLabel ??
    (value != null ? options.find((o) => o.id === value)?.label ?? value : null);

  const close = () => {
    setOpen(false);
    setSearch('');
  };

  const choose = (o: PickerOption | null) => {
    onSelect(o);
    close();
  };

  // Valeur libre : proposée si activée, recherche non vide et pas de correspondance exacte.
  const trimmed = search.trim();
  const showCustom =
    allowCustom &&
    trimmed.length > 0 &&
    !options.some((o) => o.label.toLowerCase() === trimmed.toLowerCase());

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        {label}
        {required ? <Text style={styles.req}> *</Text> : null}
      </Text>
      <Pressable
        style={[styles.selector, error ? styles.selectorError : null, disabled && styles.disabled]}
        onPress={() => !disabled && setOpen(true)}
        accessibilityRole="button"
        disabled={disabled}
      >
        {triggerIcon ? (
          <Ionicons name={triggerIcon} size={18} color={colors.textMuted} />
        ) : null}
        <Text
          style={[styles.selectorText, resolvedLabel == null && styles.placeholder]}
          numberOfLines={1}
        >
          {resolvedLabel ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{modalTitle ?? label}</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button">
              <Ionicons name="close" size={26} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.disabled}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                {allowNone ? (
                  <Pressable style={styles.optionRow} onPress={() => choose(null)}>
                    <Ionicons name="remove-circle-outline" size={20} color={colors.textMuted} />
                    <Text style={styles.optionLabel}>{noneLabel}</Text>
                  </Pressable>
                ) : null}
                {showCustom ? (
                  <Pressable
                    style={styles.optionRow}
                    onPress={() => choose({ id: trimmed, label: trimmed })}
                  >
                    <Ionicons name="add-circle-outline" size={20} color={colors.navy} />
                    <Text style={styles.optionLabel} numberOfLines={1}>
                      Utiliser « {trimmed} »
                    </Text>
                  </Pressable>
                ) : null}
              </>
            }
            renderItem={({ item }) => {
              const selected = item.id === value;
              return (
                <Pressable
                  style={[styles.optionRow, selected && styles.optionSelected]}
                  onPress={() => choose(item)}
                >
                  <View style={styles.optionTextWrap}>
                    <Text style={styles.optionLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.sublabel ? (
                      <Text style={styles.optionSub} numberOfLines={1}>
                        {item.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={20} color={colors.navy} />
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <Text style={styles.empty}>{loading ? 'Chargement…' : emptyLabel}</Text>
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
  req: { color: colors.danger },
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
  selectorError: { borderColor: colors.danger },
  disabled: { opacity: 0.5 },
  selectorText: { flex: 1, fontSize: typography.body, color: colors.text },
  placeholder: { color: colors.disabled },
  errorText: { color: colors.danger, fontSize: typography.tiny, marginTop: spacing.xs },

  modal: { flex: 1, backgroundColor: colors.background, paddingTop: spacing.xxl },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: { fontSize: typography.h2, fontWeight: typography.weightBold, color: colors.text },
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
  optionSelected: { borderColor: colors.navy, borderWidth: 2 },
  optionTextWrap: { flex: 1 },
  optionLabel: {
    fontSize: typography.small,
    color: colors.text,
    fontWeight: typography.weightMedium,
  },
  optionSub: { fontSize: typography.tiny, color: colors.textMuted },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xl },
});
