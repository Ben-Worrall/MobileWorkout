import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../../constants/theme';
import { getHistory, getWorkouts } from '../../utils/storage';

export default function HomeScreen() {
  const [recentSessions, setRecentSessions] = useState([]);
  const [workouts, setWorkouts] = useState([]);
  const [streak, setStreak] = useState(0);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const [h, w] = await Promise.all([getHistory(), getWorkouts()]);
    setRecentSessions(h.slice(0, 3));
    setWorkouts(w);
    setStreak(calcStreak(h));
  }

  function calcStreak(history) {
    if (!history.length) return 0;
    let streak = 0;
    let today = new Date(); today.setHours(0, 0, 0, 0);
    const days = new Set(history.map(s => {
      const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0); return d.getTime();
    }));
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      if (days.has(d.getTime())) streak++;
      else if (i > 0) break;
    }
    return streak;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return 'Today';
    if (diff < 172800000) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function formatDuration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.greeting}>Good {greeting()}</Text>
          <Text style={styles.subtitle}>Ready to train?</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="flame" size={22} color={colors.warning} />
            <Text style={styles.statNum}>{streak}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calendar" size={22} color={colors.accent} />
            <Text style={styles.statNum}>{recentSessions.length > 0 ? recentSessions.length : '—'}</Text>
            <Text style={styles.statLabel}>This week</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="barbell" size={22} color={colors.success} />
            <Text style={styles.statNum}>{workouts.length}</Text>
            <Text style={styles.statLabel}>Routines</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.startBtn} onPress={() => router.push('/active-workout')}>
          <Ionicons name="play" size={20} color={colors.white} />
          <Text style={styles.startBtnText}>Start Empty Workout</Text>
        </TouchableOpacity>

        {workouts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Your Routines</Text>
            {workouts.map(w => (
              <TouchableOpacity
                key={w.id}
                style={styles.routineCard}
                onPress={() => router.push({ pathname: '/active-workout', params: { workoutId: w.id } })}
              >
                <View style={styles.routineInfo}>
                  <Text style={styles.routineName}>{w.name}</Text>
                  <Text style={styles.routineMeta}>{w.exercises?.length || 0} exercises</Text>
                </View>
                <Ionicons name="play-circle" size={28} color={colors.accent} />
              </TouchableOpacity>
            ))}
          </>
        )}

        {recentSessions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recent</Text>
            {recentSessions.map(s => (
              <View key={s.id} style={styles.historyCard}>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyName}>{s.name}</Text>
                  <Text style={styles.historyMeta}>
                    {formatDate(s.startedAt)} · {formatDuration(s.duration)} · {s.exercises?.length || 0} exercises
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}

        {workouts.length === 0 && recentSessions.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Create a routine or start an empty workout to begin</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { marginBottom: spacing.lg },
  greeting: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.base, color: colors.textDim, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  statCard: {
    flex: 1, backgroundColor: colors.bg2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center', gap: 4,
  },
  statNum: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.sm, color: colors.textMuted },
  startBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md + 2, marginBottom: spacing.lg,
  },
  startBtnText: { color: colors.white, fontSize: font.md, fontWeight: '600' },
  sectionTitle: { fontSize: font.base, fontWeight: '600', color: colors.textDim, marginBottom: spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  routineCard: {
    backgroundColor: colors.bg2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  routineInfo: { flex: 1 },
  routineName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  routineMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  historyCard: {
    backgroundColor: colors.bg2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  historyInfo: {},
  historyName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  historyMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  emptyState: { alignItems: 'center', paddingTop: spacing.xl * 2, gap: spacing.sm },
  emptyText: { fontSize: font.lg, fontWeight: '600', color: colors.textDim },
  emptySubtext: { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
});
