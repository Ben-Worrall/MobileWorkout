import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../../constants/theme';
import {
  getAllExercises, deleteCustomExercise,
  getTemplates, deleteTemplate,
} from '../../utils/database';
import { MUSCLES } from '../../constants/exercises';
import ExerciseForm from '../../components/ExerciseForm';
import { startOrResumeWorkout } from '../../utils/activeWorkout';

const TABS = ['Exercises', 'Routines'];

const MUSCLE_FILTERS = ['All', ...MUSCLES];

function ExerciseCard({ ex, onPress, onDelete, onEdit }) {
  const mc = muscleColor(ex.muscle);
  return (
    <TouchableOpacity style={[s.exCard, { borderLeftColor: mc }]} onPress={() => onPress(ex)}>
      <View style={s.exInfo}>
        <Text style={s.exName}>{ex.name}</Text>
        <View style={s.exTags}>
          <View style={[s.tag, { backgroundColor: mc + '22' }]}>
            <Text style={[s.tagText, { color: mc }]}>{ex.muscle}</Text>
          </View>
          {ex.equipment && (
            <View style={s.tag}>
              <Text style={s.tagText}>{ex.equipment}</Text>
            </View>
          )}
          {ex.is_custom ? (
            <View style={[s.tag, { backgroundColor: colors.accent + '22' }]}>
              <Text style={[s.tagText, { color: colors.accent }]}>Custom</Text>
            </View>
          ) : null}
        </View>
      </View>
      {ex.is_custom ? (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => onEdit(ex)} style={s.exDel} accessibilityLabel="Edit exercise">
            <Ionicons name="create-outline" size={18} color={colors.textDim} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onDelete(ex)} style={s.exDel} accessibilityLabel="Delete exercise">
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function TemplateCard({ tmpl, onPress, onDelete }) {
  const exercises = tmpl.exercises || [];
  return (
    <TouchableOpacity style={[s.tmplCard, { borderLeftColor: tmpl.color || colors.accent }]} onPress={() => onPress(tmpl)}>
      <View style={s.tmplInfo}>
        <Text style={s.tmplName}>{tmpl.name}</Text>
        {tmpl.description ? <Text style={s.tmplDesc} numberOfLines={1}>{tmpl.description}</Text> : null}
        <Text style={s.tmplMeta}>{exercises.length} exercise{exercises.length !== 1 ? 's' : ''}</Text>
        <View style={s.tmplMuscles}>
          {[...new Set(exercises.map(e => e.muscle))].slice(0, 4).map(m => (
            <View key={m} style={[s.tmplMuscleTag, { backgroundColor: muscleColor(m) + '20' }]}>
              <Text style={[s.tmplMuscleText, { color: muscleColor(m) }]}>{m}</Text>
            </View>
          ))}
        </View>
      </View>
      <View style={s.tmplActions}>
        <TouchableOpacity
          style={s.tmplStartBtn}
          onPress={() => startOrResumeWorkout(router, { templateId: tmpl.id })}
        >
          <Ionicons name="play" size={14} color={colors.white} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(tmpl)} style={s.tmplDelBtn}>
          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export default function LibraryScreen() {
  const [activeTab, setActiveTab] = useState(0);
  const [exercises, setExercises] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [muscleFilter, setMuscleFilter] = useState('All');
  const [formOpen, setFormOpen] = useState(false);
  const [editingEx, setEditingEx] = useState(null);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    const [exs, tmpls] = await Promise.all([getAllExercises(), getTemplates()]);
    setExercises(exs);
    setTemplates(tmpls);
  }

  const filteredExercises = useMemo(() => {
    let list = exercises;
    if (muscleFilter !== 'All') list = list.filter(e => e.muscle === muscleFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e => e.name.toLowerCase().includes(q) || e.muscle.toLowerCase().includes(q));
    }
    return list;
  }, [exercises, muscleFilter, search]);

  function openNewExercise() { setEditingEx(null); setFormOpen(true); }
  function openEditExercise(ex) { setEditingEx(ex); setFormOpen(true); }

  async function handleDeleteExercise(ex) {
    Alert.alert('Delete', `Delete "${ex.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCustomExercise(ex.id); load(); } },
    ]);
  }

  async function handleDeleteTemplate(tmpl) {
    Alert.alert('Delete', `Delete "${tmpl.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTemplate(tmpl.id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t, i) => (
          <TouchableOpacity key={t} style={[s.tabBtn, activeTab === i && s.tabBtnActive]} onPress={() => setActiveTab(i)}>
            <Text style={[s.tabText, activeTab === i && s.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 0 ? (
        // ── Exercises tab ──
        <>
          <View style={s.searchRow}>
            <View style={s.searchBox}>
              <Ionicons name="search" size={16} color={colors.textMuted} />
              <TextInput
                style={s.searchInput}
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
            <TouchableOpacity style={s.addBtn} onPress={openNewExercise}>
              <Ionicons name="add" size={20} color={colors.white} />
            </TouchableOpacity>
          </View>

          {/* Muscle filter chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.chipScroll} contentContainerStyle={s.chipContent}>
            {MUSCLE_FILTERS.map(m => (
              <TouchableOpacity
                key={m}
                style={[s.chip, muscleFilter === m && { backgroundColor: m === 'All' ? colors.accent : muscleColor(m), borderColor: 'transparent' }]}
                onPress={() => setMuscleFilter(m)}
              >
                <Text style={[s.chipText, muscleFilter === m && { color: colors.white }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <FlatList
            data={filteredExercises}
            keyExtractor={i => i.id}
            renderItem={({ item }) => (
              <ExerciseCard
                ex={item}
                onPress={ex => router.push({ pathname: '/exercise-detail', params: { exerciseId: ex.id, name: ex.name, muscle: ex.muscle } })}
                onDelete={handleDeleteExercise}
                onEdit={openEditExercise}
              />
            )}
            contentContainerStyle={s.listContent}
            ListEmptyComponent={<Text style={s.empty}>No exercises found</Text>}
          />
        </>
      ) : (
        // ── Routines tab ──
        <ScrollView style={s.scroll} contentContainerStyle={s.listContent}>
          <TouchableOpacity style={s.newRoutineBtn} onPress={() => router.push('/create-template')}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={s.newRoutineText}>Create New Routine</Text>
          </TouchableOpacity>

          {templates.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No routines yet</Text>
              <Text style={s.emptySub}>Create a routine to plan your workouts</Text>
            </View>
          )}

          {templates.map(t => (
            <TemplateCard
              key={t.id}
              tmpl={t}
              onPress={tmpl => router.push({ pathname: '/create-template', params: { templateId: tmpl.id } })}
              onDelete={handleDeleteTemplate}
            />
          ))}
        </ScrollView>
      )}

      <ExerciseForm
        visible={formOpen}
        exercise={editingEx}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.bg2 },
  tabBtn: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabBtnActive: { borderBottomWidth: 2, borderBottomColor: colors.accent },
  tabText: { fontSize: font.base, fontWeight: '600', color: colors.textMuted },
  tabTextActive: { color: colors.accent },
  searchRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, paddingBottom: 0 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 40 },
  searchInput: { flex: 1, color: colors.text, fontSize: font.base },
  addBtn: { width: 40, height: 40, backgroundColor: colors.accent, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  chipScroll: { flexGrow: 0, flexShrink: 0 },
  chipContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
  chipSm: { paddingHorizontal: spacing.sm },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  scroll: { flex: 1 },
  listContent: { padding: spacing.md, paddingBottom: 100, gap: spacing.sm },
  exCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    padding: spacing.md,
  },
  exInfo: { flex: 1 },
  exName: { fontSize: font.base, fontWeight: '600', color: colors.text, marginBottom: 4 },
  exTags: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  tag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm, backgroundColor: colors.bg3 },
  tagText: { fontSize: font.xs, fontWeight: '600', color: colors.textDim },
  exDel: { padding: spacing.sm },
  tmplCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    padding: spacing.md,
  },
  tmplInfo: { flex: 1 },
  tmplName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  tmplDesc: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  tmplMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 4 },
  tmplMuscles: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap', marginTop: spacing.sm },
  tmplMuscleTag: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: radius.sm },
  tmplMuscleText: { fontSize: font.xs, fontWeight: '600' },
  tmplActions: { gap: spacing.sm, alignItems: 'center' },
  tmplStartBtn: { width: 32, height: 32, backgroundColor: colors.accent, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  tmplDelBtn: { padding: 4 },
  newRoutineBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed', padding: spacing.md, marginBottom: spacing.sm },
  newRoutineText: { fontSize: font.base, fontWeight: '600', color: colors.accent },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
  empty: { textAlign: 'center', color: colors.textMuted, padding: spacing.xxl },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  fieldLabel: { fontSize: font.sm, fontWeight: '700', color: colors.textDim, marginBottom: spacing.sm, letterSpacing: 0.5 },
  fieldInput: { backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: spacing.md, fontSize: font.base, marginBottom: spacing.md },
  saveBtn: { backgroundColor: colors.accent, borderRadius: radius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: font.base },
});
