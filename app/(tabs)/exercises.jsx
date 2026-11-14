import { useState } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../../constants/theme';
import { EXERCISES, MUSCLES } from '../../utils/exercises';

export default function ExercisesScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All');

  const muscles = ['All', ...MUSCLES];

  const filtered = EXERCISES.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchMuscle = filter === 'All' || e.muscle === filter;
    return matchSearch && matchMuscle;
  });

  const muscleColor = {
    Chest: '#ef4444', Back: '#3b82f6', Shoulders: '#a855f7',
    Biceps: '#f59e0b', Triceps: '#f97316', Legs: '#22c55e',
    Calves: '#06b6d4', Core: '#ec4899',
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search exercises..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        {muscles.map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.filterChip, filter === m && styles.filterChipActive]}
            onPress={() => setFilter(m)}
          >
            <Text style={[styles.filterText, filter === m && styles.filterTextActive]}>{m}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {filtered.map(ex => (
          <View key={ex.id} style={styles.card}>
            <View style={[styles.muscleTag, { backgroundColor: (muscleColor[ex.muscle] || colors.accent) + '22' }]}>
              <Text style={[styles.muscleText, { color: muscleColor[ex.muscle] || colors.accent }]}>{ex.muscle}</Text>
            </View>
            <View style={styles.cardInfo}>
              <Text style={styles.exName}>{ex.name}</Text>
              <Text style={styles.exEquipment}>{ex.equipment}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    marginHorizontal: spacing.lg, padding: spacing.md, marginBottom: spacing.sm,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base },
  filters: { flexGrow: 0 },
  filtersContent: { paddingHorizontal: spacing.lg, gap: spacing.sm, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  filterText: { fontSize: font.sm, color: colors.textDim },
  filterTextActive: { color: colors.accent, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.xs + 2,
  },
  muscleTag: { paddingHorizontal: spacing.sm, paddingVertical: 3, borderRadius: radius.sm, minWidth: 60, alignItems: 'center' },
  muscleText: { fontSize: font.sm, fontWeight: '600' },
  cardInfo: { flex: 1 },
  exName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  exEquipment: { fontSize: font.sm, color: colors.textMuted, marginTop: 1 },
});
