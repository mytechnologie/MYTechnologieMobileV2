/**
 * Cédule — liste des blocs d'horaire de travail de l'utilisateur connecté,
 * groupés par jour. Bouton « + » pour créer, tap sur un bloc pour modifier.
 *
 * ⚠️ calendar_schedules = horaire de travail (titre + plage horaire), pas des
 * rendez-vous client (ni type, ni clientId, ni lieu côté backend).
 */
import { useCallback, useLayoutEffect, useMemo } from 'react';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from '../../../src/components/Primitives';
import { EmptyState, ErrorState, LoadingState } from '../../../src/components/States';
import { schedule } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import { toISODate } from '../../../src/lib/format';
import type { ScheduleItem } from '../../../src/api/types';
import { colors, spacing, typography } from '../../../src/theme';

/** 'YYYY-MM-DD' → 'jeudi 3 juillet' en date LOCALE (évite le décalage UTC). */
function frDate(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('fr-CA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

interface DaySection {
  date: string;
  items: ScheduleItem[];
}

export default function ScheduleListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();

  // Fenêtre : aujourd'hui → +60 jours. userId = utilisateur connecté (sa cédule).
  const today = toISODate(new Date());
  const endDate = toISODate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));
  const userId = user ? Number(user.id) : undefined;

  const { data, loading, error, refetch, refreshing } = useQuery(
    () => schedule.list({ startDate: today, endDate, userId }),
    [today, endDate, userId],
  );

  // Recharge en revenant sur l'écran (après création/édition).
  useFocusEffect(useCallback(() => void refetch(), [refetch]));

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable onPress={() => router.push('/schedule/form')} hitSlop={10}>
          <Ionicons name="add" size={28} color={colors.textOnNavy} />
        </Pressable>
      ),
    });
  }, [navigation, router]);

  const sections = useMemo<DaySection[]>(() => {
    const map = new Map<string, ScheduleItem[]>();
    for (const it of data ?? []) {
      if (!map.has(it.workDate)) map.set(it.workDate, []);
      map.get(it.workDate)!.push(it);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, items]) => ({
        date,
        items: items.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [data]);

  if (loading) return <LoadingState label="Chargement de la cédule…" />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <FlatList
      data={sections}
      keyExtractor={(s) => s.date}
      contentContainerStyle={styles.list}
      onRefresh={refetch}
      refreshing={refreshing}
      renderItem={({ item: section }) => (
        <View style={styles.section}>
          <Text style={styles.dateHeader}>{frDate(section.date)}</Text>
          {section.items.map((it) => (
            <Card
              key={it.id}
              style={styles.card}
              onPress={() => router.push(`/schedule/form?id=${it.id}`)}
            >
              <View
                style={[
                  styles.colorBar,
                  { backgroundColor: it.color || colors.navy },
                ]}
              />
              <View style={styles.cardBody}>
                <Text style={styles.time}>
                  {it.startTime} – {it.endTime}
                </Text>
                <Text style={styles.title} numberOfLines={1}>
                  {it.title}
                </Text>
                {it.notes ? (
                  <Text style={styles.notes} numberOfLines={1}>
                    {it.notes}
                  </Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Card>
          ))}
        </View>
      )}
      ListEmptyComponent={
        <EmptyState
          icon="calendar-outline"
          title="Aucun horaire"
          message="Touchez + pour ajouter un bloc à votre cédule."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, gap: spacing.lg, flexGrow: 1 },
  section: { gap: spacing.sm },
  dateHeader: {
    fontSize: typography.small,
    fontWeight: typography.weightBold,
    color: colors.navy,
    textTransform: 'capitalize',
  },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 0, overflow: 'hidden' },
  colorBar: { width: 5, alignSelf: 'stretch' },
  cardBody: { flex: 1, paddingVertical: spacing.md, gap: 2 },
  time: { fontSize: typography.small, fontWeight: typography.weightBold, color: colors.text },
  title: { fontSize: typography.small, color: colors.text },
  notes: { fontSize: typography.tiny, color: colors.textMuted },
});
