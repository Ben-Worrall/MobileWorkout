import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../../constants/theme';
import { getScheduledWorkouts, getTemplates, scheduleWorkout, deleteScheduled, uid } from '../../utils/database';
import { startOrResumeWorkout } from '../../utils/activeWorkout';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarScreen() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [scheduled, setScheduled] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [pickingTemplate, setPickingTemplate] = useState(false);

  useFocusEffect(useCallback(() => { load(); }, [year, month]));

  async function load() {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const [sched, tmpl] = await Promise.all([
      getScheduledWorkouts(start, end),
      getTemplates(),
    ]);
    setScheduled(sched);
    setTemplates(tmpl);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function getDaysInMonth(y, m) {
    return new Date(y, m + 1, 0).getDate();
  }
  function getFirstDayOfMonth(y, m) {
    return new Date(y, m, 1).getDay();
  }

  function dateStr(d) {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  function scheduledForDay(d) {
    return scheduled.filter(s => s.date === dateStr(d));
  }

  function isToday(d) {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === d;
  }

  function handleDayPress(d) {
    setSelectedDate(dateStr(d));
  }

  async function addWorkoutToDay(templateId) {
    const tmpl = templates.find(t => t.id === templateId);
    await scheduleWorkout({ id: uid(), templateId, date: selectedDate, notes: null });
    setPickingTemplate(false);
    load();
  }

  async function handleDeleteScheduled(id) {
    Alert.alert('Remove', 'Remove this scheduled workout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteScheduled(id); load(); } },
    ]);
  }

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const cells = Array(firstDay).fill(null).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const dayScheduled = selectedDate ? scheduled.filter(s => s.date === selectedDate) : [];

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <Text style={s.title}>Schedule</Text>
      </View>

      {/* Month navigator */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={s.navBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.textDim} />
        </TouchableOpacity>
        <Text style={s.monthLabel}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={s.navBtn}>
          <Ionicons name="chevron-forward" size={20} color={colors.textDim} />
        </TouchableOpacity>
      </View>

      {/* Day headers */}
      <View style={s.dayHeaders}>
        {DAYS.map(d => <Text key={d} style={s.dayHeader}>{d}</Text>)}
      </View>

      {/* Calendar grid */}
      <View style={s.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={`empty-${i}`} style={s.cell} />;
          const dots = scheduledForDay(d);
          const today = isToday(d);
          const selected = dateStr(d) === selectedDate;
          return (
            <TouchableOpacity
              key={d}
              style={[s.cell, today && s.todayCell, selected && s.selectedCell]}
              onPress={() => handleDayPress(d)}
            >
              <Text style={[s.cellText, today && s.todayText, selected && s.selectedText]}>{d}</Text>
              <View style={s.dotRow}>
                {dots.slice(0, 3).map((sc, j) => (
                  <View key={j} style={[s.dot, { backgroundColor: sc.color || colors.accent, opacity: sc.completed ? 0.4 : 1 }]} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected day panel */}
      <ScrollView style={s.panel} contentContainerStyle={s.panelContent} showsVerticalScrollIndicator={false}>
        {selectedDate ? (
          <>
            <View style={s.panelHeader}>
              <Text style={s.panelTitle}>
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </Text>
              <TouchableOpacity style={s.addBtn} onPress={() => setPickingTemplate(true)}>
                <Ionicons name="add" size={18} color={colors.white} />
                <Text style={s.addBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
            {dayScheduled.length === 0 && (
              <Text style={s.panelEmpty}>No workouts scheduled. Tap Add to plan one.</Text>
            )}
            {dayScheduled.map(sc => (
              <View key={sc.id} style={[s.schedCard, { borderLeftColor: sc.color || colors.accent }]}>
                <View style={s.schedInfo}>
                  <Text style={s.schedName}>{sc.template_name || 'Workout'}</Text>
                  {sc.completed ? <Text style={s.completedTag}>Completed</Text> : null}
                </View>
                <View style={s.schedActions}>
                  {!sc.completed && (
                    <TouchableOpacity
                      style={s.schedStart}
                      onPress={() => startOrResumeWorkout(router, { templateId: sc.template_id, scheduledId: sc.id })}
                    >
                      <Ionicons name="play" size={14} color={colors.white} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity onPress={() => handleDeleteScheduled(sc.id)} style={s.schedDel}>
                    <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        ) : (
          <Text style={s.panelEmpty}>Tap a day to view or plan workouts</Text>
        )}
      </ScrollView>

      {/* Template picker modal */}
      <Modal visible={pickingTemplate} transparent animationType="slide" onRequestClose={() => setPickingTemplate(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Choose Routine</Text>
              <TouchableOpacity onPress={() => setPickingTemplate(false)}>
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {templates.length === 0 && (
                <Text style={s.modalEmpty}>No routines yet. Create one in Library first.</Text>
              )}
              {templates.map(t => (
                <TouchableOpacity key={t.id} style={[s.tmplItem, { borderLeftColor: t.color }]} onPress={() => addWorkoutToDay(t.id)}>
                  <Text style={s.tmplName}>{t.name}</Text>
                  <Text style={s.tmplMeta}>{t.exercises?.length || 0} exercises</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  title: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  navBtn: { padding: spacing.sm },
  monthLabel: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  dayHeaders: { flexDirection: 'row', paddingHorizontal: spacing.md, marginBottom: 4 },
  dayHeader: { flex: 1, textAlign: 'center', fontSize: font.sm, fontWeight: '600', color: colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 0.85,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.sm, padding: 2,
  },
  todayCell: { backgroundColor: colors.accentSoft },
  selectedCell: { backgroundColor: colors.accent + '25', borderWidth: 1, borderColor: colors.accent },
  cellText: { fontSize: font.sm, fontWeight: '500', color: colors.textDim },
  todayText: { color: colors.accent, fontWeight: '700' },
  selectedText: { color: colors.accent, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  panel: { flex: 1, borderTopWidth: 1, borderTopColor: colors.border },
  panelContent: { padding: spacing.lg, paddingBottom: 80 },
  panelHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  panelTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent, paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2, borderRadius: radius.full },
  addBtnText: { color: colors.white, fontSize: font.sm, fontWeight: '700' },
  panelEmpty: { fontSize: font.base, color: colors.textMuted, textAlign: 'center', paddingTop: spacing.lg },
  schedCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: spacing.md, marginBottom: spacing.sm,
  },
  schedInfo: { flex: 1 },
  schedName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  completedTag: { fontSize: font.sm, color: colors.success, marginTop: 2 },
  schedActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  schedStart: { backgroundColor: colors.accent, width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  schedDel: { padding: 4 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modal: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: '60%', padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  modalTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  modalEmpty: { color: colors.textMuted, textAlign: 'center', padding: spacing.lg },
  tmplItem: { backgroundColor: colors.bgCard, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, padding: spacing.md, marginBottom: spacing.sm },
  tmplName: { fontSize: font.base, fontWeight: '600', color: colors.text },
  tmplMeta: { fontSize: font.sm, color: colors.textMuted, marginTop: 2 },
});
