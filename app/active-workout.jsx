import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, Modal, FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../constants/theme';
import { getWorkouts, saveSession, uid } from '../utils/storage';
import { EXERCISES, MUSCLES } from '../utils/exercises';

export default function ActiveWorkout() {
  const { workoutId } = useLocalSearchParams();
  const [workoutName, setWorkoutName] = useState('Quick Workout');
  const [exercises, setExercises] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [startTime] = useState(Date.now());
  const [pickingExercise, setPickingExercise] = useState(false);
  const [exSearch, setExSearch] = useState('');
  const [exFilter, setExFilter] = useState('All');
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    if (workoutId) loadWorkout(workoutId);
    return () => clearInterval(timerRef.current);
  }, []);

  async function loadWorkout(id) {
    const workouts = await getWorkouts();
    const w = workouts.find(w => w.id === id);
    if (!w) return;
    setWorkoutName(w.name);
    setExercises(w.exercises.map(ex => ({
      ...ex,
      instanceId: uid(),
      sets: [{ id: uid(), weight: '', reps: '', done: false }],
    })));
  }

  function formatTime(s) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  function addSet(exerciseIdx) {
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIdx] };
      const lastSet = ex.sets[ex.sets.length - 1];
      ex.sets = [...ex.sets, { id: uid(), weight: lastSet?.weight || '', reps: lastSet?.reps || '', done: false }];
      updated[exerciseIdx] = ex;
      return updated;
    });
  }

  function removeSet(exerciseIdx, setIdx) {
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIdx] };
      if (ex.sets.length <= 1) return prev;
      ex.sets = ex.sets.filter((_, i) => i !== setIdx);
      updated[exerciseIdx] = ex;
      return updated;
    });
  }

  function updateSet(exerciseIdx, setIdx, field, value) {
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIdx] };
      ex.sets = ex.sets.map((s, i) => i === setIdx ? { ...s, [field]: value } : s);
      updated[exerciseIdx] = ex;
      return updated;
    });
  }

  function toggleSet(exerciseIdx, setIdx) {
    setExercises(prev => {
      const updated = [...prev];
      const ex = { ...updated[exerciseIdx] };
      ex.sets = ex.sets.map((s, i) => i === setIdx ? { ...s, done: !s.done } : s);
      updated[exerciseIdx] = ex;
      return updated;
    });
  }

  function removeExercise(idx) {
    Alert.alert('Remove Exercise', 'Remove this exercise from the workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setExercises(prev => prev.filter((_, i) => i !== idx)) },
    ]);
  }

  function addExercise(exercise) {
    setExercises(prev => [...prev, {
      ...exercise,
      instanceId: uid(),
      sets: [{ id: uid(), weight: '', reps: '', done: false }],
    }]);
    setPickingExercise(false);
    setExSearch('');
    setExFilter('All');
  }

  async function finishWorkout() {
    const doneSets = exercises.some(ex => ex.sets.some(s => s.done));
    if (!doneSets && exercises.length > 0) {
      Alert.alert('No sets logged', 'Mark at least one set as done before finishing.');
      return;
    }

    const session = {
      id: uid(),
      name: workoutName,
      startedAt: startTime,
      duration: elapsed * 1000,
      exercises: exercises.map(ex => ({
        id: ex.id,
        name: ex.name,
        muscle: ex.muscle,
        sets: ex.sets,
      })),
    };

    await saveSession(session);
    clearInterval(timerRef.current);
    router.replace('/(tabs)');
  }

  function handleDiscard() {
    Alert.alert('Discard Workout', 'Are you sure you want to discard this workout?', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearInterval(timerRef.current); router.replace('/(tabs)'); } },
    ]);
  }

  const filteredExercises = EXERCISES.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(exSearch.toLowerCase());
    const matchMuscle = exFilter === 'All' || e.muscle === exFilter;
    return matchSearch && matchMuscle;
  });

  const muscles = ['All', ...MUSCLES];

  const doneSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.done).length, 0);

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleDiscard} style={styles.discardBtn}>
          <Ionicons name="close" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <TextInput
            style={styles.workoutName}
            value={workoutName}
            onChangeText={setWorkoutName}
            selectTextOnFocus
          />
          <Text style={styles.timer}>{formatTime(elapsed)}</Text>
        </View>
        <TouchableOpacity style={styles.finishBtn} onPress={finishWorkout}>
          <Text style={styles.finishText}>Finish</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsBanner}>
        <Text style={styles.statBannerText}>{exercises.length} exercises · {doneSetsCount} sets done</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {exercises.map((ex, exIdx) => (
          <View key={ex.instanceId} style={styles.exerciseCard}>
            <View style={styles.exHeader}>
              <View>
                <Text style={styles.exName}>{ex.name}</Text>
                <Text style={styles.exMuscle}>{ex.muscle} · {ex.equipment}</Text>
              </View>
              <TouchableOpacity onPress={() => removeExercise(exIdx)}>
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.setsHeader}>
              <Text style={[styles.setCol, styles.setColNum]}>SET</Text>
              <Text style={[styles.setCol, styles.setColWeight]}>KG</Text>
              <Text style={[styles.setCol, styles.setColReps]}>REPS</Text>
              <Text style={[styles.setCol, styles.setColDone]}>✓</Text>
            </View>

            {ex.sets.map((set, setIdx) => (
              <View key={set.id} style={[styles.setRow, set.done && styles.setRowDone]}>
                <TouchableOpacity style={styles.setColNum} onLongPress={() => removeSet(exIdx, setIdx)}>
                  <Text style={styles.setNum}>{setIdx + 1}</Text>
                </TouchableOpacity>
                <TextInput
                  style={[styles.setInput, styles.setColWeight]}
                  value={set.weight}
                  onChangeText={v => updateSet(exIdx, setIdx, 'weight', v)}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  editable={!set.done}
                />
                <TextInput
                  style={[styles.setInput, styles.setColReps]}
                  value={set.reps}
                  onChangeText={v => updateSet(exIdx, setIdx, 'reps', v)}
                  keyboardType="number-pad"
                  placeholder="—"
                  placeholderTextColor={colors.textMuted}
                  editable={!set.done}
                />
                <TouchableOpacity style={[styles.setColDone, styles.checkBtn, set.done && styles.checkBtnDone]} onPress={() => toggleSet(exIdx, setIdx)}>
                  {set.done && <Ionicons name="checkmark" size={16} color={colors.white} />}
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={styles.addSetText}>Add Set</Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addExBtn} onPress={() => setPickingExercise(true)}>
          <Ionicons name="add-circle" size={20} color={colors.accent} />
          <Text style={styles.addExText}>Add Exercise</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Exercise picker modal */}
      <Modal visible={pickingExercise} animationType="slide" onRequestClose={() => setPickingExercise(false)}>
        <SafeAreaView style={styles.pickerSafe}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Add Exercise</Text>
            <TouchableOpacity onPress={() => { setPickingExercise(false); setExSearch(''); setExFilter('All'); }}>
              <Ionicons name="close" size={24} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <View style={styles.pickerSearch}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              style={styles.pickerSearchInput}
              placeholder="Search..."
              placeholderTextColor={colors.textMuted}
              value={exSearch}
              onChangeText={setExSearch}
              autoFocus
            />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerFilters} contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {muscles.map(m => (
              <TouchableOpacity key={m} style={[styles.filterChip, exFilter === m && styles.filterChipActive]} onPress={() => setExFilter(m)}>
                <Text style={[styles.filterText, exFilter === m && styles.filterTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FlatList
            data={filteredExercises}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.pickerItem} onPress={() => addExercise(item)}>
                <View>
                  <Text style={styles.pickerItemName}>{item.name}</Text>
                  <Text style={styles.pickerItemMeta}>{item.muscle} · {item.equipment}</Text>
                </View>
                <Ionicons name="add-circle-outline" size={22} color={colors.accent} />
              </TouchableOpacity>
            )}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  discardBtn: { padding: spacing.sm },
  headerCenter: { flex: 1, alignItems: 'center' },
  workoutName: { fontSize: font.md, fontWeight: '700', color: colors.text, textAlign: 'center' },
  timer: { fontSize: font.sm, color: colors.accent, marginTop: 1 },
  finishBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm - 2, borderRadius: radius.sm },
  finishText: { color: colors.white, fontWeight: '700', fontSize: font.base },
  statsBanner: { backgroundColor: colors.bg2, paddingVertical: spacing.sm, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border },
  statBannerText: { fontSize: font.sm, color: colors.textMuted },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 80 },
  exerciseCard: { backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  exHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.md },
  exName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  exMuscle: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  setsHeader: { flexDirection: 'row', marginBottom: spacing.xs },
  setCol: { textAlign: 'center', fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  setColNum: { width: 36 },
  setColWeight: { flex: 1, marginHorizontal: spacing.xs },
  setColReps: { flex: 1, marginHorizontal: spacing.xs },
  setColDone: { width: 36 },
  setRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, borderRadius: radius.sm, paddingVertical: spacing.xs },
  setRowDone: { backgroundColor: colors.success + '11' },
  setNum: { textAlign: 'center', color: colors.textMuted, fontWeight: '600', fontSize: font.base },
  setInput: {
    backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, textAlign: 'center', color: colors.text, fontSize: font.base,
  },
  checkBtn: { width: 36, height: 36, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkBtnDone: { backgroundColor: colors.success, borderColor: colors.success },
  addSetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, padding: spacing.sm, marginTop: spacing.xs, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed' },
  addSetText: { color: colors.accent, fontSize: font.base, fontWeight: '500' },
  addExBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.accent, borderStyle: 'dashed', marginTop: spacing.sm },
  addExText: { color: colors.accent, fontSize: font.md, fontWeight: '600' },
  pickerSafe: { flex: 1, backgroundColor: colors.bg },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerTitle: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  pickerSearch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, margin: spacing.lg, padding: spacing.md },
  pickerSearchInput: { flex: 1, color: colors.text, fontSize: font.base },
  pickerFilters: { flexGrow: 0, marginBottom: spacing.sm },
  filterChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full, backgroundColor: colors.bg2, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.accentGlow, borderColor: colors.accent },
  filterText: { fontSize: font.sm, color: colors.textDim },
  filterTextActive: { color: colors.accent, fontWeight: '600' },
  pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerItemName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  pickerItemMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
});
