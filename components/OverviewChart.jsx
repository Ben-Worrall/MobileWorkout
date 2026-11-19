import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Svg, { G, Line, Polyline, Circle, Text as SvgText } from 'react-native-svg';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';

const W = Dimensions.get('window').width - spacing.lg * 2 - spacing.md * 2 - 2;
const H = 200;
const PAD_L = 38;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 24;

const FIELD = { volume: 'volume', sets: 'sets', hard: 'hard_sets' };

function fmt(v, metric) {
  if (metric === 'sets' || metric === 'hard') return String(Math.round(v));
  if (v >= 1000) return `${Math.round(v / 100) / 10}k`;
  return String(Math.round(v));
}

export default function OverviewChart({ rows, metric }) {
  const [hidden, setHidden] = useState({});

  const { weeks, series, order } = useMemo(() => {
    const weekMap = new Map();
    const totals = {};
    for (const r of rows) {
      if (!weekMap.has(r.week)) weekMap.set(r.week, r.week_start);
      totals[r.muscle] = (totals[r.muscle] || 0) + (r[FIELD[metric]] || 0);
    }
    const weeks = [...weekMap.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1));
    const order = Object.keys(totals).filter(m => totals[m] > 0).sort((a, b) => totals[b] - totals[a]);
    const series = {};
    for (const m of order) {
      series[m] = weeks.map(([wk]) => {
        const hit = rows.find(r => r.muscle === m && r.week === wk);
        return hit ? hit[FIELD[metric]] || 0 : 0;
      });
    }
    return { weeks, series, order };
  }, [rows, metric]);

  if (order.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyText}>
          {metric === 'volume'
            ? 'No weighted sets in this period yet. Switch to Sets to include bodyweight work.'
            : metric === 'hard'
            ? 'No hard sets yet. Log reps in reserve (RIR 0-3) on your sets and they will show here.'
            : 'Log a workout to see your muscle groups here.'}
        </Text>
      </View>
    );
  }

  const visible = order.filter(m => !hidden[m]);
  const max = Math.max(1, ...visible.flatMap(m => series[m]));
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const x = i => (weeks.length === 1 ? PAD_L + innerW / 2 : PAD_L + (i * innerW) / (weeks.length - 1));
  const y = v => PAD_T + innerH - (v / max) * innerH;

  return (
    <View>
      <Svg width={W} height={H}>
        {[0, 0.5, 1].map(p => (
          <Line
            key={p}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={PAD_T + innerH - p * innerH}
            y2={PAD_T + innerH - p * innerH}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        ))}
        {[0, 0.5, 1].map(p => (
          <SvgText
            key={`l${p}`}
            x={PAD_L - 6}
            y={PAD_T + innerH - p * innerH + 4}
            fontSize={10}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {fmt(max * p, metric)}
          </SvgText>
        ))}
        {visible.map(m => {
          const c = muscleColor(m);
          const pts = series[m].map((v, i) => `${x(i)},${y(v)}`).join(' ');
          return (
            <G key={m}>
              {series[m].length > 1 && (
                <Polyline points={pts} fill="none" stroke={c} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              )}
              {series[m].map((v, i) => (
                <Circle key={i} cx={x(i)} cy={y(v)} r={3.5} fill={c} />
              ))}
            </G>
          );
        })}
        <SvgText x={PAD_L} y={H - 6} fontSize={10} fill={colors.textMuted} textAnchor="start">
          {(weeks[0][1] || '').slice(5)}
        </SvgText>
        {weeks.length > 1 && (
          <SvgText x={W - PAD_R} y={H - 6} fontSize={10} fill={colors.textMuted} textAnchor="end">
            {(weeks[weeks.length - 1][1] || '').slice(5)}
          </SvgText>
        )}
      </Svg>

      <View style={s.legend}>
        {order.map(m => {
          const off = hidden[m];
          const c = muscleColor(m);
          return (
            <TouchableOpacity
              key={m}
              style={[s.legendChip, { borderColor: off ? colors.border : c + '88', backgroundColor: off ? colors.bg2 : c + '1f' }]}
              onPress={() => setHidden(h => ({ ...h, [m]: !h[m] }))}
            >
              <View style={[s.dot, { backgroundColor: off ? colors.textMuted : c }]} />
              <Text style={[s.legendText, off && { color: colors.textMuted }]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  empty: { height: 120, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, backgroundColor: colors.bg3, borderRadius: radius.md },
  emptyText: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', lineHeight: 18 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  legendChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing.sm + 2, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: font.sm, fontWeight: '600', color: colors.text },
});
