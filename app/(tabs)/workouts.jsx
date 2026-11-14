import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert, TextInput, Modal } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../../constants/theme';
import { getWorkouts, saveWorkout, deleteWorkout } from '../../utils/storage';
import { uid } from '../../utils/storage';

export default function WorkoutsScreen() {
  const [workouts, setWorkouts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');

  useFocusEffect(
    useCallback(() => {
      load();
    }, [])
  );

  async function load() {
    setWorkouts(await getWorkouts());
  }

  async function createWorkout() {
    if (!newName.trim()) return;
    const workout = { id: uid(), name: newName.trim(), exercises: [], createdAt: Date.now() };
    await saveWorkout(workout);
    setNewName('');
    setModalVisible(false);
    await load();
  }

  async function handleDelete(id, name) {
    Alert.alert('Delete Routine', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteWorkout(id); load(); } },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Routines</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={22} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {workouts.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="clipboard-outline" size={48} color={colors.textMuted} />
            <Text style={styles.emptyText}>No routines yet</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => setModalVisible(true)}>
              <Text style={styles.createBtnText}>Create Routine</Text>
            </TouchableOpacity>
          </View>
        ) : (
          workouts.map(w => (
            <TouchableOpacity
              key={w.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/active-workout', params: { workoutId: w.id } })}
              onLongPress={() => handleDelete(w.id, w.name)}
            >
              <View style={styles.cardLeft}>
                <Text style={styles.cardName}>{w.name}</Text>
                <Text style={styles.cardMeta}>
                  {w.exercises?.length || 0} exercises · Long press to delete
                </Text>
              </View>
              <Ionicons name="play-circle" size={30} color={colors.accent} />
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>New Routine</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Push Day, Leg Day..."
              placeholderTextColor={colors.textMuted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={createWorkout}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModalVisible(false); setNewName(''); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={createWorkout}>
                <Text style={styles.confirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  addBtn: { backgroundColor: colors.accent, width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.sm, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingTop: spacing.xl * 2, gap: spacing.md },
  emptyText: { fontSize: font.lg, color: colors.textDim },
  createBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm + 2, borderRadius: radius.md },
  createBtnText: { color: colors.white, fontWeight: '600' },
  card: {
    backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  cardLeft: { flex: 1 },
  cardName: { fontSize: font.md, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modal: { backgroundColor: colors.bg2, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, width: '85%', gap: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  input: { backgroundColor: colors.bg3, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text, fontSize: font.base },
  modalBtns: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  cancelBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border },
  cancelText: { color: colors.textDim },
  confirmBtn: { backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  confirmText: { color: colors.white, fontWeight: '600' },
});
