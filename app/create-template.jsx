import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { getAllExercises, getTemplate, saveTemplate, seedExercises, getExercise, uid } from '../utils/database';
import { BUILTIN_EXERCISES } from '../constants/exercises';
import ExercisePicker from '../components/workout/ExercisePicker';
import ExerciseForm from '../components/ExerciseForm';

const TEMPLATE_COLORS = ['#4d9fff', '#f87171', '#34d399', '#a78bfa', '#fbbf24', '#fb923c', '#38bdf8', '#f472b6'];

export default function CreateTemplate() {
  const { templateId } = useLocalSearchParams();
  const isEditing = !!templateId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(TEMPLATE_COLORS[0]);
  const [exercises, setExercises] = useState([]); // { exercise_id, exercise_name, muscle, default_sets, default_reps }
  const [pickingExercise, setPickingExercise] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isEditing) loadTemplate();
  }, [templateId]);

  async function loadTemplate() {
    const tmpl = await getTemplate(templateId);
    if (!tmpl) return;
    setName(tmpl.name);
    setDescription(tmpl.description || '');
    setColor(tmpl.color || TEMPLATE_COLORS[0]);
    setExercises(tmpl.exercises.map(te => ({
      exercise_id: te.exercise_id,
      exercise_name: te.exercise_name,
      muscle: te.muscle,
      equipment: te.equipment,
      default_sets: te.default_sets,
      default_reps: te.default_reps,
    })));
  }

  async function openPicker() {
    await seedExercises(BUILTIN_EXERCISES);
    const exs = await getAllExercises();
    setAllExercises(exs);
    setPickingExercise(true);
  }

  function handlePickExercise(ex) {
    if (!exercises.some(e => e.exercise_id === ex.id)) {
      setExercises(prev => [...prev, {
        exercise_id: ex.id,
        exercise_name: ex.name,
        muscle: ex.muscle,
        equipment: ex.equipment,
        default_sets: 3,
        default_reps: 10,
      }]);
    }
    setPickingExercise(false);
  }

  function removeExercise(exerciseId) {
    setExercises(prev => prev.filter(e => e.exercise_id !== exerciseId));
  }

  function updateExercise(exerciseId, field, value) {
    setExercises(prev => prev.map(e =>
      e.exercise_id === exerciseId ? { ...e, [field]: parseInt(value) || 0 } : e
    ));
  }

  function moveExercise(index, direction) {
    setExercises(prev => {
      const arr = [...prev];
      const target = index + direction;
      if (target < 0 || target >= arr.length) return arr;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }

  async function handleSave() {
    if (saving) return;
    if (!name.trim()) { Alert.alert('Name required'); return; }
    if (exercises.length === 0) { Alert.alert('Add at least one exercise'); return; }
    setSaving(true);
    try {
      await saveTemplate({
        id: isEditing ? templateId : uid(),
        name: name.trim(),
        description: description.trim() || null,
        color,
        exercises,
      });
      router.back();
    } catch (e) {
      setSaving(false);
      Alert.alert('Could not save', e.message);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.headerBtn}>
          <Ionicons name="close" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing ? 'Edit Routine' : 'New Routine'}</Text>
        <TouchableOpacity onPress={handleSave} style={[s.headerBtn, { alignItems: 'flex-end' }]}>
          <Text style={s.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Name */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Routine Name</Text>
          <TextInput
            style={s.fieldInput}
            placeholder="e.g. Push Day, Leg Day..."
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </View>

        {/* Description */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Description (optional)</Text>
          <TextInput
            style={[s.fieldInput, { height: 64 }]}
            placeholder="Notes about this routine..."
            placeholderTextColor={colors.textMuted}
            value={description}
            onChangeText={setDescription}
            multiline
          />
        </View>

        {/* Color */}
        <View style={s.field}>
          <Text style={s.fieldLabel}>Color</Text>
          <View style={s.colorRow}>
            {TEMPLATE_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[s.colorSwatch, { backgroundColor: c }, color === c && s.colorSwatchActive]}
                onPress={() => setColor(c)}
              >
                {color === c && <Ionicons name="checkmark" size={14} color={colors.white} />}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Exercises */}
        <View style={s.field}>
          <View style={s.fieldHeader}>
            <Text style={s.fieldLabel}>Exercises ({exercises.length})</Text>
          </View>

          {exercises.map((ex, i) => {
            const mc = muscleColor(ex.muscle);
            return (
              <View key={ex.exercise_id} style={[s.exRow, { borderLeftColor: mc }]}>
                <View style={s.exReorder}>
                  <TouchableOpacity onPress={() => moveExercise(i, -1)} disabled={i === 0} style={[s.reorderBtn, i === 0 && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-up" size={14} color={colors.textDim} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveExercise(i, 1)} disabled={i === exercises.length - 1} style={[s.reorderBtn, i === exercises.length - 1 && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-down" size={14} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
                <View style={s.exInfo}>
                  <Text style={s.exName}>{ex.exercise_name}</Text>
                  <Text style={s.exMuscle}>{ex.muscle}</Text>
                  <View style={s.setsRepsRow}>
                    <View style={s.srGroup}>
                      <Text style={s.srLabel}>Sets</Text>
                      <TextInput
                        style={s.srInput}
                        keyboardType="number-pad"
                        value={ex.default_sets?.toString()}
                        onChangeText={v => updateExercise(ex.exercise_id, 'default_sets', v)}
                        selectTextOnFocus
                      />
                    </View>
                    <Text style={s.srX}>×</Text>
                    <View style={s.srGroup}>
                      <Text style={s.srLabel}>Reps</Text>
                      <TextInput
                        style={s.srInput}
                        keyboardType="number-pad"
                        value={ex.default_reps?.toString()}
                        onChangeText={v => updateExercise(ex.exercise_id, 'default_reps', v)}
                        selectTextOnFocus
                      />
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => removeExercise(ex.exercise_id)} style={s.exDel}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}

          <TouchableOpacity style={s.addExBtn} onPress={openPicker}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={s.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ExercisePicker
        visible={pickingExercise}
        exercises={allExercises}
        addedIds={new Set(exercises.map(e => e.exercise_id))}
        onPick={handlePickExercise}
        onClose={() => setPickingExercise(false)}
        onCreate={() => { setPickingExercise(false); setTimeout(() => setCreatingExercise(true), 250); }}
      />

      <ExerciseForm
        visible={creatingExercise}
        exercise={null}
        onClose={() => setCreatingExercise(false)}
        onSaved={async saved => {
          setCreatingExercise(false);
          const row = await getExercise(saved.id);
          if (row) handlePickExercise(row);
        }}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerBtn: { width: 60 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.md, fontWeight: '700', color: colors.text },
  saveText: { color: colors.accent, fontWeight: '700', fontSize: font.base },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.md },
  field: { gap: spacing.sm },
  fieldHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { fontSize: font.sm, fontWeight: '700', color: colors.textDim, letterSpacing: 0.5 },
  fieldInput: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: spacing.md, fontSize: font.base },
  colorRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  colorSwatch: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  colorSwatchActive: { borderColor: colors.white },
  exRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm },
  exReorder: { gap: 2 },
  reorderBtn: { padding: 2 },
  exInfo: { flex: 1, gap: 4 },
  exName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  exMuscle: { fontSize: font.sm, color: colors.textDim },
  setsRepsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  srGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  srLabel: { fontSize: font.sm, color: colors.textMuted },
  srInput: { width: 44, backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: font.base, fontWeight: '700', textAlign: 'center', paddingVertical: 4 },
  srX: { fontSize: font.sm, color: colors.textMuted },
  exDel: { padding: spacing.xs },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed', padding: spacing.md },
  addExText: { color: colors.accent, fontWeight: '600', fontSize: font.base },
});
