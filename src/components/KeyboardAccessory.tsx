/**
 * Barre iOS au-dessus du clavier : précédent, suivant, OK.
 * InputAccessoryView est le repli sans module natif (iOS seulement).
 * Sur Android, le clavier se ferme en glissant la liste ou avec Retour.
 */
import React, { forwardRef, useEffect, useId, useRef, useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../theme';

export const KEYBOARD_ACCESSORY_ID = 'mytech-keyboard-accessory';

type Entry = { id: string; focus: () => void };

const order: Entry[] = [];
const listeners = new Set<() => void>();
let focusedId = '';

function notify() {
  listeners.forEach((listener) => listener());
}

function register(entry: Entry) {
  order.push(entry);
  notify();
}

function unregister(id: string) {
  const index = order.findIndex((entry) => entry.id === id);
  if (index >= 0) order.splice(index, 1);
  if (focusedId === id) focusedId = '';
  notify();
}

function markFocused(id: string) {
  focusedId = id;
  notify();
}

function move(delta: number) {
  const index = order.findIndex((entry) => entry.id === focusedId);
  const start = index === -1 ? (delta > 0 ? -1 : order.length) : index;
  order[start + delta]?.focus();
}

/** TextInput branché sur la barre (précédent / suivant / OK). */
export const AccessoryTextInput = forwardRef<TextInput, TextInputProps>(function AccessoryTextInput(
  { onFocus, ...rest },
  forwarded,
) {
  const localRef = useRef<TextInput>(null);
  const id = useId();

  useEffect(() => {
    register({ id, focus: () => localRef.current?.focus() });
    return () => unregister(id);
  }, [id]);

  return (
    <TextInput
      {...rest}
      ref={(node) => {
        localRef.current = node;
        if (typeof forwarded === 'function') forwarded(node);
        else if (forwarded) forwarded.current = node;
      }}
      inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_ACCESSORY_ID : undefined}
      onFocus={(event) => {
        markFocused(id);
        onFocus?.(event);
      }}
    />
  );
});

export function KeyboardAccessory() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  if (Platform.OS !== 'ios') return null;

  const index = order.findIndex((entry) => entry.id === focusedId);
  const canPrev = index > 0;
  const canNext = index >= 0 && index < order.length - 1;

  return (
    <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
      <View style={styles.bar}>
        <View style={styles.arrows}>
          <Pressable
            onPress={() => move(-1)}
            disabled={!canPrev}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Champ précédent"
          >
            <Ionicons name="chevron-up" size={22} color={canPrev ? colors.navy : colors.disabled} />
          </Pressable>
          <Pressable
            onPress={() => move(1)}
            disabled={!canNext}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Champ suivant"
          >
            <Ionicons name="chevron-down" size={22} color={canNext ? colors.navy : colors.disabled} />
          </Pressable>
        </View>
        <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} accessibilityRole="button" accessibilityLabel="Fermer le clavier">
          <Text style={styles.ok}>OK</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  arrows: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  ok: {
    color: colors.navy,
    fontSize: typography.body,
    fontWeight: typography.weightBold,
  },
});
