import { useState, useEffect, useMemo } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, FlatList, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import { MUSCLES } from '../../constants/exercises';

const FILTERS = ['All', ...MUSCLES];

export default function ExercisePicker({ visible, exercises, addedIds, onPick, onClose, onCreate }) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('All');

  useEffect(() => {
    if (visible) { setSearch(''); setMuscle('All'); }
  }, [visible]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter(e =>
      (muscle === 'All' || e.muscle === muscle) &&
      (!q || e.name.toLowerCase().includes(q) || (e.equipment || '').toLowerCase().includes(q))
    );
  }, [exercises, search, muscle]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>Add Exercise</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <View style={s.search}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={s.searchInput}
              placeholder="Search exercises..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.chipScroll}
            contentContainerStyle={s.chipContent}
          >
            {FILTERS.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.chip, muscle === m && { backgroundColor: m === 'All' ? colors.accent : muscleColor(m), borderColor: 'transparent' }]}
                onPress={() => setMuscle(m)}
              >
                <Text style={[s.chipText, muscle === m && { color: colors.white }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={list}
            keyExtractor={i => i.id}
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
            ListEmptyComponent={<Text style={s.empty}>No exercises match</Text>}
            renderItem={({ item }) => {
              const mc = muscleColor(item.muscle);
              const added = addedIds.has(item.id);
              return (
                <TouchableOpacity style={[s.item, added && { opacity: 0.45 }]} onPress={() => onPick(item)} disabled={added}>
                  <View style={[s.dot, { backgroundColor: mc }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.itemName}>{item.name}</Text>
                    <Text style={s.itemMeta}>
                      {item.muscle} · {item.equipment}{item.is_unilateral ? ' · L/R' : ''}
                    </Text>
                  </View>
                  {added ? <Text style={s.added}>Added</Text> : null}
                </TouchableOpacity>
              );
            }}
          />

          {onCreate ? (
            <TouchableOpacity style={s.create} onPress={onCreate}>
              <Ionicons name="add-circle-outline" size={18} color={colors.accent} />
              <Text style={s.createText}>Create new exercise</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { height: '82%', backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 40 },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipContent: { gap: spacing.sm, flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  dot: { width: 10, height: 10, borderRadius: 5 },
  itemName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  itemMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  added: { fontSize: font.xs, color: colors.textMuted, fontStyle: 'italic' },
  empty: { textAlign: 'center', color: colors.textMuted, paddingVertical: spacing.xl },
  create: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.md },
  createText: { color: colors.accent, fontWeight: '600', fontSize: font.base },
});
