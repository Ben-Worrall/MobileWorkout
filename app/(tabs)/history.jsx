import { useState, useCallback } from 'react';
import { View, Text, SectionList, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import { getSessionSummaries } from '../../utils/database';
import { useUnit } from '../../context/UnitContext';

function formatDuration(ms) {
  if (!ms || ms < 60000) return ms ? '<1m' : '';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function dayLabel(ts) {
  return new Date(ts).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
}

function timeLabel(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function monthKey(ts) {
  return new Date(ts).toLocaleDateString([], { month: 'long', year: 'numeric' });
}

export default function HistoryScreen() {
  const [sessions, setSessions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState(50);
  const { fmtVol } = useUnit();

  useFocusEffect(
    useCallback(() => {
      getSessionSummaries(limit).then(rows => {
        setSessions(rows);
        setLoaded(true);
      });
    }, [limit])
  );

  const sections = [];
  for (const sess of sessions) {
    const key = monthKey(sess.started_at);
    const last = sections[sections.length - 1];
    if (last && last.title === key) last.data.push(sess);
    else sections.push({ title: key, data: [sess] });
  }

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>History</Text>
        <Text style={s.count}>
          {sessions.length} workout{sessions.length === 1 ? '' : 's'}
        </Text>
      </View>

      {loaded && sessions.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="time-outline" size={48} color={colors.textMuted} />
          <Text style={s.emptyTitle}>No workouts yet</Text>
          <Text style={s.emptySub}>Finished workouts will show up here.</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          contentContainerStyle={s.list}
          stickySectionHeadersEnabled={false}
          ListFooterComponent={sessions.length >= limit ? (
            <TouchableOpacity style={s.more} onPress={() => setLimit(l => l + 50)}>
              <Text style={s.moreText}>Load more</Text>
            </TouchableOpacity>
          ) : null}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>{section.title}</Text>
              <Text style={s.sectionCount}>
                {section.data.length} workout{section.data.length === 1 ? '' : 's'}
              </Text>
            </View>
          )}
          renderItem={({ item }) => {
            const muscles = item.muscles ? item.muscles.split(',') : [];
            const duration = formatDuration(item.finished_at - item.started_at);
            const vol = item.volume ? fmtVol(item.volume) : '';
            return (
              <TouchableOpacity
                style={s.card}
                onPress={() => router.push({ pathname: '/edit-session', params: { sessionId: item.id } })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.name} numberOfLines={1}>{item.name}</Text>
                  <Text style={s.when}>{dayLabel(item.started_at)} · {timeLabel(item.started_at)}</Text>
                  <View style={s.statsRow}>
                    {duration ? <Text style={s.stat}>{duration}</Text> : null}
                    <Text style={s.stat}>{item.exercises} exercise{item.exercises === 1 ? '' : 's'}</Text>
                    <Text style={s.stat}>{item.total_sets} set{item.total_sets === 1 ? '' : 's'}</Text>
                    {vol ? <Text style={s.stat}>{vol}</Text> : null}
                  </View>
                  {muscles.length > 0 && (
                    <View style={s.muscles}>
                      {muscles.map(m => (
                        <View key={m} style={[s.muscleTag, { backgroundColor: muscleColor(m) + '22' }]}>
                          <Text style={[s.muscleTagText, { color: muscleColor(m) }]}>{m}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  count: { fontSize: font.sm, color: colors.textMuted },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.md, paddingBottom: spacing.sm },
  sectionTitle: { fontSize: font.sm, fontWeight: '700', color: colors.textDim, letterSpacing: 0.8, textTransform: 'uppercase' },
  sectionCount: { fontSize: font.xs, color: colors.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.sm },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  when: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  stat: { fontSize: font.sm, color: colors.textMuted, fontWeight: '600' },
  muscles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  muscleTag: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 2 },
  muscleTagText: { fontSize: 10, fontWeight: '700' },
  more: { alignItems: 'center', paddingVertical: spacing.md },
  moreText: { color: colors.accent, fontWeight: '700', fontSize: font.base },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 80 },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted },
});
