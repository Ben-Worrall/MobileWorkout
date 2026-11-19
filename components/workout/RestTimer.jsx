import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font } from '../../constants/theme';
import { formatSecs, restRemaining, restIsRunning } from '../../utils/timers';

function tone(secs) {
  return secs > 30 ? colors.success : secs > 10 ? colors.warning : colors.danger;
}

// Small pill shown in the header while a rest is active. Never overlays the scroll area.
export function RestChip({ rest, now, onPress }) {
  if (!rest) return null;
  const secs = restRemaining(rest, now);
  const running = restIsRunning(rest);
  const c = running ? tone(secs) : colors.textDim;
  return (
    <TouchableOpacity style={[s.chip, { borderColor: c + '88', backgroundColor: c + '1f' }]} onPress={onPress} accessibilityLabel="Open rest timer">
      <Ionicons name={running ? 'timer-outline' : 'pause-circle-outline'} size={14} color={c} />
      <Text style={[s.chipText, { color: c }]}>Rest {formatSecs(secs)}</Text>
    </TouchableOpacity>
  );
}

// Full controls, opened by tapping the chip. Tap outside or the chevron to minimise it again.
export function RestSheet({ visible, rest, now, onClose, onAdjust, onToggle, onSkip }) {
  const secs = restRemaining(rest, now);
  const running = restIsRunning(rest);
  const c = running ? tone(secs) : colors.textDim;
  const pct = rest && rest.total > 0 ? Math.min(1, secs / rest.total) : 0;
  return (
    <Modal visible={visible && !!rest} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.card} onPress={() => {}}>
          <View style={s.cardTop}>
            <Text style={s.label}>REST</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel="Minimise rest timer">
              <Ionicons name="chevron-down" size={24} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={[s.time, { color: c }]}>{formatSecs(secs)}</Text>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${pct * 100}%`, backgroundColor: c }]} />
          </View>
          <View style={s.btns}>
            <TouchableOpacity style={s.adj} onPress={() => onAdjust(-15)}>
              <Text style={s.adjText}>−15s</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.toggle} onPress={onToggle} accessibilityLabel={running ? 'Pause rest' : 'Resume rest'}>
              <Ionicons name={running ? 'pause' : 'play'} size={20} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={s.adj} onPress={() => onAdjust(15)}>
              <Text style={s.adjText}>+15s</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.skip} onPress={onSkip}>
            <Text style={s.skipText}>Skip rest</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  chipText: { fontSize: font.sm, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center', gap: spacing.sm, borderTopWidth: 1, borderColor: colors.border },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', alignSelf: 'stretch' },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5 },
  time: { fontSize: 56, fontWeight: '800' },
  barBg: { alignSelf: 'stretch', height: 4, backgroundColor: colors.bg3, borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 2 },
  btns: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.sm },
  adj: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  adjText: { fontSize: font.base, fontWeight: '600', color: colors.textDim },
  toggle: { backgroundColor: colors.accent, width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  skip: { paddingVertical: spacing.sm },
  skipText: { fontSize: font.base, color: colors.textMuted },
});
