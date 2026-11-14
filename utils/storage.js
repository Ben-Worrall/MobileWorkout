import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  WORKOUTS: 'workouts',
  HISTORY: 'history',
  CUSTOM_EXERCISES: 'custom_exercises',
};

export async function getWorkouts() {
  const raw = await AsyncStorage.getItem(KEYS.WORKOUTS);
  return raw ? JSON.parse(raw) : [];
}

export async function saveWorkout(workout) {
  const workouts = await getWorkouts();
  const existing = workouts.findIndex(w => w.id === workout.id);
  if (existing >= 0) {
    workouts[existing] = workout;
  } else {
    workouts.push(workout);
  }
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
}

export async function deleteWorkout(id) {
  const workouts = await getWorkouts();
  await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts.filter(w => w.id !== id)));
}

export async function getHistory() {
  const raw = await AsyncStorage.getItem(KEYS.HISTORY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveSession(session) {
  const history = await getHistory();
  history.unshift(session);
  await AsyncStorage.setItem(KEYS.HISTORY, JSON.stringify(history.slice(0, 200)));
}

export async function getCustomExercises() {
  const raw = await AsyncStorage.getItem(KEYS.CUSTOM_EXERCISES);
  return raw ? JSON.parse(raw) : [];
}

export async function saveCustomExercise(exercise) {
  const exercises = await getCustomExercises();
  exercises.push(exercise);
  await AsyncStorage.setItem(KEYS.CUSTOM_EXERCISES, JSON.stringify(exercises));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
