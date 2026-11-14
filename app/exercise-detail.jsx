import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { getVolumeOverTime, getRecentSetsForExercise, getPersonalRecords } from '../utils/database';

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? value / max : 0;
  return (
    <View style={{ height: 4, flex: 1, backgroundColor: colors.bg3, borderRadius: radius.full }}>
      <View style={{ width: `${pct * 100}%`, height: 4, backgroundColor: color, borderRadius: radius.full }} />
    </View>
  );
}

function SimpleChart({ data, color, valueKey = 'volume', height = 110 }) {
  if (!data || data.length < 2) {
    return (
      <View style={{ height, backgroundColor: colors.bg3, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Log more sessions to see your chart</Text>
      </View>
    );
  }
  const values = data.map(d => d[valueKey] || 0);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <View style={{ height }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height - 20, gap: 2 }}>
        {data.map((d, i) => {
          const h = Math.max(2, ((values[i] - min) / range) * (height - 28));
          return <View key={i} style={{ flex: 1, height: h, backgroundColor: color, borderRadius: 2, opacity: 0.8 }} />;
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{data[0]?.workout_date?.slice(5)}</Text>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{data[data.length - 1]?.workout_date?.slice(5)}</Text>
      </View>
    </View>
  );
}

export default function ExerciseDetail() {
  const { exerciseId, name, muscle } = useLocalSearchParams();
  const [period, setPeriod] = useState(PERIODS[1]);
  const [volumeData, setVolumeData] = useState([]);
  const [recentSets, setRecentSets] = useState([]);
  const [pr, setPr] = useState(null);
  const [chartMode, setChartMode] = useState('volume'); // volume | weight

  const mc = muscleColor(muscle);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [exerciseId, period])
  );

  async function load() {
    const [vol, sets, records] = await Promise.all([
      getVolumeOverTime(exerciseId, period.days),
      getRecentSetsForExercise(exerciseId, 30),
      getPersonalRecords(),
    ]);
    setVolumeData(vol);
    setRecentSets(sets);
    const myPr = records.find(r => r.exercise_id === exerciseId);
    setPr(myPr || null);
  }

  // Group sets by session date
  const sessionGroups = recentSets.reduce((acc, set) => {
    const d = new Date(set.session_date).toLocaleDateString([], { month: 'short', day: 'numeric' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(set);
    return acc;
  }, {});

  const totalVol = volumeData.reduce((a, b) => a + (b.volume || 0), 0);
  const totalSets = volumeData.reduce((a, b) => a + (b.sets || 0), 0);
  const maxWeight = volumeData.reduce((a, b) => Math.max(a, b.max_weight || 0), 0);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{name}</Text>
          {muscle ? (
            <View style={[s.muscleBadge, { backgroundColor: mc + '22' }]}>
              <Text style={[s.muscleBadgeText, { color: mc }]}>{muscle}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Period selector */}
        <View style={s.periodRow}>
          {PERIODS.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[s.periodBtn, period.label === p.label && s.periodBtnActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[s.periodText, period.label === p.label && s.periodTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Summary stats */}
        <View style={s.statsRow}>
          <View style={[s.statCard, pr && { borderTopColor: mc, borderTopWidth: 2 }]}>
            <Text style={[s.statNum, { color: mc }]}>{pr ? `${pr.max_weight} kg` : '—'}</Text>
            <Text style={s.statLabel}>Personal Record</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{maxWeight > 0 ? `${maxWeight} kg` : '—'}</Text>
            <Text style={s.statLabel}>Max ({period.label})</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{totalSets}</Text>
            <Text style={s.statLabel}>Sets</Text>
          </View>
        </View>

        {/* Chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>Progress</Text>
            <View style={s.chartModeRow}>
              <TouchableOpacity
                style={[s.modeBtn, chartMode === 'volume' && { backgroundColor: mc }]}
                onPress={() => setChartMode('volume')}
              >
                <Text style={[s.modeBtnText, chartMode === 'volume' && { color: colors.white }]}>Volume</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modeBtn, chartMode === 'weight' && { backgroundColor: mc }]}
                onPress={() => setChartMode('weight')}
              >
                <Text style={[s.modeBtnText, chartMode === 'weight' && { color: colors.white }]}>Weight</Text>
              </TouchableOpacity>
            </View>
          </View>
          <SimpleChart data={volumeData} color={mc} valueKey={chartMode === 'volume' ? 'volume' : 'max_weight'} />
        </View>

        {/* Recent sessions */}
        {Object.keys(sessionGroups).length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>History</Text>
            {Object.entries(sessionGroups).slice(0, 8).map(([date, sets]) => {
              const maxW = Math.max(...sets.map(s => s.weight || 0));
              const totalReps = sets.reduce((a, b) => a + (b.reps || 0), 0);
              return (
                <View key={date} style={s.historyRow}>
                  <Text style={s.historyDate}>{date}</Text>
                  <View style={s.historyStats}>
                    <Text style={s.historyStat}>{sets.length} sets</Text>
                    <Text style={s.historyStat}>{totalReps} reps</Text>
                    {maxW > 0 && <Text style={[s.historyStat, { color: mc, fontWeight: '700' }]}>{maxW} kg max</Text>}
                  </View>
                  <MiniBar
                    value={maxW}
                    max={pr?.max_weight || maxW}
                    color={mc}
                  />
                </View>
              );
            })}
          </View>
        )}

        {recentSets.length === 0 && (
          <View style={s.emptyState}>
            <Ionicons name="fitness-outline" size={48} color={colors.textMuted} />
            <Text style={s.emptyTitle}>No history yet</Text>
            <Text style={s.emptySub}>Start a workout with this exercise to track your progress</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { padding: spacing.xs },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  headerName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  muscleBadge: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  muscleBadgeText: { fontSize: font.sm, fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  periodRow: { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.lg, padding: 4, borderWidth: 1, borderColor: colors.border },
  periodBtn: { flex: 1, paddingVertical: spacing.sm - 2, borderRadius: radius.md, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.accent },
  periodText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  periodTextActive: { color: colors.white },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center', gap: 2 },
  statNum: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  chartModeRow: { flexDirection: 'row', backgroundColor: colors.bg3, borderRadius: radius.md, padding: 2 },
  modeBtn: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm },
  modeBtnText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  historyRow: { paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDim, gap: 4 },
  historyDate: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  historyStats: { flexDirection: 'row', gap: spacing.md },
  historyStat: { fontSize: font.sm, color: colors.textDim },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', lineHeight: 22 },
});
