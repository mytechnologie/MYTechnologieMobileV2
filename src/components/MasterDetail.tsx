/**
 * Conteneur master-détail pour tablette (iPad) : liste à gauche (largeur fixe),
 * détail à droite (flex). Sur téléphone, ce composant n'est PAS utilisé — les
 * écrans gardent leur navigation pile habituelle. Le même code de détail sert
 * donc aux deux plateformes ; seul ce conteneur change.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

/** Largeur du panneau maître (liste) sur tablette. */
const MASTER_WIDTH = 340;

export function MasterDetail({
  master,
  detail,
  empty,
}: {
  master: React.ReactNode;
  detail: React.ReactNode;
  /** Affiché dans le panneau détail quand rien n'est sélectionné. */
  empty?: { icon?: keyof typeof Ionicons.glyphMap; message?: string };
}) {
  return (
    <View style={styles.row}>
      <View style={styles.master}>{master}</View>
      <View style={styles.detail}>
        {detail ?? <MasterDetailEmpty {...empty} />}
      </View>
    </View>
  );
}

export function MasterDetailEmpty({
  icon = 'hand-left-outline',
  message = 'Sélectionnez un élément dans la liste.',
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  message?: string;
}) {
  return (
    <View style={styles.emptyWrap}>
      <Ionicons name={icon} size={44} color={colors.disabled} />
      <Text style={styles.emptyText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
  master: {
    width: MASTER_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  detail: { flex: 1 },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  emptyText: {
    fontSize: typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
