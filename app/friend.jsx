import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../constants/theme';
import { useUnit } from '../context/UnitContext';
import { getFriendOverview, getFriendMuscleWeeks } from '../utils/social';
import OverviewChart from '../components/OverviewChart';

const METRICS = [['volume', 'Volume'], ['sets', 'Sets'], ['hard', 'Hard']];

function daysAgo(ts) {
  const d = Math.floor((Date.now() - Number(ts)) / 86400000);
  return d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
}

export default function FriendScreen() {
  const { id, username } = useLocalSearchParams();
  const { fmtW, fmtVol } = useUnit();
  const [state, setState] = useState({ loading: true });
  const [metric, setMetric] = useState('volume');

  const load = useCallback(async () => {
    try {
      const [overview, weeks] = await Promise.all([getFriendOverview(id), getFriendMuscleWeeks(id, 90)]);
      setState({ loading: false, overview, weeks });
    } catch (e) {
      setState({ loading: false, failed: e.message || 'Could not load.' });
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const { loading, overview, weeks, failed } = state;
  const blocked = overview && overview.error;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.textDim} /></TouchableOpacity>
        <Text style={s.title}>@{username}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
      ) : failed ? (
        <View style={s.center}><Text style={s.dim}>{failed}</Text></View>
      ) : blocked ? (
        <View style={s.center}>
          <Ionicons name="lock-closed-outline" size={44} color={colors.textMuted} />
          <Text style={s.big}>{overview.error === 'not_shared' ? 'Progress is private' : 'Not available'}</Text>
          <Text style={s.dim}>
            {overview.error === 'not_shared' ? `@${username} has chosen not to share their progress.` : 'You can only see progress of accepted friends.'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.statsRow}>
            <View style={s.stat}><Text style={s.statNum}>{overview.workouts_30}</Text><Text style={s.statLbl}>Workouts (30d)</Text></View>
            <View style={s.stat}><Text style={s.statNum}>{overview.workouts_90}</Text><Text style={s.statLbl}>Workouts (90d)</Text></View>
            <View style={s.stat}><Text style={s.statNum} numberOfLines={1} adjustsFontSizeToFit>{overview.last_workout ? daysAgo(overview.last_workout) : '—'}</Text><Text style={s.statLbl}>Last workout</Text></View>
          </View>

          <View style={s.card}>
            <View style={s.cardHead}>
              <Text style={s.cardTitle}>Muscle groups</Text>
              <View style={s.seg}>
                {METRICS.map(([k, label]) => (
                  <TouchableOpacity key={k} style={[s.segBtn, metric === k && s.segBtnOn]} onPress={() => setMetric(k)}>
                    <Text style={[s.segText, metric === k && { color: colors.white }]}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <Text style={s.dim}>Last 90 days, per week. Tap a name to hide it.</Text>
            <View style={{ marginTop: spacing.sm }}><OverviewChart rows={weeks} metric={metric} /></View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Top lifts</Text>
            {(overview.top_lifts || []).length === 0 ? <Text style={s.dim}>No weighted lifts yet.</Text> : null}
            {(overview.top_lifts || []).map(l => (
              <View key={l.exercise_name} style={s.line}>
                <Text style={s.lineName} numberOfLines={1}>{l.exercise_name}</Text>
                <Text style={s.lineVal}>{fmtW(l.max_weight)}</Text>
              </View>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Recent workouts</Text>
            {(overview.recent_sessions || []).length === 0 ? <Text style={s.dim}>No workouts yet.</Text> : null}
            {(overview.recent_sessions || []).map((w, i) => (
              <View key={i} style={s.line}>
                <View style={{ flex: 1 }}>
                  <Text style={s.lineName} numberOfLines={1}>{w.name}</Text>
                  <Text style={s.dim}>{daysAgo(w.started_at)} · {w.sets} {Number(w.sets) === 1 ? 'set' : 'sets'}</Text>
                </View>
                <Text style={s.lineVal}>{Number(w.volume) > 0 ? fmtVol(w.volume) : ''}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, padding: 4 },
  title: { fontSize: font.md, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  big: { fontSize: font.xl, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  dim: { fontSize: font.sm, color: colors.textMuted, textAlign: 'left' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 80 },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  stat: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center', gap: 2 },
  statNum: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLbl: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  seg: { flexDirection: 'row', backgroundColor: colors.bg3, borderRadius: radius.md, padding: 2 },
  segBtn: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.sm },
  segBtnOn: { backgroundColor: colors.accent },
  segText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDim },
  lineName: { flex: 1, fontSize: font.base, fontWeight: '600', color: colors.text },
  lineVal: { fontSize: font.base, fontWeight: '700', color: colors.accent },
});
