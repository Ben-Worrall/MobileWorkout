import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '../../constants/theme';
import { useNow } from '../../utils/useNow';
import { formatClock, workoutElapsed } from '../../utils/timers';

// Play/pause button with the elapsed workout time. Owns its own ticking so the workout screen does not re-render.
export default function WorkoutClock({ timer, onToggle }) {
  const now = useNow(timer.running);
  const tint = timer.running ? colors.accent : colors.textMuted;
  return (
    <TouchableOpacity onPress={onToggle} style={s.btn} accessibilityLabel="Start or pause workout timer">
      <Ionicons name={timer.running ? 'pause-circle' : 'play-circle'} size={16} color={tint} />
      <Text style={[s.time, { color: tint }]}>{formatClock(workoutElapsed(timer, now))}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: font.sm, fontWeight: '600' },
});
