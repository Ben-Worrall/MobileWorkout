import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import {
  getTemplate, getAllExercises, createSession,
  logSet, deleteSet, finishSession, markScheduledComplete, uid,
} from '../utils/database';

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function SetRow({ set, onDelete }) {
  return (
    <View style={s.setRow}>
      <View style={s.setNumBadge}>
        <Text style={s.setNumText}>{set.set_number}</Text>
      </View>
      <View style={s.setValues}>
        <Text style={s.setValue}>{set.weight > 0 ? `${set.weight} kg` : 'BW'}</Text>
        <Text style={s.setX}>×</Text>
        <Text style={s.setValue}>{set.reps}</Text>
        <Text style={s.setUnit}>reps</Text>
      </View>
      <TouchableOpacity onPress={() => onDelete(set.id)} style={s.setDel}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

function ExerciseBlock({ exercise, sets, onAddSet, onDeleteSet, lastSet }) {
  const [weight, setWeight] = useState(lastSet?.weight?.toString() || '');
  const [reps, setReps] = useState(lastSet?.reps?.toString() || '10');
  const mc = muscleColor(exercise.muscle);

  function handleAdd() {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (!r) { Alert.alert('Enter reps'); return; }
    onAddSet(exercise, w, r);
  }

  return (
    <View style={[s.exBlock, { borderTopColor: mc }]}>
      <View style={s.exBlockHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.exBlockName}>{exercise.exercise_name || exercise.name}</Text>
          <Text style={s.exBlockMuscle}>{exercise.muscle}</Text>
        </View>
        <View style={[s.muscleDot, { backgroundColor: mc }]} />
      </View>

      {sets.map(set => (
        <SetRow key={set.id} set={set} onDelete={onDeleteSet} />
      ))}

      <View style={s.addSetRow}>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>kg</Text>
          <TextInput
            style={s.numInput}
            keyboardType="decimal-pad"
            value={weight}
            onChangeText={setWeight}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>
        <Text style={s.inputSep}>×</Text>
        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>reps</Text>
          <TextInput
            style={s.numInput}
            keyboardType="number-pad"
            value={reps}
            onChangeText={setReps}
            placeholder="10"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>
        <TouchableOpacity style={s.logSetBtn} onPress={handleAdd}>
          <Ionicons name="checkmark" size={18} color={colors.white} />
          <Text style={s.logSetText}>Log</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ActiveWorkout() {
  const { templateId, scheduledId } = useLocalSearchParams();

  const [sessionId] = useState(uid);
  const [sessionName, setSessionName] = useState('Quick Workout');
  const [exercises, setExercises] = useState([]);
  const [loggedSets, setLoggedSets] = useState({});
  const [lastSets, setLastSets] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [exSearch, setExSearch] = useState('');
  const [exMuscleFilter, setExMuscleFilter] = useState('All');
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    init();
    return () => clearInterval(timerRef.current);
  }, []);

  async function init() {
    let name = 'Quick Workout';
    let exList = [];
    if (templateId) {
      const tmpl = await getTemplate(templateId);
      if (tmpl) {
        name = tmpl.name;
        exList = tmpl.exercises.map(te => ({
          exercise_id: te.exercise_id,
          exercise_name: te.exercise_name,
          muscle: te.muscle,
          equipment: te.equipment,
        }));
      }
    }
    setSessionName(name);
    setExercises(exList);
    await createSession({ id: sessionId, name, templateId: templateId || null });
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
  }

  async function handleAddSet(exercise, weight, reps) {
    const setId = uid();
    const exId = exercise.exercise_id || exercise.id;
    const setNum = (loggedSets[exId]?.length || 0) + 1;
    await logSet({ id: setId, sessionId, exerciseId: exId, exerciseName: exercise.exercise_name || exercise.name, setNumber: setNum, weight, reps });
    setLoggedSets(prev => ({ ...prev, [exId]: [...(prev[exId] || []), { id: setId, set_number: setNum, weight, reps }] }));
    setLastSets(prev => ({ ...prev, [exId]: { weight, reps } }));
  }

  async function handleDeleteSet(setId) {
    await deleteSet(setId);
    setLoggedSets(prev => {
      const updated = {};
      for (const [exId, sets] of Object.entries(prev)) updated[exId] = sets.filter(s => s.id !== setId);
      return updated;
    });
  }

  async function openExercisePicker() {
    const exs = await getAllExercises();
    setAllExercises(exs);
    setPickingExercise(true);
  }

  function handleAddExercise(ex) {
    const alreadyAdded = exercises.some(e => (e.exercise_id || e.id) === ex.id);
    if (!alreadyAdded) {
      setExercises(prev => [...prev, { exercise_id: ex.id, exercise_name: ex.name, muscle: ex.muscle, equipment: ex.equipment }]);
    }
    setPickingExercise(false);
    setExSearch('');
  }

  function handleFinish() {
    const totalSets = Object.values(loggedSets).reduce((a, b) => a + b.length, 0);
    if (totalSets === 0) {
      Alert.alert('No sets logged', 'Log at least one set or discard this session.', [
        { text: 'Discard', style: 'destructive', onPress: () => { clearInterval(timerRef.current); router.back(); } },
        { text: 'Keep going', style: 'cancel' },
      ]);
      return;
    }
    clearInterval(timerRef.current);
    setFinishing(true);
  }

  async function confirmFinish() {
    await finishSession(sessionId, notes);
    if (scheduledId) await markScheduledComplete(scheduledId, sessionId);
    router.back();
  }

  function handleDiscard() {
    Alert.alert('Discard workout?', 'All logged sets will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: () => { clearInterval(timerRef.current); router.back(); } },
    ]);
  }

  const filteredAll = allExercises.filter(e => {
    const matchMuscle = exMuscleFilter === 'All' || e.muscle === exMuscleFilter;
    const matchSearch = !exSearch || e.name.toLowerCase().includes(exSearch.toLowerCase());
    return matchMuscle && matchSearch;
  });

  const totalSetsCount = Object.values(loggedSets).reduce((a, b) => a + b.length, 0);
  const muscles = [...new Set(exercises.map(e => e.muscle).filter(Boolean))];

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        {/* Header */}
        <View style={s.header}>
          <TouchableOpacity onPress={handleDiscard} style={s.headerSide}>
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>{sessionName}</Text>
            <Text style={s.timer}>{formatTime(elapsed)}</Text>
          </View>
          <TouchableOpacity onPress={handleFinish} style={[s.headerSide, { alignItems: 'flex-end' }]}>
            <Text style={s.finishText}>Finish</Text>
          </TouchableOpacity>
        </View>

        {/* Stats bar */}
        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{exercises.length}</Text>
            <Text style={s.statLbl}>Exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{totalSetsCount}</Text>
            <Text style={s.statLbl}>Sets</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
              {muscles.slice(0, 3).map(m => (
                <View key={m} style={[s.musclePip, { backgroundColor: muscleColor(m) }]} />
              ))}
              {muscles.length > 3 ? <Text style={{ fontSize: 9, color: colors.textMuted }}>+{muscles.length - 3}</Text> : null}
              {muscles.length === 0 ? <Text style={{ fontSize: font.sm, color: colors.textMuted }}>—</Text> : null}
            </View>
            <Text style={s.statLbl}>Muscles</Text>
          </View>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {exercises.length === 0 && (
            <View style={s.emptyState}>
              <Ionicons name="barbell-outline" size={48} color={colors.textMuted} />
              <Text style={s.emptyTitle}>No exercises added</Text>
              <Text style={s.emptySub}>Tap "Add Exercise" below to get started</Text>
            </View>
          )}

          {exercises.map(ex => (
            <ExerciseBlock
              key={ex.exercise_id || ex.id}
              exercise={ex}
              sets={loggedSets[ex.exercise_id || ex.id] || []}
              onAddSet={handleAddSet}
              onDeleteSet={handleDeleteSet}
              lastSet={lastSets[ex.exercise_id || ex.id]}
            />
          ))}

          <TouchableOpacity style={s.addExBtn} onPress={openExercisePicker}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={s.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Exercise picker modal */}
        <Modal visible={pickingExercise} transparent animationType="slide" onRequestClose={() => setPickingExercise(false)}>
          <View style={s.overlay}>
            <View style={s.modal}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>Add Exercise</Text>
                <TouchableOpacity onPress={() => setPickingExercise(false)}>
                  <Ionicons name="close" size={22} color={colors.textDim} />
                </TouchableOpacity>
              </View>
              <View style={s.modalSearch}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  style={s.modalSearchInput}
                  placeholder="Search..."
                  placeholderTextColor={colors.textMuted}
                  value={exSearch}
                  onChangeText={setExSearch}
                  autoFocus
                />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, flexDirection: 'row', paddingVertical: spacing.sm, paddingHorizontal: spacing.xs }}>
                {['All', 'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Calves'].map(m => (
                  <TouchableOpacity
                    key={m}
                    style={[s.chip, exMuscleFilter === m && { backgroundColor: m === 'All' ? colors.accent : muscleColor(m), borderColor: 'transparent' }]}
                    onPress={() => setExMuscleFilter(m)}
                  >
                    <Text style={[s.chipText, exMuscleFilter === m && { color: colors.white }]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <FlatList
                data={filteredAll}
                keyExtractor={i => i.id}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const mc = muscleColor(item.muscle);
                  const added = exercises.some(e => (e.exercise_id || e.id) === item.id);
                  return (
                    <TouchableOpacity
                      style={[s.pickItem, added && { opacity: 0.45 }]}
                      onPress={() => handleAddExercise(item)}
                      disabled={added}
                    >
                      <View style={[s.pickDot, { backgroundColor: mc }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.pickName}>{item.name}</Text>
                        <Text style={s.pickMeta}>{item.muscle} · {item.equipment}</Text>
                      </View>
                      {added && <Text style={s.addedTag}>Added</Text>}
                    </TouchableOpacity>
                  );
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </Modal>

        {/* Finish summary modal */}
        <Modal visible={finishing} transparent animationType="fade" onRequestClose={() => setFinishing(false)}>
          <View style={[s.overlay, { justifyContent: 'center', padding: spacing.lg }]}>
            <View style={[s.modal, { borderRadius: radius.xl }]}>
              <Text style={[s.modalTitle, { textAlign: 'center', marginBottom: spacing.md }]}>Finish Workout</Text>
              <View style={s.summaryStats}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{formatTime(elapsed)}</Text>
                  <Text style={s.summaryLbl}>Duration</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{totalSetsCount}</Text>
                  <Text style={s.summaryLbl}>Sets</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{exercises.length}</Text>
                  <Text style={s.summaryLbl}>Exercises</Text>
                </View>
              </View>
              <TextInput
                style={[s.fieldInput, { marginBottom: spacing.lg }]}
                placeholder="Notes (optional)..."
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
              <TouchableOpacity style={s.saveBtn} onPress={confirmFinish}>
                <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                <Text style={s.saveBtnText}>Save Workout</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setFinishing(false)}>
                <Text style={s.cancelBtnText}>Keep Going</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerSide: { width: 60 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: font.base, fontWeight: '700', color: colors.text },
  timer: { fontSize: font.sm, color: colors.accent, fontWeight: '600' },
  finishText: { color: colors.accent, fontWeight: '700', fontSize: font.base },
  statsBar: { flexDirection: 'row', backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statVal: { fontSize: font.md, fontWeight: '700', color: colors.text },
  statLbl: { fontSize: font.xs, color: colors.textMuted },
  musclePip: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 120, gap: spacing.md },
  exBlock: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderTopWidth: 2, overflow: 'hidden' },
  exBlockHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  exBlockName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  exBlockMuscle: { fontSize: font.sm, color: colors.textDim, marginTop: 2 },
  muscleDot: { width: 10, height: 10, borderRadius: 5 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  setNumBadge: { width: 24, height: 24, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  setNumText: { fontSize: font.xs, fontWeight: '700', color: colors.textDim },
  setValues: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setValue: { fontSize: font.base, fontWeight: '600', color: colors.text },
  setX: { fontSize: font.sm, color: colors.textMuted },
  setUnit: { fontSize: font.sm, color: colors.textMuted },
  setDel: { padding: spacing.xs },
  addSetRow: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.md, gap: spacing.sm },
  inputGroup: { flex: 1, gap: 4 },
  inputLabel: { fontSize: font.xs, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  numInput: { backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: font.md, fontWeight: '700', textAlign: 'center', paddingVertical: spacing.sm },
  inputSep: { fontSize: font.lg, color: colors.textMuted, paddingBottom: spacing.sm },
  logSetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md },
  logSetText: { color: colors.white, fontWeight: '700', fontSize: font.sm },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed', padding: spacing.md },
  addExText: { color: colors.accent, fontWeight: '600', fontSize: font.base },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '80%', padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalSearch: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 40, marginBottom: spacing.xs },
  modalSearchInput: { flex: 1, color: colors.text, fontSize: font.base },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  pickItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  pickDot: { width: 10, height: 10, borderRadius: 5 },
  pickName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  pickMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  addedTag: { fontSize: font.xs, color: colors.textMuted, fontStyle: 'italic' },
  summaryStats: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: colors.bg3, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md },
  summaryItem: { alignItems: 'center', gap: 4 },
  summaryVal: { fontSize: font.xl, fontWeight: '700', color: colors.text },
  summaryLbl: { fontSize: font.xs, color: colors.textMuted },
  fieldInput: { backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: spacing.md, fontSize: font.base, minHeight: 60 },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.accent, borderRadius: radius.full, padding: spacing.md },
  saveBtnText: { color: colors.white, fontWeight: '700', fontSize: font.base },
  cancelBtn: { alignItems: 'center', padding: spacing.md, marginTop: spacing.xs },
  cancelBtnText: { color: colors.textDim, fontSize: font.base },
});
