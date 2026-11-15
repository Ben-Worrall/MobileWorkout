import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import { getSessions, getVolumeByMuscle, getScheduledWorkouts } from '../../utils/database';
import { getSuggestions } from '../../utils/suggestions';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function calcStreak(sessions) {
  if (!sessions.length) return 0;
  let streak = 0;
  const days = new Set(sessions.map(s => new Date(s.started_at).toDateString()));
  const now = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(now); d.setDate(now.getDate() - i);
    if (days.has(d.toDateString())) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function daysAgoLabel(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  return `${d}d ago`;
}

function formatDuration(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function HomeScreen() {
  const [sessions, setSessions] = useState([]);
  const [topMuscles, setTopMuscles] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [todayScheduled, setTodayScheduled] = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const [s, v, sugg, sched] = await Promise.all([
      getSessions(20),
      getVolumeByMuscle(30),
      getSuggestions(),
      getScheduledWorkouts(today, today),
    ]);
    setSessions(s);
    setTopMuscles(v.slice(0, 4));
    setSuggestions(sugg.slice(0, 2));
    setTodayScheduled(sched[0] || null);
  }

  const streak = calcStreak(sessions);
  const thisWeek = sessions.filter(s => Date.now() - s.started_at < 7 * 86400000).length;
  const lastSession = sessions[0];

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.date}>{new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
          </View>
          <TouchableOpacity style={s.settingsBtn} onPress={() => router.push('/settings')}>
            <Ionicons name="settings-outline" size={22} color={colors.textDim} />
          </TouchableOpacity>
        </View>

        {/* Stats row */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text style={s.statNum}>{streak}</Text>
            <Text style={s.statLabel}>Streak</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="calendar" size={18} color={colors.accent} />
            <Text style={s.statNum}>{thisWeek}</Text>
            <Text style={s.statLabel}>This week</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="time-outline" size={18} color={colors.purple} />
            <Text style={s.statNum}>{lastSession ? daysAgoLabel(lastSession.started_at) : '—'}</Text>
            <Text style={s.statLabel}>Last workout</Text>
          </View>
        </View>

        {/* Today's scheduled workout */}
        {todayScheduled ? (
          <View style={s.section}>
            <Text style={s.sectionLabel}>TODAY'S PLAN</Text>
            <TouchableOpacity
              style={[s.todayCard, { borderLeftColor: todayScheduled.color || colors.accent }]}
              onPress={() => router.push({ pathname: '/active-workout', params: { templateId: todayScheduled.template_id, scheduledId: todayScheduled.id } })}
            >
              <View style={s.todayInfo}>
                <Text style={s.todayName}>{todayScheduled.template_name || 'Workout'}</Text>
                <Text style={s.todayMeta}>{todayScheduled.completed ? 'Completed ✓' : 'Scheduled for today'}</Text>
              </View>
              {!todayScheduled.completed && (
                <TouchableOpacity style={s.startChip} onPress={() => router.push({ pathname: '/active-workout', params: { templateId: todayScheduled.template_id, scheduledId: todayScheduled.id } })}>
                  <Ionicons name="play" size={14} color={colors.white} />
                  <Text style={s.startChipText}>Start</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.quickStart} onPress={() => router.push('/active-workout')}>
            <View style={s.quickStartLeft}>
              <View style={s.quickStartIcon}><Ionicons name="add" size={22} color={colors.white} /></View>
              <View>
                <Text style={s.quickStartTitle}>Start a workout</Text>
                <Text style={s.quickStartSub}>Empty session or choose a routine</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>SUGGESTIONS</Text>
            {suggestions.map((sg, i) => (
              <View key={i} style={[s.suggCard, sg.priority === 'high' && s.suggHigh]}>
                <View style={[s.suggIcon, { backgroundColor: sg.priority === 'high' ? colors.accent + '22' : colors.bg3 }]}>
                  <Ionicons name={sg.icon} size={18} color={sg.priority === 'high' ? colors.accent : colors.textDim} />
                </View>
                <View style={s.suggText}>
                  <Text style={s.suggTitle}>{sg.title}</Text>
                  <Text style={s.suggBody}>{sg.body}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Volume this month */}
        {topMuscles.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>VOLUME THIS MONTH</Text>
            <View style={s.volumeGrid}>
              {topMuscles.map(m => (
                <View key={m.muscle} style={s.volumeCard}>
                  <View style={[s.muscleDot, { backgroundColor: muscleColor(m.muscle) }]} />
                  <Text style={s.muscleName}>{m.muscle}</Text>
                  <Text style={s.muscleVol}>{Math.round((m.total_volume || 0) / 1000)}k kg</Text>
                  <Text style={s.muscleSets}>{m.total_sets} sets</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Recent sessions */}
        {sessions.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionLabel}>RECENT</Text>
            {sessions.slice(0, 4).map(sess => (
              <TouchableOpacity
                key={sess.id}
                style={s.recentCard}
                onPress={() => router.push({ pathname: '/edit-session', params: { sessionId: sess.id } })}
              >
                <View style={s.recentLeft}>
                  <Text style={s.recentName}>{sess.name}</Text>
                  <Text style={s.recentMeta}>
                    {daysAgoLabel(sess.started_at)}
                    {sess.finished_at ? ` · ${formatDuration(sess.finished_at - sess.started_at)}` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {sessions.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="barbell-outline" size={56} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No workouts yet</Text>
            <Text style={s.emptySub}>Start your first session to begin tracking your progress</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={() => router.push('/active-workout')}>
              <Text style={s.emptyBtnText}>Start First Workout</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greeting: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  date: { fontSize: font.base, color: colors.textDim, marginTop: 2 },
  settingsBtn: { padding: spacing.sm },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '500' },
  section: { marginBottom: spacing.lg },
  sectionLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: spacing.sm },
  todayCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md,
  },
  todayInfo: { flex: 1 },
  todayName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  todayMeta: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  startChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent, paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2, borderRadius: radius.full,
  },
  startChipText: { color: colors.white, fontSize: font.sm, fontWeight: '700' },
  quickStart: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, marginBottom: spacing.lg,
  },
  quickStartLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  quickStartIcon: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  quickStartTitle: { fontSize: font.md, fontWeight: '600', color: colors.text },
  quickStartSub: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  suggCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  suggHigh: { borderColor: colors.accentGlow },
  suggIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  suggText: { flex: 1 },
  suggTitle: { fontSize: font.base, fontWeight: '600', color: colors.text },
  suggBody: { fontSize: font.sm, color: colors.textDim, marginTop: 3, lineHeight: 18 },
  volumeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  volumeCard: {
    flex: 1, minWidth: '45%', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 2,
  },
  muscleDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 4 },
  muscleName: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  muscleVol: { fontSize: font.md, fontWeight: '700', color: colors.text },
  muscleSets: { fontSize: font.xs, color: colors.textDim },
  recentCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  recentLeft: { flex: 1 },
  recentName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  recentMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: spacing.sm, backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  emptyBtnText: { color: colors.white, fontWeight: '700', fontSize: font.md },
});
