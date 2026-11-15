import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { getSession, updateSet, updateSession, deleteSet, logSet, uid } from '../utils/database';

function formatDuration(ms) {
  if (!ms) return '';
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function SetEditRow({ set, exerciseId, onUpdate, onDelete }) {
  const [weight, setWeight] = useState(set.weight > 0 ? String(set.weight) : '');
  const [reps, setReps] = useState(String(set.reps));
  const [dirty, setDirty] = useState(false);

  function handleSave() {
    const w = parseFloat(weight) || 0;
    const r = parseInt(reps) || 0;
    if (!r) { Alert.alert('Enter reps'); return; }
    onUpdate(set.id, w, r);
    setDirty(false);
  }

  return (
    <View style={s.setRow}>
      <View style={s.setNumBadge}>
        <Text style={s.setNumText}>{set.set_number}</Text>
      </View>
      <View style={s.setInputs}>
        <TextInput
          style={s.setInput}
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={v => { setWeight(v); setDirty(true); }}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          selectTextOnFocus
        />
        <Text style={s.setX}>×</Text>
        <TextInput
          style={s.setInput}
          keyboardType="number-pad"
          value={reps}
          onChangeText={v => { setReps(v); setDirty(true); }}
          placeholder="0"
          placeholderTextColor={colors.textMuted}
          selectTextOnFocus
        />
      </View>
      {dirty ? (
        <TouchableOpacity style={s.saveSetBtn} onPress={handleSave}>
          <Ionicons name="checkmark" size={16} color={colors.white} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={s.deleteSetBtn} onPress={() => onDelete(set.id)}>
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function EditSession() {
  const { sessionId } = useLocalSearchParams();
  const [session, setSession] = useState(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState([]); // [{ name, muscle, sets: [] }]
  const [nameDirty, setNameDirty] = useState(false);

  useEffect(() => { load(); }, [sessionId]);

  async function load() {
    const s = await getSession(sessionId);
    if (!s) return;
    setSession(s);
    setName(s.name);
    setNotes(s.notes || '');

    // Group sets by exercise
    const map = {};
    for (const set of s.sets) {
      if (!map[set.exercise_id]) {
        map[set.exercise_id] = { exercise_id: set.exercise_id, name: set.exercise_name, sets: [] };
      }
      map[set.exercise_id].sets.push(set);
    }
    setExercises(Object.values(map));
  }

  async function handleUpdateSet(id, weight, reps) {
    await updateSet(id, weight, reps);
    setExercises(prev => prev.map(ex => ({
      ...ex,
      sets: ex.sets.map(s => s.id === id ? { ...s, weight, reps } : s),
    })));
  }

  async function handleDeleteSet(id) {
    Alert.alert('Delete set?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await deleteSet(id);
          setExercises(prev => prev.map(ex => ({
            ...ex,
            sets: ex.sets.filter(s => s.id !== id),
          })).filter(ex => ex.sets.length > 0));
        }
      },
    ]);
  }

  async function handleAddSet(exercise) {
    const lastSet = exercise.sets[exercise.sets.length - 1];
    const setNum = exercise.sets.length + 1;
    const newSet = {
      id: uid(),
      session_id: sessionId,
      exercise_id: exercise.exercise_id,
      exercise_name: exercise.name,
      set_number: setNum,
      weight: lastSet?.weight || 0,
      reps: lastSet?.reps || 10,
      completed: 1,
    };
    await logSet({ id: newSet.id, sessionId, exerciseId: exercise.exercise_id, exerciseName: exercise.name, setNumber: setNum, weight: newSet.weight, reps: newSet.reps });
    setExercises(prev => prev.map(ex =>
      ex.exercise_id === exercise.exercise_id
        ? { ...ex, sets: [...ex.sets, newSet] }
        : ex
    ));
  }

  async function handleSaveMeta() {
    if (!name.trim()) { Alert.alert('Name required'); return; }
    await updateSession(sessionId, name.trim(), notes.trim());
    setNameDirty(false);
    Alert.alert('Saved');
  }

  if (!session) return null;

  const duration = session.finished_at ? session.finished_at - session.started_at : null;

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.headerSide}>
            <Ionicons name="arrow-back" size={22} color={colors.textDim} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Edit Workout</Text>
          <TouchableOpacity onPress={handleSaveMeta} style={[s.headerSide, { alignItems: 'flex-end' }]}>
            <Text style={[s.saveText, !nameDirty && { opacity: 0.4 }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* Meta */}
          <View style={s.metaCard}>
            <TextInput
              style={s.nameInput}
              value={name}
              onChangeText={v => { setName(v); setNameDirty(true); }}
              placeholder="Workout name"
              placeholderTextColor={colors.textMuted}
            />
            {duration ? (
              <Text style={s.metaDetail}>
                {new Date(session.started_at).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
                {'  ·  '}{formatDuration(duration)}
              </Text>
            ) : null}
            <TextInput
              style={s.notesInput}
              value={notes}
              onChangeText={v => { setNotes(v); setNameDirty(true); }}
              placeholder="Notes..."
              placeholderTextColor={colors.textMuted}
              multiline
            />
          </View>

          {/* Exercises */}
          {exercises.map(ex => (
            <View key={ex.exercise_id} style={s.exBlock}>
              <Text style={s.exName}>{ex.name}</Text>
              <View style={s.setHeader}>
                <Text style={[s.setHeaderText, { flex: 0, width: 32 }]}>#</Text>
                <Text style={[s.setHeaderText, { flex: 1, textAlign: 'center' }]}>kg</Text>
                <Text style={[s.setHeaderText, { flex: 1, textAlign: 'center' }]}>reps</Text>
                <View style={{ width: 36 }} />
              </View>
              {ex.sets.map(set => (
                <SetEditRow
                  key={set.id}
                  set={set}
                  exerciseId={ex.exercise_id}
                  onUpdate={handleUpdateSet}
                  onDelete={handleDeleteSet}
                />
              ))}
              <TouchableOpacity style={s.addSetRow} onPress={() => handleAddSet(ex)}>
                <Ionicons name="add" size={16} color={colors.accent} />
                <Text style={s.addSetText}>Add set</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerSide: { width: 60 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.md, fontWeight: '700', color: colors.text },
  saveText: { color: colors.accent, fontWeight: '700', fontSize: font.base },
  scroll: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: 100 },
  metaCard: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  nameInput: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  metaDetail: { fontSize: font.sm, color: colors.textMuted },
  notesInput: { fontSize: font.base, color: colors.textDim, minHeight: 48 },
  exBlock: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  exName: { fontSize: font.base, fontWeight: '700', color: colors.text, padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  setHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: spacing.sm },
  setHeaderText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderDim, gap: spacing.sm },
  setNumBadge: { width: 24, height: 24, borderRadius: radius.sm, backgroundColor: colors.bg3, alignItems: 'center', justifyContent: 'center' },
  setNumText: { fontSize: font.xs, fontWeight: '700', color: colors.textDim },
  setInputs: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setInput: { flex: 1, backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, color: colors.text, fontSize: font.base, fontWeight: '600', textAlign: 'center', paddingVertical: 6 },
  setX: { fontSize: font.sm, color: colors.textMuted },
  saveSetBtn: { width: 32, height: 32, borderRadius: radius.sm, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  deleteSetBtn: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  addSetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDim },
  addSetText: { fontSize: font.sm, color: colors.accent, fontWeight: '600' },
});
