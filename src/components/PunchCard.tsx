/**
 * Carte de pointage (maquette accueil technicien) : « En service depuis… »
 * avec « Fin de journée », ou « Commencer ma journée » quand on n'est pas
 * pointé. S'appuie sur punch.getStatus / clockIn / clockOut du portail.
 */
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Button, Card } from './Primitives';
import { punch } from '../api/endpoints';
import { useMutation, useQuery } from '../api/useApi';
import { colors, spacing, typography } from '../theme';

function clock(d: Date): string {
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`;
}

function duration(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** `refreshKey` : incrémenté par l'écran parent pour forcer un rechargement. */
export function PunchCard({ refreshKey = 0 }: { refreshKey?: number }) {
  const statusQ = useQuery(() => punch.status(), [refreshKey]);
  const clockIn = useMutation(punch.clockIn);
  const clockOut = useMutation(punch.clockOut);
  const [now, setNow] = useState(() => Date.now());

  // Rafraîchit la durée affichée chaque minute.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const status = statusQ.data;
  const inService = !!status?.isClockedIn && !!status.since;

  const start = async () => {
    try {
      await clockIn.mutate({});
      statusQ.refetch();
    } catch (e) {
      Alert.alert('Pointage', e instanceof Error ? e.message : 'Pointage impossible.');
    }
  };

  const stop = () => {
    Alert.alert('Fin de journée', 'Pointer votre départ maintenant ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Pointer',
        onPress: async () => {
          try {
            await clockOut.mutate(undefined);
            statusQ.refetch();
          } catch (e) {
            Alert.alert('Pointage', e instanceof Error ? e.message : 'Pointage impossible.');
          }
        },
      },
    ]);
  };

  return (
    <Card style={styles.card}>
      <View style={[styles.dot, inService ? styles.dotOn : styles.dotOff]} />
      <View style={styles.text}>
        {statusQ.loading ? (
          <Text style={styles.title}>Pointage…</Text>
        ) : inService && status?.since ? (
          <>
            <Text style={styles.title}>En service depuis {clock(status.since)}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {duration(now - status.since.getTime())}
              {status.label ? ` · ${status.label}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>Hors service</Text>
            <Text style={styles.sub}>
              {statusQ.error ? 'Pointage indisponible' : 'Pointez votre arrivée'}
            </Text>
          </>
        )}
      </View>
      {statusQ.error ? (
        <Button title="Réessayer" variant="secondary" fullWidth={false} onPress={statusQ.refetch} />
      ) : inService ? (
        <Button title="Fin de journée" fullWidth={false} loading={clockOut.loading} onPress={stop} />
      ) : (
        <Button
          title="Commencer"
          variant="gold"
          fullWidth={false}
          loading={clockIn.loading}
          disabled={statusQ.loading}
          onPress={start}
        />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  dot: { width: 12, height: 12, borderRadius: 6 },
  dotOn: { backgroundColor: colors.success },
  dotOff: { backgroundColor: colors.disabled },
  text: { flex: 1 },
  title: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  sub: { fontSize: typography.small, color: colors.textMuted },
});
