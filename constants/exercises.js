// Built-in exercise library
export const BUILTIN_EXERCISES = [
  // ── CHEST ──────────────────────────────────────────
  { id: 'bench-press',        name: 'Bench Press',          muscle: 'Chest',     category: 'Upper Body', equipment: 'Barbell' },
  { id: 'incline-bench',      name: 'Incline Bench Press',  muscle: 'Chest',     category: 'Upper Body', equipment: 'Barbell' },
  { id: 'decline-bench',      name: 'Decline Bench Press',  muscle: 'Chest',     category: 'Upper Body', equipment: 'Barbell' },
  { id: 'db-bench',           name: 'Dumbbell Bench Press', muscle: 'Chest',     category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'incline-db-bench',   name: 'Incline DB Press',     muscle: 'Chest',     category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'db-fly',             name: 'Dumbbell Fly',         muscle: 'Chest',     category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'cable-fly',          name: 'Cable Fly',            muscle: 'Chest',     category: 'Upper Body', equipment: 'Cable' },
  { id: 'cable-crossover',    name: 'Cable Crossover',      muscle: 'Chest',     category: 'Upper Body', equipment: 'Cable' },
  { id: 'push-up',            name: 'Push Up',              muscle: 'Chest',     category: 'Upper Body', equipment: 'Bodyweight' },
  { id: 'dips-chest',         name: 'Dips (Chest)',         muscle: 'Chest',     category: 'Upper Body', equipment: 'Bodyweight' },
  { id: 'pec-deck',           name: 'Pec Deck',             muscle: 'Chest',     category: 'Upper Body', equipment: 'Machine' },
  { id: 'chest-press-machine',name: 'Chest Press Machine',  muscle: 'Chest',     category: 'Upper Body', equipment: 'Machine' },

  // ── BACK ───────────────────────────────────────────
  { id: 'deadlift',           name: 'Deadlift',             muscle: 'Back',      category: 'Full Body',  equipment: 'Barbell' },
  { id: 'barbell-row',        name: 'Barbell Row',          muscle: 'Back',      category: 'Upper Body', equipment: 'Barbell' },
  { id: 'pendlay-row',        name: 'Pendlay Row',          muscle: 'Back',      category: 'Upper Body', equipment: 'Barbell' },
  { id: 't-bar-row',          name: 'T-Bar Row',            muscle: 'Back',      category: 'Upper Body', equipment: 'Barbell' },
  { id: 'pull-up',            name: 'Pull Up',              muscle: 'Back',      category: 'Upper Body', equipment: 'Bodyweight' },
  { id: 'chin-up',            name: 'Chin Up',              muscle: 'Back',      category: 'Upper Body', equipment: 'Bodyweight' },
  { id: 'lat-pulldown',       name: 'Lat Pulldown',         muscle: 'Back',      category: 'Upper Body', equipment: 'Cable' },
  { id: 'seated-cable-row',   name: 'Seated Cable Row',     muscle: 'Back',      category: 'Upper Body', equipment: 'Cable' },
  { id: 'cable-pullover',     name: 'Cable Pullover',       muscle: 'Back',      category: 'Upper Body', equipment: 'Cable' },
  { id: 'db-row',             name: 'Dumbbell Row',         muscle: 'Back',      category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'incline-db-row',     name: 'Incline DB Row',       muscle: 'Back',      category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'machine-row',        name: 'Machine Row',          muscle: 'Back',      category: 'Upper Body', equipment: 'Machine' },
  { id: 'rack-pull',          name: 'Rack Pull',            muscle: 'Back',      category: 'Upper Body', equipment: 'Barbell' },
  { id: 'face-pull',          name: 'Face Pull',            muscle: 'Back',      category: 'Upper Body', equipment: 'Cable' },

  // ── SHOULDERS ──────────────────────────────────────
  { id: 'ohp',                name: 'Overhead Press',       muscle: 'Shoulders', category: 'Upper Body', equipment: 'Barbell' },
  { id: 'db-shoulder-press',  name: 'DB Shoulder Press',    muscle: 'Shoulders', category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'arnold-press',       name: 'Arnold Press',         muscle: 'Shoulders', category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'lateral-raise',      name: 'Lateral Raise',        muscle: 'Shoulders', category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'cable-lateral-raise',name: 'Cable Lateral Raise',  muscle: 'Shoulders', category: 'Upper Body', equipment: 'Cable' },
  { id: 'front-raise',        name: 'Front Raise',          muscle: 'Shoulders', category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'rear-delt-fly',      name: 'Rear Delt Fly',        muscle: 'Shoulders', category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'upright-row',        name: 'Upright Row',          muscle: 'Shoulders', category: 'Upper Body', equipment: 'Barbell' },
  { id: 'machine-shoulder',   name: 'Machine Shoulder Press',muscle: 'Shoulders', category: 'Upper Body', equipment: 'Machine' },
  { id: 'shrugs',             name: 'Shrugs',               muscle: 'Shoulders', category: 'Upper Body', equipment: 'Barbell' },

  // ── BICEPS ─────────────────────────────────────────
  { id: 'barbell-curl',       name: 'Barbell Curl',         muscle: 'Biceps',    category: 'Upper Body', equipment: 'Barbell' },
  { id: 'ez-bar-curl',        name: 'EZ Bar Curl',          muscle: 'Biceps',    category: 'Upper Body', equipment: 'Barbell' },
  { id: 'db-curl',            name: 'Dumbbell Curl',        muscle: 'Biceps',    category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'hammer-curl',        name: 'Hammer Curl',          muscle: 'Biceps',    category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'incline-db-curl',    name: 'Incline DB Curl',      muscle: 'Biceps',    category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'concentration-curl', name: 'Concentration Curl',   muscle: 'Biceps',    category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'cable-curl',         name: 'Cable Curl',           muscle: 'Biceps',    category: 'Upper Body', equipment: 'Cable' },
  { id: 'preacher-curl',      name: 'Preacher Curl',        muscle: 'Biceps',    category: 'Upper Body', equipment: 'Machine' },

  // ── TRICEPS ────────────────────────────────────────
  { id: 'close-grip-bench',   name: 'Close Grip Bench',     muscle: 'Triceps',   category: 'Upper Body', equipment: 'Barbell' },
  { id: 'skull-crusher',      name: 'Skull Crusher',        muscle: 'Triceps',   category: 'Upper Body', equipment: 'Barbell' },
  { id: 'tricep-pushdown',    name: 'Tricep Pushdown',      muscle: 'Triceps',   category: 'Upper Body', equipment: 'Cable' },
  { id: 'overhead-tri-ext',   name: 'Overhead Tri Extension',muscle: 'Triceps',  category: 'Upper Body', equipment: 'Cable' },
  { id: 'dips-triceps',       name: 'Dips (Triceps)',       muscle: 'Triceps',   category: 'Upper Body', equipment: 'Bodyweight' },
  { id: 'db-kickback',        name: 'DB Kickback',          muscle: 'Triceps',   category: 'Upper Body', equipment: 'Dumbbell' },
  { id: 'diamond-push-up',    name: 'Diamond Push Up',      muscle: 'Triceps',   category: 'Upper Body', equipment: 'Bodyweight' },

  // ── LEGS ───────────────────────────────────────────
  { id: 'squat',              name: 'Squat',                muscle: 'Legs',      category: 'Lower Body', equipment: 'Barbell' },
  { id: 'front-squat',        name: 'Front Squat',          muscle: 'Legs',      category: 'Lower Body', equipment: 'Barbell' },
  { id: 'hack-squat',         name: 'Hack Squat',           muscle: 'Legs',      category: 'Lower Body', equipment: 'Machine' },
  { id: 'leg-press',          name: 'Leg Press',            muscle: 'Legs',      category: 'Lower Body', equipment: 'Machine' },
  { id: 'leg-extension',      name: 'Leg Extension',        muscle: 'Legs',      category: 'Lower Body', equipment: 'Machine' },
  { id: 'romanian-dl',        name: 'Romanian Deadlift',    muscle: 'Legs',      category: 'Lower Body', equipment: 'Barbell' },
  { id: 'leg-curl',           name: 'Leg Curl',             muscle: 'Legs',      category: 'Lower Body', equipment: 'Machine' },
  { id: 'lunges',             name: 'Lunges',               muscle: 'Legs',      category: 'Lower Body', equipment: 'Bodyweight' },
  { id: 'walking-lunges',     name: 'Walking Lunges',       muscle: 'Legs',      category: 'Lower Body', equipment: 'Dumbbell' },
  { id: 'goblet-squat',       name: 'Goblet Squat',         muscle: 'Legs',      category: 'Lower Body', equipment: 'Dumbbell' },
  { id: 'bulgarian-split',    name: 'Bulgarian Split Squat', muscle: 'Legs',     category: 'Lower Body', equipment: 'Dumbbell' },
  { id: 'sumo-deadlift',      name: 'Sumo Deadlift',        muscle: 'Legs',      category: 'Lower Body', equipment: 'Barbell' },

  // ── GLUTES ─────────────────────────────────────────
  { id: 'hip-thrust',         name: 'Hip Thrust',           muscle: 'Glutes',    category: 'Lower Body', equipment: 'Barbell' },
  { id: 'glute-bridge',       name: 'Glute Bridge',         muscle: 'Glutes',    category: 'Lower Body', equipment: 'Bodyweight' },
  { id: 'cable-kickback',     name: 'Cable Kickback',       muscle: 'Glutes',    category: 'Lower Body', equipment: 'Cable' },
  { id: 'abductor-machine',   name: 'Abductor Machine',     muscle: 'Glutes',    category: 'Lower Body', equipment: 'Machine' },

  // ── CALVES ─────────────────────────────────────────
  { id: 'standing-calf',      name: 'Standing Calf Raise',  muscle: 'Calves',    category: 'Lower Body', equipment: 'Machine' },
  { id: 'seated-calf',        name: 'Seated Calf Raise',    muscle: 'Calves',    category: 'Lower Body', equipment: 'Machine' },
  { id: 'donkey-calf',        name: 'Donkey Calf Raise',    muscle: 'Calves',    category: 'Lower Body', equipment: 'Machine' },

  // ── CORE ───────────────────────────────────────────
  { id: 'plank',              name: 'Plank',                muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'crunch',             name: 'Crunch',               muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'leg-raise',          name: 'Hanging Leg Raise',    muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'cable-crunch',       name: 'Cable Crunch',         muscle: 'Core',      category: 'Core',       equipment: 'Cable' },
  { id: 'ab-rollout',         name: 'Ab Rollout',           muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'russian-twist',      name: 'Russian Twist',        muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'side-plank',         name: 'Side Plank',           muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'dead-bug',           name: 'Dead Bug',             muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },
  { id: 'sit-up',             name: 'Sit Up',               muscle: 'Core',      category: 'Core',       equipment: 'Bodyweight' },

  // ── CARDIO ─────────────────────────────────────────
  { id: 'treadmill',          name: 'Treadmill',            muscle: 'Cardio',    category: 'Cardio',     equipment: 'Machine' },
  { id: 'cycling',            name: 'Cycling',              muscle: 'Cardio',    category: 'Cardio',     equipment: 'Machine' },
  { id: 'rowing',             name: 'Rowing Machine',       muscle: 'Cardio',    category: 'Cardio',     equipment: 'Machine' },
  { id: 'jump-rope',          name: 'Jump Rope',            muscle: 'Cardio',    category: 'Cardio',     equipment: 'Bodyweight' },
  { id: 'stair-climber',      name: 'Stair Climber',        muscle: 'Cardio',    category: 'Cardio',     equipment: 'Machine' },
  { id: 'burpees',            name: 'Burpees',              muscle: 'Cardio',    category: 'Cardio',     equipment: 'Bodyweight' },
];

export const CATEGORIES = ['All', 'Upper Body', 'Lower Body', 'Core', 'Cardio', 'Full Body'];

export const MUSCLES = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Glutes', 'Calves', 'Core', 'Cardio',
];

export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'];
