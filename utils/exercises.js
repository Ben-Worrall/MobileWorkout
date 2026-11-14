export const EXERCISES = [
  // Chest
  { id: 'bench-press', name: 'Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'incline-bench', name: 'Incline Bench Press', muscle: 'Chest', equipment: 'Barbell' },
  { id: 'dumbbell-fly', name: 'Dumbbell Fly', muscle: 'Chest', equipment: 'Dumbbell' },
  { id: 'push-up', name: 'Push Up', muscle: 'Chest', equipment: 'Bodyweight' },
  { id: 'cable-crossover', name: 'Cable Crossover', muscle: 'Chest', equipment: 'Cable' },

  // Back
  { id: 'deadlift', name: 'Deadlift', muscle: 'Back', equipment: 'Barbell' },
  { id: 'pull-up', name: 'Pull Up', muscle: 'Back', equipment: 'Bodyweight' },
  { id: 'lat-pulldown', name: 'Lat Pulldown', muscle: 'Back', equipment: 'Cable' },
  { id: 'barbell-row', name: 'Barbell Row', muscle: 'Back', equipment: 'Barbell' },
  { id: 'seated-cable-row', name: 'Seated Cable Row', muscle: 'Back', equipment: 'Cable' },
  { id: 'dumbbell-row', name: 'Dumbbell Row', muscle: 'Back', equipment: 'Dumbbell' },

  // Shoulders
  { id: 'ohp', name: 'Overhead Press', muscle: 'Shoulders', equipment: 'Barbell' },
  { id: 'lateral-raise', name: 'Lateral Raise', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'front-raise', name: 'Front Raise', muscle: 'Shoulders', equipment: 'Dumbbell' },
  { id: 'face-pull', name: 'Face Pull', muscle: 'Shoulders', equipment: 'Cable' },

  // Arms
  { id: 'barbell-curl', name: 'Barbell Curl', muscle: 'Biceps', equipment: 'Barbell' },
  { id: 'dumbbell-curl', name: 'Dumbbell Curl', muscle: 'Biceps', equipment: 'Dumbbell' },
  { id: 'hammer-curl', name: 'Hammer Curl', muscle: 'Biceps', equipment: 'Dumbbell' },
  { id: 'tricep-pushdown', name: 'Tricep Pushdown', muscle: 'Triceps', equipment: 'Cable' },
  { id: 'skull-crusher', name: 'Skull Crusher', muscle: 'Triceps', equipment: 'Barbell' },
  { id: 'dips', name: 'Dips', muscle: 'Triceps', equipment: 'Bodyweight' },

  // Legs
  { id: 'squat', name: 'Squat', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'leg-press', name: 'Leg Press', muscle: 'Legs', equipment: 'Machine' },
  { id: 'romanian-deadlift', name: 'Romanian Deadlift', muscle: 'Legs', equipment: 'Barbell' },
  { id: 'leg-curl', name: 'Leg Curl', muscle: 'Legs', equipment: 'Machine' },
  { id: 'leg-extension', name: 'Leg Extension', muscle: 'Legs', equipment: 'Machine' },
  { id: 'lunges', name: 'Lunges', muscle: 'Legs', equipment: 'Bodyweight' },
  { id: 'calf-raise', name: 'Calf Raise', muscle: 'Calves', equipment: 'Machine' },

  // Core
  { id: 'plank', name: 'Plank', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'crunch', name: 'Crunch', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'leg-raise', name: 'Leg Raise', muscle: 'Core', equipment: 'Bodyweight' },
  { id: 'cable-crunch', name: 'Cable Crunch', muscle: 'Core', equipment: 'Cable' },
];

export const MUSCLES = [...new Set(EXERCISES.map(e => e.muscle))];

export function getExerciseById(id) {
  return EXERCISES.find(e => e.id === id);
}
