import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import SetRow from './SetRow';
import { useUnit } from '../../context/UnitContext';

const SIDES = ['L', 'R'];

export function isSetComplete(sets, n, unilateral) {
  if (unilateral) return SIDES.every(sd => sets.some(x => x.set_number === n && x.side === sd));
  return sets.some(x => x.set_number === n);
}

export function completedSetCount(sets, target, unilateral) {
  let c = 0;
  for (let n = 1; n <= target; n++) if (isSetComplete(sets, n, unilateral)) c++;
  return c;
}

export default function ExerciseBlock({
  exercise, sets, onTick, onUntick, onChangeTarget, onRemove, onToggleUnilateral, onOpenRir,
}) {
  const [drafts, setDrafts] = useState({});
  const { inputStr, parseKg } = useUnit();
  const mc = muscleColor(exercise.muscle);
  const target = exercise.target_sets || 3;
  const unilateral = !!exercise.unilateral;
  const defaultReps = String(exercise.default_reps || 10);
  const doneCount = completedSetCount(sets, target, unilateral);
  const allDone = target > 0 && doneCount >= target;

  const key = (n, side) => `${n}:${side || 'B'}`;

  // Most recent logged set for this side (and before this set number when possible) seeds the defaults.
  function previous(n, side) {
    const same = sets.filter(x => (x.side || null) === (side || null));
    const before = same.filter(x => x.set_number < n);
    const pool = before.length ? before : same;
    return pool.length ? pool[pool.length - 1] : null;
  }

  function value(n, side, field) {
    const d = drafts[key(n, side)];
    if (d && d[field] !== undefined) return d[field];
    const p = previous(n, side);
    if (field === 'weight') return p && p.weight ? inputStr(p.weight) : '';
    if (field === 'reps') return p && p.reps ? String(p.reps) : defaultReps;
    return p && p.rir != null ? p.rir : null;
  }

  function setDraft(n, side, field, v) {
    setDrafts(prev => ({ ...prev, [key(n, side)]: { ...prev[key(n, side)], [field]: v } }));
  }

  function tick(n, side) {
    const weight = parseKg(value(n, side, 'weight'));
    const reps = parseInt(value(n, side, 'reps'), 10) || 0;
    if (!reps) { Alert.alert('Enter reps'); return; }
    onTick(exercise, n, side, weight, reps, value(n, side, 'rir'));
  }

  function openRir(n, side) {
    onOpenRir({
      title: `${exercise.exercise_name || exercise.name}${side ? ` (${side})` : ''}`,
      value: value(n, side, 'rir'),
      apply: v => setDraft(n, side, 'rir', v),
    });
  }

  function toggleUnilateral() {
    if (sets.length > 0) {
      Alert.alert('Cannot change yet', 'Remove this exercise\'s logged sets first, then switch between both sides and left/right.');
      return;
    }
    onToggleUnilateral(exercise);
  }

  const rows = [];
  for (let n = 1; n <= target; n++) {
    const sideList = unilateral ? SIDES : [null];
    for (const side of sideList) {
      const done = sets.find(x => x.set_number === n && (x.side || null) === side);
      rows.push(
        <SetRow
          key={key(n, side)}
          badge={side ? `${n}${side}` : String(n)}
          accent={side === 'L' ? colors.accent : side === 'R' ? colors.purple : null}
          done={done}
          weight={value(n, side, 'weight')}
          reps={value(n, side, 'reps')}
          rir={value(n, side, 'rir')}
          onChangeWeight={v => setDraft(n, side, 'weight', v)}
          onChangeReps={v => setDraft(n, side, 'reps', v)}
          onOpenRir={() => openRir(n, side)}
          onTick={() => tick(n, side)}
          onUntick={() => onUntick(done)}
        />
      );
    }
  }

  const lastRowRemovable = !sets.some(x => x.set_number === target);

  return (
    <View style={[s.block, { borderTopColor: mc }, allDone && { opacity: 0.55 }]}>
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={[s.name, allDone && s.struck]}>{exercise.exercise_name || exercise.name}</Text>
          <Text style={s.sub}>
            {exercise.muscle} · {doneCount}/{target} sets{unilateral ? ' · left & right' : ''}
          </Text>
        </View>
        {allDone ? <Ionicons name="checkmark-circle" size={22} color={colors.success} /> : null}
        <TouchableOpacity
          onPress={toggleUnilateral}
          style={[s.iconBtn, unilateral && { backgroundColor: colors.accent + '26', borderColor: colors.accent + '88' }]}
          hitSlop={6}
          accessibilityLabel="Toggle left and right sides"
        >
          <Text style={[s.lrText, unilateral && { color: colors.accent }]}>L/R</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onRemove(exercise)} style={s.trash} hitSlop={8} accessibilityLabel="Remove exercise">
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {rows}

      <View style={s.targetRow}>
        <TouchableOpacity
          onPress={() => onChangeTarget(exercise, -1)}
          disabled={target <= 1 || !lastRowRemovable}
          style={[s.targetBtn, (target <= 1 || !lastRowRemovable) && { opacity: 0.3 }]}
        >
          <Ionicons name="remove" size={16} color={colors.textDim} />
          <Text style={s.targetText}>Remove set</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChangeTarget(exercise, 1)} style={s.targetBtn}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={[s.targetText, { color: colors.accent }]}>Add set</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  block: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderTopWidth: 2, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  name: { fontSize: font.md, fontWeight: '700', color: colors.text },
  sub: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  iconBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  lrText: { fontSize: font.xs, fontWeight: '800', color: colors.textMuted },
  trash: { padding: 2 },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  targetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  targetText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
});
