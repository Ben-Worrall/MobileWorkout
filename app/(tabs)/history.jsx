import { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../../constants/theme';
import { getHistory } from '../../utils/storage';

export default function HistoryScreen() {
  const [sessions, setSessions] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getHistory().then(setSessions);
    }, [])
  );

  function formatDate(ts) {
    return new Date(ts).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function formatDuration(ms) {
    const m = Math.floor(ms / 60000);
    if (m < 60) return `${m} min`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  function totalVolume(session) {
    let vol = 0;
    session.exercises?.forEach(ex => {
      ex.sets?.forEach(s => { if (s.done) vol += (Number(s.weight) || 0) * (Number(s.reps) || 0); });
    });
    return vol;
  }

  function groupByDate(sessions) {
    const groups = {};
    sessions.forEach(s => {
      const key = new Date(s.startedAt).toDateString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    return Object.entries(groups);
  }

  const grouped = groupByDate(sessions);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
        <Text style={styles.subtitle}>{sessions.length} workouts logged</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sessions.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="time-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No workouts yet</Text>
            <Text style={styles.emptySubtext}>Complete a workout to see it here</Text>
          </View>
        ) : (
          grouped.map(([date, daySessions]) => (
            <View key={date}>
              <Text style={styles.dateHeader}>{formatDate(daySessions[0].startedAt)}</Text>
              {daySessions.map(s => {
                const vol = totalVolume(s);
                return (
                  <View key={s.id} style={styles.card}>
                    <View style={styles.cardTop}>
                      <Text style={styles.cardName}>{s.name}</Text>
                      <Text style={styles.cardTime}>{formatTime(s.startedAt)}</Text>
                    </View>
                    <View style={styles.cardStats}>
                      <View style={styles.stat}>
                        <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.statText}>{formatDuration(s.duration)}</Text>
                      </View>
                      <View style={styles.stat}>
                        <Ionicons name="barbell-outline" size={14} color={colors.textMuted} />
                        <Text style={styles.statText}>{s.exercises?.length || 0} exercises</Text>
                      </View>
                      {vol > 0 && (
                        <View style={styles.stat}>
                          <Ionicons name="trending-up-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.statText}>{vol.toLocaleString()} kg</Text>
                        </View>
                      )}
                    </View>
                    {s.exercises?.map(ex => (
                      <Text key={ex.id} style={styles.exerciseLine}>
                        {ex.sets?.filter(s => s.done).length || 0}×{ex.name}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: font.base, color: colors.textDim, marginTop: 2 },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, gap: spacing.sm },
  emptyText: { fontSize: font.lg, fontWeight: '600', color: colors.textDim },
  emptySubtext: { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
  dateHeader: { fontSize: font.sm, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, marginTop: spacing.md },
  card: {
    backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  cardName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  cardTime: { fontSize: font.sm, color: colors.textMuted },
  cardStats: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm, flexWrap: 'wrap' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: font.sm, color: colors.textMuted },
  exerciseLine: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
});
