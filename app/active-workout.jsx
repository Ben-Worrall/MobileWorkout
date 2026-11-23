import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal,
  Alert, KeyboardAvoidingView, Platform, AppState, ActivityIndicator,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { BUILTIN_EXERCISES } from '../constants/exercises';
import {
  getTemplate, getAllExercises, getExercise, getSession, createSession, seedExercises,
  logSet, deleteSet, finishSession, markScheduledComplete, uid, getSetting,
} from '../utils/database';
import {
  saveActiveWorkout, clearActiveWorkout, loadActiveWorkout, discardActiveWorkout,
} from '../utils/activeWorkout';
import {
  configureNotifications, ensureNotificationPermission, scheduleRestEnd, cancelRestNotification,
} from '../utils/notifications';
import * as T from '../utils/timers';
import ExerciseBlock, { isSetComplete, completedSetCount } from '../components/workout/ExerciseBlock';
import ExercisePicker from '../components/workout/ExercisePicker';
import RirPicker from '../components/workout/RirPicker';
import ExerciseForm from '../components/ExerciseForm';
import { RestChip, RestSheet } from '../components/workout/RestTimer';
import WorkoutClock from '../components/workout/WorkoutClock';

const DEFAULT_REST = 90;
const exId = e => e.exercise_id || e.id;

export default function ActiveWorkout() {
  const { templateId, scheduledId: scheduledParam, resume } = useLocalSearchParams();

  const [ready, setReady] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [scheduledId, setScheduledId] = useState(scheduledParam || null);
  const [sessionName, setSessionName] = useState('Quick Workout');
  const [exercises, setExercises] = useState([]);
  const [loggedSets, setLoggedSets] = useState({});
  const [timer, setTimer] = useState(T.newWorkoutTimer());
  const [rest, setRest] = useState(null);
  const [showRestSheet, setShowRestSheet] = useState(false);
  const [restDuration, setRestDuration] = useState(DEFAULT_REST);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [allExercises, setAllExercises] = useState([]);
  const [rirTarget, setRirTarget] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const lastRestExercise = useRef('');

  // ── startup: new workout or resume ───────────────────────────────
  useEffect(() => {
    configureNotifications().catch(() => {});
    getSetting('rest_duration', String(DEFAULT_REST)).then(v => setRestDuration(parseInt(v, 10) || DEFAULT_REST));
    init();
  }, []);

  async function init() {
    await seedExercises(BUILTIN_EXERCISES);
    if (resume === '1') {
      const saved = await loadActiveWorkout();
      if (saved) { await restore(saved); return; }
    }
    let name = 'Quick Workout';
    let list = [];
    if (templateId) {
      const tmpl = await getTemplate(templateId);
      if (tmpl) {
        name = tmpl.name;
        list = tmpl.exercises.map(te => ({
          exercise_id: te.exercise_id,
          exercise_name: te.exercise_name,
          muscle: te.muscle,
          equipment: te.equipment,
          target_sets: te.default_sets || 3,
          default_reps: te.default_reps || 10,
          unilateral: !!te.is_unilateral,
        }));
      }
    }
    const id = uid();
    await createSession({ id, name, templateId: templateId || null });
    setSessionId(id);
    setSessionName(name);
    setExercises(list);
    setReady(true);
  }

  async function restore(saved) {
    const session = await getSession(saved.sessionId);
    const byEx = {};
    for (const st of (session && session.sets) || []) {
      (byEx[st.exercise_id] = byEx[st.exercise_id] || []).push({
        id: st.id, exercise_name: st.exercise_name, set_number: st.set_number, weight: st.weight, reps: st.reps, rir: st.rir, side: st.side,
      });
    }
    const list = [...(saved.exercises || [])];
    for (const id of Object.keys(byEx)) {
      if (list.some(e => exId(e) === id)) continue;
      const info = await getExercise(id);
      const sets = byEx[id];
      list.push({
        exercise_id: id,
        exercise_name: info ? info.name : sets[0].exercise_name || 'Exercise',
        muscle: info ? info.muscle : null,
        equipment: info ? info.equipment : null,
        target_sets: Math.max(3, ...sets.map(x => x.set_number)),
        default_reps: 10,
        unilateral: sets.some(x => x.side),
      });
    }
    setSessionId(saved.sessionId);
    setScheduledId(saved.scheduledId || null);
    setSessionName(saved.name || 'Workout');
    setExercises(list);
    setLoggedSets(byEx);
    setTimer(saved.timer || T.newWorkoutTimer());
    if (saved.rest && (saved.rest.pausedRemaining != null || saved.rest.endAt > Date.now())) {
      setRest(saved.rest);
      if (saved.rest.pausedRemaining == null) scheduleRestEnd(saved.rest.endAt, '');
    }
    setReady(true);
  }

  // ── persistence: survive the app being closed or killed ──────────
  useEffect(() => {
    if (!ready || !sessionId) return;
    saveActiveWorkout({ sessionId, name: sessionName, templateId: templateId || null, scheduledId, exercises, timer, rest });
  }, [ready, sessionId, sessionName, scheduledId, exercises, timer, rest]);

  // Ends the rest when its time is up. (A scheduled notification covers the case where the app is in the background.)
  useEffect(() => {
    if (!rest || !T.restIsRunning(rest)) return undefined;
    const finish = () => {
      setRest(null);
      setShowRestSheet(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    };
    const ms = rest.endAt - Date.now();
    if (ms <= 0) { finish(); return undefined; }
    const timeout = setTimeout(finish, ms);
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active' && Date.now() >= rest.endAt) { clearTimeout(timeout); finish(); }
    });
    return () => { clearTimeout(timeout); sub.remove(); };
  }, [rest]);

  // ── timers ───────────────────────────────────────────────────────
  function toggleWorkoutTimer() {
    setTimer(t => (t.running ? T.pauseWorkoutTimer(t) : T.startWorkoutTimer(t)));
  }

  async function beginRest(exerciseName) {
    lastRestExercise.current = exerciseName || '';
    const next = T.startRest(restDuration);
    setRest(next);
    if (await ensureNotificationPermission()) scheduleRestEnd(next.endAt, exerciseName);
  }

  function adjustRest(delta) {
    const next = T.adjustRest(rest, delta);
    setRest(next);
    if (next && T.restIsRunning(next)) scheduleRestEnd(next.endAt, lastRestExercise.current);
  }

  function toggleRest() {
    if (!rest) return;
    if (T.restIsRunning(rest)) {
      setRest(T.pauseRest(rest));
      cancelRestNotification();
    } else {
      const next = T.resumeRest(rest);
      setRest(next);
      scheduleRestEnd(next.endAt, lastRestExercise.current);
    }
  }

  function skipRest() {
    setRest(null);
    setShowRestSheet(false);
    cancelRestNotification();
  }

  // ── sets ─────────────────────────────────────────────────────────
  async function handleTick(exercise, setNumber, side, weight, reps, rir) {
    const id = exId(exercise);
    if (!timer.running) setTimer(t => T.startWorkoutTimer(t));
    const setId = uid();
    await logSet({
      id: setId, sessionId, exerciseId: id, exerciseName: exercise.exercise_name || exercise.name,
      setNumber, weight, reps, rir: rir == null ? null : rir, side: side || null,
    });
    const entry = { id: setId, set_number: setNumber, weight, reps, rir: rir == null ? null : rir, side: side || null };
    const list = [...(loggedSets[id] || []), entry];
    setLoggedSets(prev => ({ ...prev, [id]: [...(prev[id] || []), entry] }));
    // A left/right set only finishes (and starts the rest) once both sides are logged.
    if (isSetComplete(list, setNumber, !!exercise.unilateral)) beginRest(exercise.exercise_name || exercise.name);
  }

  async function handleUntick(exercise, setObj) {
    if (!setObj) return;
    const id = exId(exercise);
    await deleteSet(setObj.id);
    setLoggedSets(prev => ({ ...prev, [id]: (prev[id] || []).filter(x => x.id !== setObj.id) }));
  }

  function handleChangeTarget(exercise, delta) {
    const id = exId(exercise);
    setExercises(prev => prev.map(e => (exId(e) === id ? { ...e, target_sets: Math.max(1, (e.target_sets || 3) + delta) } : e)));
  }

  function handleToggleUnilateral(exercise) {
    const id = exId(exercise);
    setExercises(prev => prev.map(e => (exId(e) === id ? { ...e, unilateral: !e.unilateral } : e)));
  }

  function handleRemoveExercise(exercise) {
    const id = exId(exercise);
    const name = exercise.exercise_name || exercise.name;
    const logged = loggedSets[id] || [];
    async function doRemove() {
      for (const st of logged) await deleteSet(st.id);
      setLoggedSets(prev => { const next = { ...prev }; delete next[id]; return next; });
      setExercises(prev => prev.filter(e => exId(e) !== id));
    }
    if (logged.length === 0) { doRemove(); return; }
    Alert.alert('Remove exercise?', `${name} and its ${logged.length} logged set${logged.length === 1 ? '' : 's'} will be removed from this workout.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: doRemove },
    ]);
  }

  async function openExercisePicker() {
    await seedExercises(BUILTIN_EXERCISES);
    setAllExercises(await getAllExercises());
    setPickingExercise(true);
  }

  function handleAddExercise(ex) {
    if (!exercises.some(e => exId(e) === ex.id)) {
      setExercises(prev => [...prev, {
        exercise_id: ex.id, exercise_name: ex.name, muscle: ex.muscle, equipment: ex.equipment,
        target_sets: 3, default_reps: 10, unilateral: !!ex.is_unilateral,
      }]);
    }
    setPickingExercise(false);
  }

  // ── leaving / finishing ──────────────────────────────────────────
  const totalRows = Object.values(loggedSets).reduce((a, b) => a + b.length, 0);

  // Leaving without finishing: pause the clock (so time away is not counted) and keep the workout for later.
  async function keepForLater() {
    const paused = T.pauseWorkoutTimer(timer);
    await saveActiveWorkout({ sessionId, name: sessionName, templateId: templateId || null, scheduledId, exercises, timer: paused, rest });
    router.back();
  }

  function handleClose() {
    Alert.alert('Leave workout?', 'You can come back to it later from the Home screen, or discard it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep for later', onPress: keepForLater },
      { text: 'Discard', style: 'destructive', onPress: discard },
    ]);
  }

  async function discard() {
    await discardActiveWorkout(sessionId);
    router.back();
  }

  function handleFinish() {
    if (totalRows === 0) {
      Alert.alert('No sets logged', 'Log at least one set or discard this workout.', [
        { text: 'Discard', style: 'destructive', onPress: discard },
        { text: 'Keep going', style: 'cancel' },
      ]);
      return;
    }
    setTimer(t => T.pauseWorkoutTimer(t));
    setFinishing(true);
  }

  async function confirmFinish() {
    if (saving) return;
    setSaving(true);
    await finishSession(sessionId, notes);
    if (scheduledId) await markScheduledComplete(scheduledId, sessionId);
    await cancelRestNotification();
    await clearActiveWorkout();
    router.back();
  }

  // ── derived values ───────────────────────────────────────────────
  const elapsed = T.workoutElapsed(timer);
  const setsDone = exercises.reduce(
    (a, e) => a + completedSetCount(loggedSets[exId(e)] || [], e.target_sets || 3, !!e.unilateral), 0
  );
  const muscles = [...new Set(exercises.map(e => e.muscle).filter(Boolean))];
  const addedIds = new Set(exercises.map(exId));

  if (!ready) {
    return (
      <SafeAreaView style={[s.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <TouchableOpacity onPress={handleClose} style={s.headerSide} accessibilityLabel="Leave workout">
            <Ionicons name="close" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle} numberOfLines={1}>{sessionName}</Text>
            <View style={s.timerRow}>
              <WorkoutClock timer={timer} onToggle={toggleWorkoutTimer} />
              <RestChip rest={rest} onPress={() => setShowRestSheet(true)} />
            </View>
          </View>
          <TouchableOpacity onPress={handleFinish} style={[s.headerSide, { alignItems: 'flex-end' }]}>
            <Text style={s.finishText}>Finish</Text>
          </TouchableOpacity>
        </View>

        <View style={s.statsBar}>
          <View style={s.statItem}>
            <Text style={s.statVal}>{exercises.length}</Text>
            <Text style={s.statLbl}>Exercises</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statItem}>
            <Text style={s.statVal}>{setsDone}</Text>
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
              key={exId(ex)}
              exercise={ex}
              sets={loggedSets[exId(ex)] || []}
              onTick={handleTick}
              onUntick={setObj => handleUntick(ex, setObj)}
              onChangeTarget={handleChangeTarget}
              onRemove={handleRemoveExercise}
              onToggleUnilateral={handleToggleUnilateral}
              onOpenRir={setRirTarget}
            />
          ))}

          <TouchableOpacity style={s.addExBtn} onPress={openExercisePicker}>
            <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
            <Text style={s.addExText}>Add Exercise</Text>
          </TouchableOpacity>
        </ScrollView>

        <RestSheet
          visible={showRestSheet}
          rest={rest}
          onClose={() => setShowRestSheet(false)}
          onAdjust={adjustRest}
          onToggle={toggleRest}
          onSkip={skipRest}
        />

        <RirPicker
          visible={!!rirTarget}
          value={rirTarget ? rirTarget.value : null}
          title={rirTarget ? rirTarget.title : ''}
          onClose={() => setRirTarget(null)}
          onSelect={v => {
            if (rirTarget) {
              rirTarget.apply(v);
              setRirTarget({ ...rirTarget, value: v });
            }
          }}
        />

        <ExercisePicker
          visible={pickingExercise}
          exercises={allExercises}
          addedIds={addedIds}
          onPick={handleAddExercise}
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
            if (row) handleAddExercise(row);
          }}
        />

        <Modal visible={finishing} transparent animationType="fade" onRequestClose={() => setFinishing(false)}>
          <View style={[s.overlay, { justifyContent: 'center', padding: spacing.lg }]}>
            <View style={[s.modal, { borderRadius: radius.xl }]}>
              <Text style={[s.modalTitle, { textAlign: 'center', marginBottom: spacing.md }]}>Finish Workout</Text>
              <View style={s.summaryStats}>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{T.formatClock(elapsed)}</Text>
                  <Text style={s.summaryLbl}>Duration</Text>
                </View>
                <View style={s.summaryItem}>
                  <Text style={s.summaryVal}>{setsDone}</Text>
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
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 3 },
  finishText: { color: colors.accent, fontWeight: '700', fontSize: font.base },
  statsBar: { flexDirection: 'row', backgroundColor: colors.bg2, borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: spacing.sm },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },
  statVal: { fontSize: font.md, fontWeight: '700', color: colors.text },
  statLbl: { fontSize: font.xs, color: colors.textMuted },
  musclePip: { width: 8, height: 8, borderRadius: 4 },
  scroll: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: 60, gap: spacing.md },
  addExBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent + '44', borderStyle: 'dashed', padding: spacing.md },
  addExText: { color: colors.accent, fontWeight: '600', fontSize: font.base },
  emptyState: { alignItems: 'center', paddingTop: spacing.xxl, gap: spacing.md },
  emptyTitle: { fontSize: font.xl, fontWeight: '700', color: colors.textDim },
  emptySub: { fontSize: font.base, color: colors.textMuted, textAlign: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, padding: spacing.lg },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
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
