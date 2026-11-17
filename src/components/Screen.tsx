/**
 * Conteneur d'écran : fond clair, safe area, clavier.
 * Le défilement et un éventuel pied (barre d'enregistrement, actions) sont
 * dans le même KeyboardAvoidingView : le pied reste au-dessus du clavier.
 * behavior « padding » sur iOS et Android. Le décalage est la hauteur réelle
 * du header (useHeaderHeight), pas une constante.
 */
import React from 'react';
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { KeyboardAccessoryScope } from './KeyboardAccessory';
import { keyboardDismissMode, useKeyboardVerticalOffset } from '../lib/keyboard';
import { colors, spacing } from '../theme';

interface ScreenProps {
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  edges?: Edge[];
  /** Padding horizontal/vertical par défaut. */
  padded?: boolean;
  /**
   * Pied fixe, frère du défilement, donc collé au-dessus du clavier.
   * Ignoré quand scroll est false : placer alors le pied comme enfant, après le ScrollView.
   */
  footer?: React.ReactNode;
}

export function Screen({
  children,
  scroll = false,
  refreshing = false,
  onRefresh,
  contentStyle,
  edges = ['top', 'left', 'right'],
  padded = true,
  footer,
}: ScreenProps) {
  const headerOffset = useKeyboardVerticalOffset();
  const padding = padded ? { padding: spacing.lg } : undefined;

  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      <KeyboardAccessoryScope>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={headerOffset}
      >
        {scroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.scrollContent, padding, contentStyle]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={keyboardDismissMode}
            refreshControl={
              onRefresh ? (
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={colors.navy}
                  colors={[colors.navy]}
                />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, padding, contentStyle]}>{children}</View>
        )}
        {scroll ? footer : null}
      </KeyboardAvoidingView>
      </KeyboardAccessoryScope>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
});
