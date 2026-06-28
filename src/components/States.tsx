/**
 * États transverses : chargement, erreur (avec réessai), liste vide.
 */
import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';
import { Button } from './Primitives';

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.navy} />
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
      <Text style={styles.title}>Une erreur est survenue</Text>
      <Text style={styles.muted}>
        {message ?? 'Impossible de charger les données. Vérifiez la connexion.'}
      </Text>
      {onRetry ? (
        <View style={styles.action}>
          <Button title="Réessayer" variant="secondary" onPress={onRetry} fullWidth={false} />
        </View>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'file-tray-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={44} color={colors.textMuted} />
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  title: {
    fontSize: typography.h3,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    textAlign: 'center',
  },
  muted: {
    fontSize: typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  action: { marginTop: spacing.md },
});
