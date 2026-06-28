/**
 * Primitives UI réutilisables : Button, TextField, Card, Badge, titres, lignes info.
 * Mobile-first, cibles tactiles larges, palette claire centralisée.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, typography } from '../theme';

/* --------------------------------- Button ---------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'gold' | 'danger' | 'ghost';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const v = BUTTON_VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border },
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.buttonDisabled,
        style,
      ]}
      accessibilityRole="button"
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: v.fg }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const BUTTON_VARIANTS: Record<
  ButtonVariant,
  { bg: string; fg: string; border: string }
> = {
  primary: { bg: colors.navy, fg: colors.textOnNavy, border: colors.navy },
  secondary: { bg: colors.surface, fg: colors.navy, border: colors.borderStrong },
  gold: { bg: colors.gold, fg: colors.textOnGold, border: colors.gold },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.navy, border: 'transparent' },
};

/* -------------------------------- TextField -------------------------------- */

interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, error, hint, style, ...rest }: TextFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.disabled}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

/* ---------------------------------- Card ----------------------------------- */

interface CardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Card({ children, onPress, style }: CardProps) {
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

/* ---------------------------------- Badge ---------------------------------- */

export function Badge({
  label,
  color,
  bg,
}: {
  label: string;
  color: string;
  bg: string;
}) {
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/* ---------------------------- Titres & lignes ------------------------------ */

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

/** Barre d'avancement 0–100. */
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <View style={styles.progressTrack}>
      <View style={[styles.progressFill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: 0.7 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: {
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
  },

  fieldWrap: { marginBottom: spacing.lg },
  label: {
    fontSize: typography.small,
    fontWeight: typography.weightSemibold,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    minHeight: 50,
    fontSize: typography.body,
    color: colors.text,
  },
  inputError: { borderColor: colors.danger },
  errorText: {
    color: colors.danger,
    fontSize: typography.tiny,
    marginTop: spacing.xs,
  },
  hintText: {
    color: colors.textMuted,
    fontSize: typography.tiny,
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    ...shadow.card,
  },

  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  badgeText: {
    fontSize: typography.tiny,
    fontWeight: typography.weightSemibold,
  },

  sectionTitle: {
    fontSize: typography.h3,
    fontWeight: typography.weightBold,
    color: colors.text,
    marginBottom: spacing.md,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: spacing.sm,
    gap: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  infoLabel: { fontSize: typography.small, color: colors.textMuted, flexShrink: 0 },
  infoValue: {
    fontSize: typography.small,
    color: colors.text,
    fontWeight: typography.weightMedium,
    flexShrink: 1,
    textAlign: 'right',
  },

  progressTrack: {
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
});
