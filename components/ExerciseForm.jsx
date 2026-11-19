import { useState, useEffect } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Switch, Alert, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, font, muscleColor } from '../constants/theme';
import { MUSCLES, EQUIPMENT, categoryForMuscle } from '../constants/exercises';
import { addCustomExercise, updateCustomExercise, exerciseNameExists, uid } from '../utils/database';

const blank = () => ({ name: '', muscle: MUSCLES[0], equipment: EQUIPMENT[0], notes: '', isUnilateral: false });

// Create or edit a custom exercise. `exercise` (a DB row) switches it to edit mode. onSaved(row) receives the saved exercise.
export default function ExerciseForm({ visible, exercise, onClose, onSaved }) {
  const editing = !!exercise;
  const [form, setForm] = useState(blank());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSaving(false);
    setForm(exercise ? {
      name: exercise.name,
      muscle: exercise.muscle,
      equipment: exercise.equipment || EQUIPMENT[0],
      notes: exercise.notes || '',
      isUnilateral: !!exercise.is_unilateral,
    } : blank());
  }, [visible, exercise]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function save() {
    const name = form.name.trim();
    if (!name) { Alert.alert('Name required', 'Give the exercise a name.'); return; }
    if (await exerciseNameExists(name, exercise ? exercise.id : null)) {
      Alert.alert('Already exists', `There is already an exercise called "${name}".`);
      return;
    }
    setSaving(true);
    try {
      const payload = {
        id: exercise ? exercise.id : uid(),
        name,
        muscle: form.muscle,
        category: categoryForMuscle(form.muscle),
        equipment: form.equipment,
        notes: form.notes.trim(),
        isUnilateral: form.isUnilateral,
      };
      if (editing) await updateCustomExercise(payload);
      else await addCustomExercise(payload);
      onSaved && onSaved(payload);
    } catch (e) {
      Alert.alert('Could not save', e && e.message ? e.message : 'Something went wrong.');
      setSaving(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.header}>
            <Text style={s.title}>{editing ? 'Edit Exercise' : 'New Exercise'}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={s.label}>NAME</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Single Arm Cable Fly"
              placeholderTextColor={colors.textMuted}
              value={form.name}
              onChangeText={v => set('name', v)}
              maxLength={60}
            />

            <Text style={s.label}>MUSCLE</Text>
            <View style={s.chips}>
              {MUSCLES.map(m => (
                <TouchableOpacity
                  key={m}
                  style={[s.chip, form.muscle === m && { backgroundColor: muscleColor(m), borderColor: 'transparent' }]}
                  onPress={() => set('muscle', m)}
                >
                  <Text style={[s.chipText, form.muscle === m && { color: colors.white }]}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.label}>EQUIPMENT</Text>
            <View style={s.chips}>
              {EQUIPMENT.map(eq => (
                <TouchableOpacity
                  key={eq}
                  style={[s.chip, form.equipment === eq && { backgroundColor: colors.accent, borderColor: 'transparent' }]}
                  onPress={() => set('equipment', eq)}
                >
                  <Text style={[s.chipText, form.equipment === eq && { color: colors.white }]}>{eq}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.switchTitle}>One side at a time</Text>
                <Text style={s.switchSub}>Track left and right separately (e.g. single arm or single leg)</Text>
              </View>
              <Switch
                value={form.isUnilateral}
                onValueChange={v => set('isUnilateral', v)}
                trackColor={{ false: colors.bg3, true: colors.accent + '99' }}
                thumbColor={form.isUnilateral ? colors.accent : colors.textDim}
              />
            </View>

            <Text style={s.label}>DESCRIPTION (OPTIONAL)</Text>
            <TextInput
              style={[s.input, s.notes]}
              placeholder="How to perform it, cues, tips..."
              placeholderTextColor={colors.textMuted}
              value={form.notes}
              onChangeText={v => set('notes', v)}
              multiline
              textAlignVertical="top"
            />
          </ScrollView>

          <TouchableOpacity style={[s.save, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            <Text style={s.saveText}>{editing ? 'Save Changes' : 'Add Exercise'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { height: '88%', backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, paddingBottom: spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  title: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textDim, letterSpacing: 0.8, marginTop: spacing.md, marginBottom: spacing.sm },
  input: { backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: spacing.md, fontSize: font.base },
  notes: { minHeight: 96 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.bg2 },
  chipText: { fontSize: font.sm, fontWeight: '600', color: colors.textDim },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg, backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  switchTitle: { fontSize: font.base, fontWeight: '600', color: colors.text },
  switchSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  save: { backgroundColor: colors.accent, borderRadius: radius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.md },
  saveText: { color: colors.white, fontWeight: '700', fontSize: font.base },
});
