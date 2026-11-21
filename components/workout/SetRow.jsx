import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../constants/theme';
import { useUnit } from '../../context/UnitContext';

// One loggable line: [badge] kg x reps [RIR] [tick]. `done` is the logged set (if any).
export default function SetRow({
  badge, accent, done, weight, reps, rir,
  onChangeWeight, onChangeReps, onOpenRir, onTick, onUntick,
}) {
  const shownRir = done ? done.rir : rir;
  const { fmtW, unit } = useUnit();
  return (
    <View style={[s.row, done && s.rowDone]}>
      <View style={[s.badge, accent && { backgroundColor: accent + '33' }]}>
        <Text style={[s.badgeText, accent && { color: accent }]}>{badge}</Text>
      </View>

      {done ? (
        <View style={s.values}>
          <Text style={[s.value, s.struck]}>{done.weight > 0 ? fmtW(done.weight) : 'BW'}</Text>
          <Text style={s.x}>×</Text>
          <Text style={[s.value, s.struck]}>{done.reps}</Text>
          {done.rir != null ? <Text style={s.rirDone}>@{done.rir}</Text> : null}
        </View>
      ) : (
        <View style={s.values}>
          <TextInput
            style={s.input}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={onChangeWeight}
            placeholder={unit}
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
          <Text style={s.x}>×</Text>
          <TextInput
            style={s.input}
            keyboardType="number-pad"
            value={reps}
            onChangeText={onChangeReps}
            placeholder="reps"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
          <TouchableOpacity
            style={[s.rirBtn, shownRir != null && s.rirBtnSet]}
            onPress={onOpenRir}
            accessibilityLabel="Set reps in reserve"
          >
            <Text style={[s.rirText, shownRir != null && s.rirTextSet]}>
              {shownRir != null ? `RIR ${shownRir}` : 'RIR'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity
        style={[s.tick, done && s.tickDone]}
        onPress={done ? onUntick : onTick}
        accessibilityLabel={done ? 'Undo set' : 'Log set'}
      >
        <Ionicons name="checkmark" size={18} color={done ? colors.white : colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  rowDone: { backgroundColor: colors.success + '12' },
  badge: { minWidth: 26, height: 26, paddingHorizontal: 4, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  badgeText: { fontSize: font.xs, fontWeight: '700', color: colors.textDim },
  values: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  input: { width: 54, backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: font.base, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  x: { fontSize: font.sm, color: colors.textMuted },
  value: { fontSize: font.base, fontWeight: '600', color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  rirDone: { fontSize: font.sm, color: colors.textDim, fontWeight: '600', marginLeft: 2 },
  rirBtn: { minWidth: 52, paddingVertical: 6, paddingHorizontal: 6, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg3, alignItems: 'center' },
  rirBtnSet: { borderColor: colors.accent + '88', backgroundColor: colors.accent + '1f' },
  rirText: { fontSize: font.sm, fontWeight: '700', color: colors.textMuted },
  rirTextSet: { color: colors.accent },
  tick: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginLeft: spacing.sm },
  tickDone: { backgroundColor: colors.success, borderColor: colors.success },
});
