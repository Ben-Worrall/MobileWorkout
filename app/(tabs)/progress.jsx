import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import {
  getVolumeByMuscle, getMuscleVolumeOverTime, getPersonalRecords, countSessionsSince, getWeeklyFrequency,
  getMuscleStatsByWeek, getMuscleTotalsBetween,
} from '../../utils/database';
import OverviewChart from '../../components/OverviewChart';
import { useUnit } from '../../context/UnitContext';


const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
];

// Simple line chart using Views
function LineChart({ data, color, height = 120 }) {
  if (!data || data.length < 1) {
    return (
      <View style={[{ height, backgroundColor: colors.bg3, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textMuted, fontSize: font.sm }}>Log a workout to see your chart</Text>
      </View>
    );
  }
  const max = Math.max(...data.map(d => d.value));

  return (
    <View style={{ height, position: 'relative' }}>
      {/* Grid lines */}
      {[0, 0.5, 1].map(pct => (
        <View key={pct} style={{ position: 'absolute', left: 0, right: 0, top: (1 - pct) * (height - 20), borderTopWidth: 1, borderTopColor: colors.border, borderStyle: 'dashed' }} />
      ))}
      {/* Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: height - 20, gap: 2, paddingHorizontal: 2 }}>
        {data.map((d, i) => {
          const h = Math.max(d.value > 0 ? 4 : 2, (d.value / (max || 1)) * (height - 28));
          return (
            <View
              key={i}
              style={{ flex: 1, maxWidth: 40, height: h, backgroundColor: color, borderRadius: 2, opacity: 0.85 }}
            />
          );
        })}
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{data[0]?.label}</Text>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{data[Math.floor(data.length / 2)]?.label}</Text>
        <Text style={{ fontSize: 9, color: colors.textMuted }}>{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  );
}

function MuscleVolumeBar({ muscle, volume, maxVolume }) {
  const { fmtVol } = useUnit();
  const pct = maxVolume > 0 ? (volume / maxVolume) : 0;
  const mc = muscleColor(muscle);
  return (
    <View style={{ marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontSize: font.sm, color: colors.text, fontWeight: '600' }}>{muscle}</Text>
        <Text style={{ fontSize: font.sm, color: colors.textDim }}>{fmtVol(volume)}</Text>
      </View>
      <View style={{ height: 6, backgroundColor: colors.bg3, borderRadius: radius.full }}>
        <View style={{ width: `${pct * 100}%`, height: 6, backgroundColor: mc, borderRadius: radius.full }} />
      </View>
    </View>
  );
}

export default function ProgressScreen() {
  const [period, setPeriod] = useState(PERIODS[1]);
  const [selectedMuscle, setSelectedMuscle] = useState(null);
  const [volumeByMuscle, setVolumeByMuscle] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [prs, setPrs] = useState([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [weeklyData, setWeeklyData] = useState([]);
  const [view, setView] = useState('overview');
  const [metric, setMetric] = useState('volume');
  const [weekStats, setWeekStats] = useState([]);
  const [prevTotals, setPrevTotals] = useState([]);
  const { unit, fmtW, fmtVol } = useUnit();

  useFocusEffect(
    useCallback(() => {
      load();
    }, [period, selectedMuscle])
  );

  async function load() {
    const [vol, records, sessionCount, weekly] = await Promise.all([
      getVolumeByMuscle(period.days),
      getPersonalRecords(),
      countSessionsSince(period.days),
      getWeeklyFrequency(12),
    ]);
    setVolumeByMuscle(vol);
    setPrs(records.slice(0, 20));
    setTotalSessions(sessionCount);
    setWeeklyData(weekly.map(w => ({ label: w.week?.slice(5) || '', value: w.workouts || 0 })));

    const now = Date.now();
    const span = period.days * 86400000;
    const [stats, prev] = await Promise.all([
      getMuscleStatsByWeek(period.days),
      getMuscleTotalsBetween(now - 2 * span, now - span),
    ]);
    setWeekStats(stats);
    setPrevTotals(prev);

    if (selectedMuscle) {
      const over = await getMuscleVolumeOverTime(selectedMuscle, period.days);
      setChartData(over.map(d => ({
        label: d.workout_date?.slice(5) || '',
        value: d.volume || 0,
      })));
    }
  }

  const maxVol = Math.max(...volumeByMuscle.map(v => v.total_volume || 0), 1);
  const totalVol = volumeByMuscle.reduce((a, b) => a + (b.total_volume || 0), 0);

  const advancement = volumeByMuscle
    .map(v => {
      const pick = (row, isPrev) => {
        if (!row) return 0;
        if (metric === 'sets') return (isPrev ? row.sets : row.total_sets) || 0;
        if (metric === 'hard') return row.hard_sets || 0;
        return (isPrev ? row.volume : row.total_volume) || 0;
      };
      const p = prevTotals.find(x => x.muscle === v.muscle);
      const cur = pick(v, false);
      const prev = pick(p, true);
      const pct = prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
      return { muscle: v.muscle, cur, prev, pct, rir: v.avg_rir, prevRir: p ? p.avg_rir : null };
    })
    .filter(a => a.cur > 0 || a.prev > 0)
    .sort((a, b) => b.cur - a.cur);

  function fmtMetric(v) {
    if (metric === 'sets') return `${Math.round(v)} sets`;
    if (metric === 'hard') return `${Math.round(v)} hard`;
    return fmtVol(v);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>Progress</Text>

        {/* View switch */}
        <View style={s.periodRow}>
          {[['overview', 'Overview'], ['muscles', 'By Muscle']].map(([key, label]) => (
            <TouchableOpacity
              key={key}
              style={[s.periodBtn, view === key && s.periodBtnActive]}
              onPress={() => setView(key)}
            >
              <Text style={[s.periodText, view === key && s.periodTextActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

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

        {/* Summary cards */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statNum}>{totalSessions}</Text>
            <Text style={s.statLabel}>Workouts</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{fmtVol(totalVol, true)}</Text>
            <Text style={s.statLabel}>Total {unit}</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statNum}>{volumeByMuscle.length}</Text>
            <Text style={s.statLabel}>Muscle groups</Text>
          </View>
        </View>

        {view === 'overview' ? (
          <>
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Text style={s.cardTitle}>All Muscle Groups</Text>
                <View style={s.metricRow}>
                  {[['volume', 'Volume'], ['sets', 'Sets'], ['hard', 'Hard']].map(([key, label]) => (
                    <TouchableOpacity
                      key={key}
                      style={[s.metricBtn, metric === key && s.metricBtnActive]}
                      onPress={() => setMetric(key)}
                    >
                      <Text style={[s.metricText, metric === key && { color: colors.white }]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <Text style={s.cardSubtitle}>
                Weekly {metric === 'sets' ? 'sets' : metric === 'hard' ? 'hard sets (within 3 reps of failure)' : `volume (${unit})`} per muscle. Tap a name to hide it.
              </Text>
              <OverviewChart rows={weekStats} metric={metric} />
            </View>

            <View style={s.card}>
              <Text style={s.cardTitle}>Your Progress</Text>
              <Text style={s.cardSubtitle}>Compared with the previous {period.label}</Text>
              {advancement.length === 0 && (
                <Text style={{ color: colors.textMuted, fontSize: font.sm, textAlign: 'center', paddingVertical: spacing.md }}>
                  No workout data yet for this period
                </Text>
              )}
              {advancement.map(a => (
                <View key={a.muscle} style={s.advRow}>
                  <View style={[s.advDot, { backgroundColor: muscleColor(a.muscle) }]} />
                  <Text style={s.advName}>{a.muscle}</Text>
                  <Text style={s.advValue}>{fmtMetric(a.cur)}</Text>
                  <Text style={s.advRir}>
                    {a.rir != null ? `RIR ${Math.round(a.rir * 10) / 10}` : ''}
                  </Text>
                  <Text
                    style={[
                      s.advPct,
                      { color: a.pct === null ? colors.textDim : a.pct >= 0 ? colors.success : colors.danger },
                    ]}
                  >
                    {a.pct === null ? 'New' : `${a.pct >= 0 ? '▲ +' : '▼ '}${a.pct}%`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <>
        {/* Volume chart */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>
              {selectedMuscle ? `${selectedMuscle} Volume` : 'Weekly Workouts'}
            </Text>
            {selectedMuscle && (
              <TouchableOpacity onPress={() => setSelectedMuscle(null)}>
                <Text style={{ color: colors.accent, fontSize: font.sm }}>Show all</Text>
              </TouchableOpacity>
            )}
          </View>
          <LineChart
            data={selectedMuscle ? chartData : weeklyData}
            color={selectedMuscle ? muscleColor(selectedMuscle) : colors.accent}
            height={130}
          />
        </View>

        {/* Volume by muscle */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Volume by Muscle</Text>
          <Text style={s.cardSubtitle}>Tap a muscle to see its chart</Text>
          <View style={{ marginTop: spacing.md }}>
            {volumeByMuscle.length === 0 && (
              <Text style={{ color: colors.textMuted, fontSize: font.sm, textAlign: 'center', paddingVertical: spacing.md }}>
                No workout data yet for this period
              </Text>
            )}
            {volumeByMuscle.map(v => (
              <TouchableOpacity key={v.muscle} onPress={() => setSelectedMuscle(v.muscle === selectedMuscle ? null : v.muscle)}>
                <MuscleVolumeBar muscle={v.muscle} volume={v.total_volume || 0} maxVolume={maxVol} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

          </>
        )}

        {/* Personal Records */}
        {prs.length > 0 && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Personal Records</Text>
            <Text style={s.cardSubtitle}>Best weight per exercise</Text>
            <View style={s.prGrid}>
              {prs.map(pr => (
                <View key={pr.exercise_id} style={[s.prCard, { borderTopColor: muscleColor(pr.muscle) }]}>
                  <Text style={s.prWeight}>{fmtW(pr.max_weight, true)}<Text style={s.prUnit}> {unit}</Text></Text>
                  <Text style={s.prName} numberOfLines={2}>{pr.exercise_name}</Text>
                  <View style={[s.prMuscleTag, { backgroundColor: muscleColor(pr.muscle) + '22' }]}>
                    <Text style={[s.prMuscleText, { color: muscleColor(pr.muscle) }]}>{pr.muscle}</Text>
                  </View>
                </View>
              ))}
            </View>
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
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  periodRow: { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.lg, padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border },
  periodBtn: { flex: 1, paddingVertical: spacing.sm - 2, borderRadius: radius.md, alignItems: 'center' },
  periodBtnActive: { backgroundColor: colors.accent },
  periodText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  periodTextActive: { color: colors.white },
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: { flex: 1, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, alignItems: 'center', gap: 2 },
  statNum: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  statLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '500' },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  cardSubtitle: { fontSize: font.sm, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  metricRow: { flexDirection: 'row', backgroundColor: colors.bg3, borderRadius: radius.md, padding: 2 },
  metricBtn: { paddingHorizontal: spacing.sm + 2, paddingVertical: 4, borderRadius: radius.sm },
  metricBtnActive: { backgroundColor: colors.accent },
  metricText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  advRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  advDot: { width: 10, height: 10, borderRadius: 5, marginRight: spacing.sm },
  advName: { flex: 1, fontSize: font.base, fontWeight: '600', color: colors.text },
  advValue: { fontSize: font.sm, color: colors.textDim, marginRight: spacing.sm },
  advRir: { width: 52, fontSize: font.xs, color: colors.accent, fontWeight: '600', textAlign: 'right', marginRight: spacing.sm },
  advPct: { minWidth: 64, textAlign: 'right', fontSize: font.sm, fontWeight: '700' },
  prGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  prCard: {
    width: '30%', backgroundColor: colors.bg2, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderTopWidth: 2,
    padding: spacing.sm, gap: 3,
  },
  prWeight: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  prUnit: { fontSize: font.sm, color: colors.textDim, fontWeight: '400' },
  prName: { fontSize: font.xs, color: colors.textDim },
  prMuscleTag: { borderRadius: radius.sm, paddingHorizontal: 4, paddingVertical: 2, alignSelf: 'flex-start' },
  prMuscleText: { fontSize: 9, fontWeight: '700' },
});
