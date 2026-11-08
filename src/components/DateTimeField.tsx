/**
 * Sélecteur de date ou d'heure natif. iOS : le sélecteur compact de
 * Calendrier, en ligne. Android : un bouton qui ouvre la boîte native.
 */
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, spacing, typography } from '../theme';

export function DateTimeField({
  value,
  mode,
  onChange,
  accessibilityLabel,
}: {
  value: Date;
  mode: 'date' | 'time';
  onChange: (d: Date) => void;
  accessibilityLabel: string;
}) {
  const [open, setOpen] = useState(false);

  if (Platform.OS === 'ios') {
    return (
      <DateTimePicker
        value={value}
        mode={mode}
        display="compact"
        locale="fr-CA"
        minuteInterval={5}
        accentColor={colors.navy}
        onChange={(_e: DateTimePickerEvent, d?: Date) => d && onChange(d)}
        accessibilityLabel={accessibilityLabel}
      />
    );
  }

  const label =
    mode === 'date'
      ? value.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' })
      : value.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={styles.pill}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel} : ${label}`}
      >
        <Text style={styles.pillText}>{label}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={value}
          mode={mode}
          is24Hour
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(d);
          }}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  pillText: { fontSize: typography.body, color: colors.text },
});
