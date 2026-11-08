/**
 * Cédule, façon Calendrier : vues jour, semaine et mois, sur un ou plusieurs
 * calendriers (le sien et ceux des collègues), avec les bons de travail
 * assignés. Les rendez-vous se créent avec « + » ; leurs alertes sont
 * planifiées sur l'appareil (src/notifications/reminders.ts).
 */
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ErrorState, LoadingState } from '../../../src/components/States';
import { schedule } from '../../../src/api/endpoints';
import { useQuery } from '../../../src/api/useApi';
import { useAuth } from '../../../src/auth/AuthContext';
import {
  DAY_LETTERS,
  PERSON_COLORS,
  addDays,
  frTime,
  longDay,
  minutesOf,
  monthGrid,
  monthTitle,
  parseYmd,
  weekStart,
  ymd,
} from '../../../src/lib/calendar';
import type { AgendaEntry } from '../../../src/api/types';
import { colors, radius, spacing, typography } from '../../../src/theme';

type View3 = 'day' | 'week' | 'month';

const HOUR_HEIGHT = 56;
const VIEWS: { key: View3; label: string }[] = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { user } = useAuth();
  const me = user ? Number(user.id) : null;

  const [view, setView] = useState<View3>('month');
  const [cursor, setCursor] = useState(() => new Date());
  const [shown, setShown] = useState<number[]>([]);
  const [showWorkOrders, setShowWorkOrders] = useState(true);

  const visible = shown.length > 0 ? shown : me != null ? [me] : [];
  const selected = ymd(cursor);

  // Plage chargée : la grille du mois, élargie à la semaine affichée.
  const { startDate, endDate } = useMemo(() => {
    const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
    const ws = weekStart(cursor);
    const first = grid[0]! < ws ? grid[0]! : ws;
    const lastGrid = grid[grid.length - 1]!;
    const we = addDays(ws, 6);
    const last = lastGrid > we ? lastGrid : we;
    return { startDate: ymd(first), endDate: ymd(last) };
  }, [cursor]);

  const peopleQ = useQuery(() => schedule.people().catch(() => []), []);
  const people = useMemo(() => peopleQ.data ?? [], [peopleQ.data]);
  const personColor = useMemo(() => {
    const map = new Map<number, string>();
    people.forEach((p, i) => map.set(p.id, PERSON_COLORS[i % PERSON_COLORS.length]!));
    return map;
  }, [people]);

  const visibleKey = visible.join(',');
  const agendaQ = useQuery(
    () => schedule.agenda({ startDate, endDate, userIds: visible, includeWorkOrders: showWorkOrders }),
    [startDate, endDate, visibleKey, showWorkOrders],
  );
  useFocusEffect(
    useCallback(() => {
      agendaQ.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={() => router.push({ pathname: '/schedule/form', params: { date: selected } })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Nouveau rendez-vous"
        >
          <Ionicons name="add" size={28} color={colors.textOnNavy} />
        </Pressable>
      ),
    });
  }, [navigation, router, selected]);

  const byDay = useMemo(() => {
    const map = new Map<string, AgendaEntry[]>();
    for (const e of agendaQ.data ?? []) {
      if (!map.has(e.date)) map.set(e.date, []);
      map.get(e.date)!.push(e);
    }
    return map;
  }, [agendaQ.data]);

  const colorOf = (e: AgendaEntry) => e.color ?? personColor.get(e.userId) ?? colors.navy;
  const multi = visible.length > 1;

  const toggle = (id: number) => {
    setShown(cur => {
      const base = cur.length > 0 ? cur : me != null ? [me] : [];
      const next = base.includes(id) ? base.filter(x => x !== id) : [...base, id];
      return next.length > 0 ? next : base;
    });
  };

  const move = (dir: -1 | 1) => {
    setCursor(d => {
      if (view === 'day') return addDays(d, dir);
      if (view === 'week') return addDays(d, dir * 7);
      return new Date(d.getFullYear(), d.getMonth() + dir, 1);
    });
  };

  const open = (e: AgendaEntry) => {
    if (e.kind === 'work_order') {
      router.push(`/(tabs)/work-orders/${e.id}`, { withAnchor: true });
      return;
    }
    if (e.canEdit) {
      router.push({
        pathname: '/schedule/form',
        params: { id: String(e.id), date: e.date, userId: String(e.userId) },
      });
      return;
    }
    const when = e.allDay ? 'Toute la journée' : `${frTime(e.start)} – ${frTime(e.end)}`;
    Alert.alert(
      e.title,
      [e.userName, longDay(parseYmd(e.date)), when, e.location, e.notes].filter(Boolean).join('\n'),
    );
  };

  const title =
    view === 'month'
      ? monthTitle(cursor)
      : view === 'week'
        ? weekTitle(weekStart(cursor))
        : longDay(cursor);

  return (
    <View style={styles.screen}>
      <View style={styles.toolbar}>
        <View style={styles.segment} accessibilityRole="tablist">
          {VIEWS.map(v => (
            <Pressable
              key={v.key}
              onPress={() => setView(v.key)}
              style={[styles.segItem, view === v.key && styles.segItemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: view === v.key }}
            >
              <Text style={[styles.segText, view === v.key && styles.segTextOn]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.navRow}>
          <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Précédent" style={styles.navBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.textOnNavy} />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {title}
          </Text>
          <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="Suivant" style={styles.navBtn}>
            <Ionicons name="chevron-forward" size={22} color={colors.textOnNavy} />
          </Pressable>
          <Pressable onPress={() => setCursor(new Date())} hitSlop={6} style={styles.todayBtn}>
            <Text style={styles.todayText}>{"Aujourd'hui"}</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {people.map(p => {
            const on = visible.includes(p.id);
            const c = personColor.get(p.id) ?? colors.navy;
            return (
              <Pressable
                key={p.id}
                onPress={() => toggle(p.id)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <View style={[styles.chipDot, { borderColor: c, backgroundColor: on ? c : 'transparent' }]} />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {p.id === me ? 'Moi' : p.name}
                </Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => setShowWorkOrders(v => !v)}
            style={[styles.chip, showWorkOrders && styles.chipOn]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: showWorkOrders }}
          >
            <Ionicons name="construct-outline" size={13} color={showWorkOrders ? colors.navy : colors.textOnNavy} />
            <Text style={[styles.chipText, showWorkOrders && styles.chipTextOn]}>Bons</Text>
          </Pressable>
        </ScrollView>
      </View>

      {agendaQ.error && !agendaQ.data ? (
        <ErrorState message={agendaQ.error.message} onRetry={agendaQ.refetch} />
      ) : agendaQ.loading && !agendaQ.data ? (
        <LoadingState label="Chargement de la cédule…" />
      ) : view === 'month' ? (
        <MonthView
          cursor={cursor}
          byDay={byDay}
          colorOf={colorOf}
          onPick={setCursor}
          onOpen={open}
          multi={multi}
          refreshing={agendaQ.refreshing}
        />
      ) : view === 'week' ? (
        <WeekView cursor={cursor} byDay={byDay} colorOf={colorOf} onPick={setCursor} onOpen={open} multi={multi} />
      ) : (
        <DayView date={selected} entries={byDay.get(selected) ?? []} colorOf={colorOf} onOpen={open} multi={multi} />
      )}
    </View>
  );
}

function weekTitle(ws: Date): string {
  const we = addDays(ws, 6);
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('fr-CA', withMonth ? { day: 'numeric', month: 'short' } : { day: 'numeric' });
  return ws.getMonth() === we.getMonth()
    ? `${fmt(ws, false)} – ${fmt(we, true)}`
    : `${fmt(ws, true)} – ${fmt(we, true)}`;
}

/* --------------------------------- Mois ---------------------------------- */

function MonthView({
  cursor,
  byDay,
  colorOf,
  onPick,
  onOpen,
  multi,
}: {
  cursor: Date;
  byDay: Map<string, AgendaEntry[]>;
  colorOf: (e: AgendaEntry) => string;
  onPick: (d: Date) => void;
  onOpen: (e: AgendaEntry) => void;
  multi: boolean;
  refreshing: boolean;
}) {
  const grid = monthGrid(cursor.getFullYear(), cursor.getMonth());
  const today = ymd(new Date());
  const selected = ymd(cursor);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.monthCard}>
        <View style={styles.weekLetters}>
          {DAY_LETTERS.map((l, i) => (
            <Text key={i} style={styles.weekLetter}>
              {l}
            </Text>
          ))}
        </View>
        <View style={styles.grid}>
          {grid.map(d => {
            const key = ymd(d);
            const inMonth = d.getMonth() === cursor.getMonth();
            const isSel = key === selected;
            const isToday = key === today;
            const dots = (byDay.get(key) ?? []).slice(0, 3);
            return (
              <Pressable
                key={key}
                onPress={() => onPick(d)}
                style={styles.cell}
                accessibilityRole="button"
                accessibilityLabel={`${longDay(d)}, ${byDay.get(key)?.length ?? 0} rendez-vous`}
              >
                <View style={[styles.dayNum, isSel && styles.dayNumSel, !isSel && isToday && styles.dayNumToday]}>
                  <Text
                    style={[
                      styles.dayNumText,
                      !inMonth && styles.dayNumOut,
                      isToday && !isSel && styles.dayNumTodayText,
                      isSel && styles.dayNumSelText,
                    ]}
                  >
                    {d.getDate()}
                  </Text>
                </View>
                <View style={styles.dots}>
                  {dots.map(e => (
                    <View key={e.key} style={[styles.dot, { backgroundColor: colorOf(e) }]} />
                  ))}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <DayList date={selected} entries={byDay.get(selected) ?? []} colorOf={colorOf} onOpen={onOpen} multi={multi} />
    </ScrollView>
  );
}

/* ------------------------------- Semaine --------------------------------- */

function WeekView({
  cursor,
  byDay,
  colorOf,
  onPick,
  onOpen,
  multi,
}: {
  cursor: Date;
  byDay: Map<string, AgendaEntry[]>;
  colorOf: (e: AgendaEntry) => string;
  onPick: (d: Date) => void;
  onOpen: (e: AgendaEntry) => void;
  multi: boolean;
}) {
  const ws = weekStart(cursor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = ymd(new Date());
  const selected = ymd(cursor);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.strip}>
        {days.map((d, i) => {
          const key = ymd(d);
          const isSel = key === selected;
          return (
            <Pressable key={key} onPress={() => onPick(d)} style={styles.stripDay} accessibilityLabel={longDay(d)}>
              <Text style={styles.weekLetter}>{DAY_LETTERS[i]}</Text>
              <View style={[styles.dayNum, isSel && styles.dayNumSel, !isSel && key === today && styles.dayNumToday]}>
                <Text style={[styles.dayNumText, isSel && styles.dayNumSelText, !isSel && key === today && styles.dayNumTodayText]}>
                  {d.getDate()}
                </Text>
              </View>
              <Text style={styles.stripCount}>{byDay.get(key)?.length ? byDay.get(key)!.length : ' '}</Text>
            </Pressable>
          );
        })}
      </View>
      {days.map(d => (
        <DayList key={ymd(d)} date={ymd(d)} entries={byDay.get(ymd(d)) ?? []} colorOf={colorOf} onOpen={onOpen} multi={multi} compactEmpty />
      ))}
    </ScrollView>
  );
}

/* ---------------------------------- Jour --------------------------------- */

function DayView({
  date,
  entries,
  colorOf,
  onOpen,
  multi,
}: {
  date: string;
  entries: AgendaEntry[];
  colorOf: (e: AgendaEntry) => string;
  onOpen: (e: AgendaEntry) => void;
  multi: boolean;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const allDay = entries.filter(e => e.allDay);
  const timed = layoutColumns(entries.filter(e => !e.allDay));
  const isToday = date === ymd(new Date());
  const now = new Date();
  const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;

  return (
    <View style={styles.flex}>
      {allDay.length > 0 ? (
        <View style={styles.allDayRow}>
          <Text style={styles.allDayLabel}>Journée</Text>
          <View style={styles.flex}>
            {allDay.map(e => (
              <Pressable key={e.key} onPress={() => onOpen(e)} style={[styles.allDayPill, { backgroundColor: colorOf(e) }]}>
                <Text style={styles.allDayText} numberOfLines={1}>
                  {e.title}
                  {multi && e.userName ? ` · ${e.userName}` : ''}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
      <ScrollView
        ref={scrollRef}
        onLayout={() => scrollRef.current?.scrollTo({ y: 7 * HOUR_HEIGHT, animated: false })}
        contentContainerStyle={{ height: 24 * HOUR_HEIGHT + spacing.lg }}
      >
        {Array.from({ length: 24 }, (_, h) => (
          <View key={h} style={[styles.hourRow, { top: h * HOUR_HEIGHT }]}>
            <Text style={styles.hourLabel}>{h === 0 ? '' : `${h} h`}</Text>
            <View style={styles.hourLine} />
          </View>
        ))}
        <View style={styles.timedArea}>
          {timed.map(({ entry: e, col, cols }) => {
            const top = (minutesOf(e.start) / 60) * HOUR_HEIGHT;
            const height = Math.max(22, ((minutesOf(e.end) - minutesOf(e.start)) / 60) * HOUR_HEIGHT - 2);
            const c = colorOf(e);
            return (
              <Pressable
                key={e.key}
                onPress={() => onOpen(e)}
                style={[
                  styles.block,
                  {
                    top,
                    height,
                    left: `${(col / cols) * 100}%`,
                    width: `${100 / cols}%`,
                    borderLeftColor: c,
                    backgroundColor: tint(c),
                  },
                ]}
                accessibilityLabel={`${e.title}, ${frTime(e.start)}`}
              >
                <Text style={styles.blockTitle} numberOfLines={height > 40 ? 2 : 1}>
                  {e.title}
                </Text>
                {height > 40 ? (
                  <Text style={styles.blockMeta} numberOfLines={1}>
                    {frTime(e.start)}
                    {e.location ? ` · ${e.location}` : ''}
                    {multi && e.userName ? ` · ${e.userName}` : ''}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        {isToday ? (
          <View style={[styles.nowLine, { top: nowTop }]} pointerEvents="none">
            <View style={styles.nowDot} />
            <View style={styles.nowBar} />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

/** Rendez-vous qui se chevauchent : côte à côte, en colonnes égales. */
function layoutColumns(entries: AgendaEntry[]): { entry: AgendaEntry; col: number; cols: number }[] {
  const sorted = [...entries].sort((a, b) => a.start.localeCompare(b.start));
  const out: { entry: AgendaEntry; col: number; cols: number }[] = [];
  let group: { entry: AgendaEntry; col: number; cols: number }[] = [];
  let groupEnd = -1;
  const colEnds: number[] = [];
  const flush = () => {
    const cols = Math.max(1, ...group.map(g => g.col + 1));
    group.forEach(g => out.push({ ...g, cols }));
    group = [];
    colEnds.length = 0;
  };
  for (const e of sorted) {
    const s = minutesOf(e.start);
    const end = Math.max(s + 20, minutesOf(e.end));
    if (s >= groupEnd && group.length) flush();
    let col = colEnds.findIndex(c => c <= s);
    if (col === -1) col = colEnds.length;
    colEnds[col] = end;
    group.push({ entry: e, col, cols: 1 });
    groupEnd = Math.max(groupEnd, end);
  }
  if (group.length) flush();
  return out;
}

/** Fond pâle d'une couleur #RRGGBB (16 % d'opacité). */
function tint(hex: string): string {
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}29` : colors.surfaceAlt;
}

/* ------------------------------ Liste du jour ---------------------------- */

function DayList({
  date,
  entries,
  colorOf,
  onOpen,
  multi,
  compactEmpty = false,
}: {
  date: string;
  entries: AgendaEntry[];
  colorOf: (e: AgendaEntry) => string;
  onOpen: (e: AgendaEntry) => void;
  multi: boolean;
  compactEmpty?: boolean;
}) {
  const isToday = date === ymd(new Date());
  return (
    <View style={styles.dayList}>
      <Text style={[styles.dayListTitle, isToday && styles.dayListToday]}>
        {longDay(parseYmd(date)).toUpperCase()}
      </Text>
      {entries.length === 0 ? (
        <Text style={styles.empty}>{compactEmpty ? 'Rien de prévu' : 'Aucun rendez-vous. Touchez + pour en ajouter un.'}</Text>
      ) : (
        entries.map(e => (
          <Pressable key={e.key} onPress={() => onOpen(e)} style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <View style={[styles.itemBar, { backgroundColor: colorOf(e) }]} />
            <View style={styles.flex}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {e.title}
              </Text>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {e.allDay ? 'Toute la journée' : `${frTime(e.start)} – ${frTime(e.end)}`}
                {e.location ? ` · ${e.location}` : ''}
              </Text>
              {multi && e.userName ? <Text style={styles.itemMeta}>{e.userName}</Text> : null}
            </View>
            {e.kind === 'work_order' ? (
              <Ionicons name="construct-outline" size={16} color={colors.textMuted} />
            ) : e.reminderMinutes != null ? (
              <Ionicons name="notifications-outline" size={16} color={colors.textMuted} />
            ) : null}
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  toolbar: { backgroundColor: colors.navy, paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  segment: { flexDirection: 'row', backgroundColor: colors.navyLight, borderRadius: radius.md, padding: 3 },
  segItem: { flex: 1, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  segItemOn: { backgroundColor: colors.gold },
  segText: { color: colors.border, fontSize: typography.small, fontWeight: typography.weightSemibold },
  segTextOn: { color: colors.navy, fontWeight: typography.weightBold },
  navRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  navTitle: { flex: 1, textAlign: 'center', color: colors.textOnNavy, fontSize: typography.body, fontWeight: typography.weightBold },
  todayBtn: { paddingHorizontal: spacing.sm, height: 36, justifyContent: 'center' },
  todayText: { color: colors.gold, fontWeight: typography.weightBold, fontSize: typography.small },
  chips: { gap: spacing.xs, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.textMuted,
    borderRadius: 14,
    paddingHorizontal: 10,
    height: 28,
  },
  chipOn: { backgroundColor: colors.surface, borderColor: colors.surface },
  chipDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  chipText: { color: colors.textOnNavy, fontSize: typography.tiny, fontWeight: typography.weightSemibold },
  chipTextOn: { color: colors.navy },
  scroll: { paddingBottom: spacing.xl },
  monthCard: { backgroundColor: colors.surface, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  weekLetters: { flexDirection: 'row', paddingVertical: spacing.xs },
  weekLetter: { flex: 1, textAlign: 'center', fontSize: typography.tiny, color: colors.textMuted, fontWeight: typography.weightSemibold },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, height: 50, alignItems: 'center', gap: 3 },
  dayNum: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dayNumSel: { backgroundColor: colors.navy },
  dayNumToday: { borderWidth: 1.5, borderColor: colors.gold },
  dayNumText: { fontSize: typography.body, color: colors.text },
  dayNumOut: { color: colors.disabled },
  dayNumTodayText: { color: colors.navy, fontWeight: typography.weightBold },
  dayNumSelText: { color: colors.textOnNavy, fontWeight: typography.weightBold },
  dots: { flexDirection: 'row', gap: 2, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  strip: { flexDirection: 'row', backgroundColor: colors.surface, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  stripDay: { flex: 1, alignItems: 'center', gap: 2 },
  stripCount: { fontSize: typography.tiny, color: colors.textMuted },
  dayList: { paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  dayListTitle: { fontSize: typography.tiny, fontWeight: typography.weightBold, color: colors.textMuted },
  dayListToday: { color: colors.navy },
  empty: { fontSize: typography.small, color: colors.textMuted },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.7 },
  itemBar: { width: 4, alignSelf: 'stretch', borderRadius: 2 },
  itemTitle: { fontSize: typography.body, fontWeight: typography.weightSemibold, color: colors.text },
  itemMeta: { fontSize: typography.small, color: colors.textMuted },
  allDayRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.border },
  allDayLabel: { width: 52, fontSize: typography.tiny, color: colors.textMuted, paddingTop: 4 },
  allDayPill: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4, marginBottom: 4 },
  allDayText: { color: colors.textOnNavy, fontSize: typography.small, fontWeight: typography.weightSemibold },
  hourRow: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start' },
  hourLabel: { width: 48, textAlign: 'right', paddingRight: 6, fontSize: typography.tiny, color: colors.textMuted, marginTop: -7 },
  hourLine: { flex: 1, height: 1, backgroundColor: colors.border },
  timedArea: { position: 'absolute', top: 0, bottom: 0, left: 52, right: spacing.sm },
  block: {
    position: 'absolute',
    borderLeftWidth: 4,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  blockTitle: { fontSize: typography.small, fontWeight: typography.weightBold, color: colors.text },
  blockMeta: { fontSize: typography.tiny, color: colors.textMuted },
  nowLine: { position: 'absolute', left: 44, right: 0, flexDirection: 'row', alignItems: 'center' },
  nowDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  nowBar: { flex: 1, height: 2, backgroundColor: colors.danger },
});
