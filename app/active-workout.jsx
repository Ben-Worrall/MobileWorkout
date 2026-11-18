import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, Alert, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { BUILTIN_EXERCISES } from '../constants/exercises';
import {
  getTemplate, getAllExercises, createSession, seedExercises,
  logSet, deleteSet, finishSession, markScheduledComplete, uid, getSetting,
} from '../utils/database';

const DEFAULT_REST = 90; // fallback if no setting saved

function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function formatSecs(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function ExerciseBlock({ exercise, sets, onTickSet, onUntickSet, onChangeTarget, lastSet }) {
  const [drafts, setDrafts] = useState({});
  const mc = muscleColor(exercise.muscle);
  const target = exercise.target_sets || 3;
  const defaultReps = String(exercise.default_reps || 10);
  const loggedCount = sets.length;
  const allDone = target > 0 && Array.from({ length: target }, (_, i) => i + 1).every(n => sets.some(x => x.set_number === n));

  function draftValue(n, key) {
    const d = drafts[n]?.[key];
    if (d !== undefined) return d;
    if (key === 'weight') return lastSet?.weight ? String(lastSet.weight) : '';
    return lastSet?.reps ? String(lastSet.reps) : defaultReps;
  }

  function setDraft(n, key, val) {
    setDrafts(prev => ({ ...prev, [n]: { ...prev[n], [key]: val } }));
  }

  function tick(n) {
    const w = parseFloat(draftValue(n, 'weight')) || 0;
    const r = parseInt(draftValue(n, 'reps')) || 0;
    if (!r) { Alert.alert('Enter reps'); return; }
    onTickSet(exercise, n, w, r);
  }

  return (
    <View style={[s.exBlock, { borderTopColor: mc }, allDone && { opacity: 0.55 }]}>
      <View style={s.exBlockHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[s.exBlockName, allDone && s.struck]}>{exercise.exercise_name || exercise.name}</Text>
          <Text style={s.exBlockMuscle}>{exercise.muscle} · {Math.min(loggedCount, target)}/{target} sets</Text>
        </View>
        {allDone
          ? <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          : <View style={[s.muscleDot, { backgroundColor: mc }]} />}
      </View>

      {Array.from({ length: target }, (_, i) => i + 1).map(n => {
        const done = sets.find(x => x.set_number === n);
        return (
          <View key={n} style={[s.setRow, done && { backgroundColor: colors.success + '12' }]}>
            <View style={s.setNumBadge}>
              <Text style={s.setNumText}>{n}</Text>
            </View>
            {done ? (
              <View style={s.setValues}>
                <Text style={[s.setValue, s.struck]}>{done.weight > 0 ? `${done.weight} kg` : 'BW'}</Text>
                <Text style={s.setX}>×</Text>
                <Text style={[s.setValue, s.struck]}>{done.reps}</Text>
                <Text style={s.setUnit}>reps</Text>
              </View>
            ) : (
              <View style={s.setValues}>
                <TextInput
                  style={s.inlineInput}
                  keyboardType="decimal-pad"
                  value={draftValue(n, 'weight')}
                  onChangeText={v => setDraft(n, 'weight', v)}
                  placeholder="kg"
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
                <Text style={s.setX}>×</Text>
                <TextInput
                  style={s.inlineInput}
                  keyboardType="number-pad"
                  value={draftValue(n, 'reps')}
                  onChangeText={v => setDraft(n, 'reps', v)}
                  placeholder="reps"
                  placeholderTextColor={colors.textMuted}
                  selectTextOnFocus
                />
              </View>
            )}
            <TouchableOpacity
              style={[s.tickBtn, done && { backgroundColor: colors.success, borderColor: colors.success }]}
              onPress={() => (done ? onUntickSet(done.id) : tick(n))}
            >
              <Ionicons name="checkmark" size={18} color={done ? colors.white : colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={s.targetRow}>
        <TouchableOpacity
          onPress={() => onChangeTarget(exercise, -1)}
          disabled={target <= 1 || sets.some(x => x.set_number === target)}
          style={[s.targetBtn, (target <= 1 || sets.some(x => x.set_number === target)) && { opacity: 0.3 }]}
        >
          <Ionicons name="remove" size={16} color={colors.textDim} />
          <Text style={s.targetText}>Remove set</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onChangeTarget(exercise, 1)} style={s.targetBtn}>
          <Ionicons name="add" size={16} color={colors.accent} />
          <Text style={[s.targetText, { color: colors.accent }]}>Add set</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Rest Timer Overlay ───────────────────────────────────────────────────────

function RestTimer({ visible, duration = DEFAULT_REST, onDismiss }) {
  const [secs, setSecs] = useState(duration);
  const [running, setRunning] = useState(true);
  const intervalRef = useRef(null);
  const totalRef = useRef(duration);

  useEffect(() => {
    if (!visible) return;
    totalRef.current = duration;
    setSecs(duration);
    setRunning(true);
    return () => clearInterval(intervalRef.current);
  }, [visible, duration]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    if (!running || !visible) return;
    intervalRef.current = setInterval(() => {
      setSecs(prev => {
        if (prev <= 1) { clearInterval(intervalRef.current); onDismiss(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [running, visible]);

  if (!visible) return null;

  const pct = secs / (totalRef.current || duration);
  const color = secs > 30 ? colors.success : secs > 10 ? colors.warning : colors.danger;

  return (
    <View style={s.restOverlay}>
      <View style={s.restCard}>
        <Text style={s.restLabel}>REST</Text>
        <Text style={[s.restTime, { color }]}>{formatSecs(secs)}</Text>
        <View style={s.restBarBg}>
          <View style={[s.restBarFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
        </View>
        <View style={s.restBtns}>
          <TouchableOpacity style={s.restAdjBtn} onPress={() => setSecs(s => Math.max(0, s - 15))}>
            <Text style={s.restAdjText}>−15s</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.restToggleBtn} onPress={() => setRunning(r => !r)}>
            <Ionicons name={running ? 'pause' : 'play'} size={18} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity style={s.restAdjBtn} onPress={() => setSecs(s => s + 15)}>
            <Text style={s.restAdjText}>+15s</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={s.restSkip} onPress={onDismiss}>
          <Text style={s.restSkipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ActiveWorkout() {
  const { templateId, scheduledId } = useLocalSearchParams();

  const [sessionId] = useState(uid);
  const [sessionName, setSessionName] = useState('Quick Workout');
  const [exercises, setExercises] = useState([]);
  const [loggedSets, setLoggedSets] = useState({});
  const [lastSets, setLastSets] = useState({});
  const [elapsed, setElapsed] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [exSearch, setExSearch] = useState('');
  const [exMuscleFilter, setExMuscleFilter] = useState('All');
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  const [showRest, setShowRest] = useState(false);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedAtRef = useRef(0);

  useEffect(() => {
    init();
    getSetting('rest_duration', String(DEFAULT_REST)).then(v => setRestDuration(parseInt(v) || DEFAULT_REST));
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
          target_sets: te.default_sets || 3,
          default_reps: te.default_reps || 10,
        }));
      }
    }
    setSessionName(name);
    setExercises(exList);
    await createSession({ id: sessionId, name, templateId: templateId || null });
  }

  function handleStartTimer() {
    if (timerRunning) return;
    setTimerRunning(true);
    startTimeRef.current = Date.now() - pausedAtRef.current;
    timerRef.current = setInterval(() => setElapsed(Date.now() - startTimeRef.current), 1000);
  }

  function handlePauseTimer() {
    clearInterval(timerRef.current);
    pausedAtRef.current = elapsed;
    setTimerRunning(false);
  }

  function handleChangeTarget(exercise, delta) {
    const exId = exercise.exercise_id || exercise.id;
    setExercises(prev => prev.map(e => (e.exercise_id || e.id) === exId
      ? { ...e, target_sets: Math.max(1, (e.target_sets || 3) + delta) }
      : e));
  }

  async function handleAddSet(exercise, setNum, weight, reps) {
    if (!timerRunning) handleStartTimer();
    const setId = uid();
    const exId = exercise.exercise_id || exercise.id;
    await logSet({ id: setId, sessionId, exerciseId: exId, exerciseName: exercise.exercise_name || exercise.name, setNumber: setNum, weight, reps });
    setLoggedSets(prev => ({ ...prev, [exId]: [...(prev[exId] || []), { id: setId, set_number: setNum, weight, reps }] }));
    setLastSets(prev => ({ ...prev, [exId]: { weight, reps } }));
    setShowRest(true);
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
    await seedExercises(BUILTIN_EXERCISES);
    const exs = await getAllExercises();
    setAllExercises(exs);
    setPickingExercise(true);
  }

  function handleAddExercise(ex) {
    const alreadyAdded = exercises.some(e => (e.exercise_id || e.id) === ex.id);
    if (!alreadyAdded) {
      setExercises(prev => [...prev, { exercise_id: ex.id, exercise_name: ex.name, muscle: ex.muscle, equipment: ex.equipment, target_sets: 3, default_reps: 10 }]);
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
            <TouchableOpacity onPress={timerRunning ? handlePauseTimer : handleStartTimer} style={s.timerRow}>
              <Ionicons
                name={timerRunning ? 'pause-circle' : 'play-circle'}
                size={16}
                color={timerRunning ? colors.accent : colors.textMuted}
              />
              <Text style={[s.timer, { color: timerRunning ? colors.accent : colors.textMuted }]}>
                {formatTime(elapsed)}
              </Text>
            </TouchableOpacity>
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
              onTickSet={handleAddSet}
              onUntickSet={handleDeleteSet}
              onChangeTarget={handleChangeTarget}
              lastSet={lastSets[ex.exercise_id || ex.id]}
            />
          ))}

          <TouchableOpacity style={s.addExBtn} onPress={openExercisePicker}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={s.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Rest timer overlay */}
        <RestTimer visible={showRest} duration={restDuration} onDismiss={() => setShowRest(false)} />

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
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  timer: { fontSize: font.sm, fontWeight: '600' },
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
  struck: { textDecorationLine: 'line-through', color: colors.textMuted },
  inlineInput: { width: 64, backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: font.base, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  tickBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  targetRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  targetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  targetText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
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
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: '80%', padding: spacing.lg },
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
  // Rest timer
  restOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: spacing.md, paddingBottom: spacing.lg },
  restCard: { backgroundColor: colors.bg2, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  restLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5 },
  restTime: { fontSize: font.xxxl, fontWeight: '800' },
  restBarBg: { width: '100%', height: 4, backgroundColor: colors.bg3, borderRadius: 2, overflow: 'hidden' },
  restBarFill: { height: '100%', borderRadius: 2 },
  restBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.xs },
  restAdjBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  restAdjText: { fontSize: font.base, fontWeight: '600', color: colors.textDim },
  restToggleBtn: { backgroundColor: colors.accent, width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  restSkip: { paddingVertical: spacing.xs },
  restSkipText: { fontSize: font.sm, color: colors.textMuted },
});
