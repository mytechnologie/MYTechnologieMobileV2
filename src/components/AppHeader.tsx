/**
 * En-tête de marque navy/gold : nom + rôle de l'utilisateur + déconnexion.
 */
import React from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { roleLabel } from '../lib/format';
import { colors, radius, spacing, typography } from '../theme';

export function AppHeader({ subtitle }: { subtitle?: string }) {
  const { user, signOut } = useAuth();

  const confirmSignOut = () => {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.brandRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.brand}>
            M.Y. <Text style={styles.brandGold}>Technologie</Text>
          </Text>
          <Text style={styles.brandSub}>& Sécurité</Text>
        </View>
        <Pressable
          onPress={confirmSignOut}
          style={({ pressed }) => [styles.logout, pressed && styles.pressed]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
        >
          <Ionicons name="log-out-outline" size={22} color={colors.textOnNavy} />
        </Pressable>
      </View>

      <View style={styles.userRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.name ?? '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {user?.name ?? 'Utilisateur'}
          </Text>
          <Text style={styles.userRole}>
            {subtitle ?? (user ? roleLabel(user.role) : '')}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.navy,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleBlock: { flexDirection: 'column' },
  brand: {
    color: colors.textOnNavy,
    fontSize: typography.h3,
    fontWeight: typography.weightBold,
    letterSpacing: 0.5,
  },
  brandGold: { color: colors.gold },
  brandSub: {
    color: colors.textOnNavy,
    fontSize: typography.tiny,
    opacity: 0.8,
    letterSpacing: 1,
  },
  logout: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.navyLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.textOnGold,
    fontSize: typography.h3,
    fontWeight: typography.weightBold,
  },
  userInfo: { flex: 1 },
  userName: {
    color: colors.textOnNavy,
    fontSize: typography.body,
    fontWeight: typography.weightSemibold,
  },
  userRole: {
    color: colors.gold,
    fontSize: typography.small,
    fontWeight: typography.weightMedium,
  },
});
