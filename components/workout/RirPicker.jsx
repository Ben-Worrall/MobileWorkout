import { Modal, View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../../constants/theme';

const HINTS = {
  0: 'No reps left - went to failure',
  1: 'Could have done 1 more rep',
  2: 'Could have done 2 more reps',
  3: 'Could have done 3 more reps',
  4: 'Could have done 4 more reps',
  5: 'Could have done 5 more reps',
  10: 'Very easy - 10 or more reps left',
};

function hintFor(v) {
  if (v == null) return 'Reps in reserve: how many more reps you could have done';
  return HINTS[v] || `Could have done ${v} more reps`;
}

// Bottom sheet with 0-10 buttons. `value` is the current RIR (or null); onSelect(null) clears it.
export default function RirPicker({ visible, value, title, onSelect, onClose }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <Text style={s.title}>Reps in reserve{title ? ` · ${title}` : ''}</Text>
          <Text style={s.hint}>{hintFor(value)}</Text>
          <View style={s.grid}>
            {Array.from({ length: 11 }, (_, i) => i).map(n => {
              const active = value === n;
              return (
                <TouchableOpacity
                  key={n}
                  style={[s.cell, active && s.cellActive]}
                  onPress={() => onSelect(n)}
                  accessibilityLabel={`RIR ${n}`}
                >
                  <Text style={[s.cellText, active && s.cellTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={s.footer}>
            <TouchableOpacity onPress={() => onSelect(null)} style={s.clearBtn}>
              <Text style={s.clearText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>Done</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.xl, borderTopWidth: 1, borderColor: colors.border },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  hint: { fontSize: font.sm, color: colors.textDim, marginTop: 4, marginBottom: spacing.md, minHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' },
  cell: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.bg3, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  cellActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  cellText: { fontSize: font.lg, fontWeight: '700', color: colors.text, textAlign: 'center', includeFontPadding: false },
  cellTextActive: { color: colors.white },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.lg },
  clearBtn: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  clearText: { color: colors.textDim, fontWeight: '600', fontSize: font.base },
  closeBtn: { backgroundColor: colors.accent, paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.xl, borderRadius: radius.full },
  closeText: { color: colors.white, fontWeight: '700', fontSize: font.base },
});
