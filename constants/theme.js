export const colors = {
  // Backgrounds
  bg:       '#070c18',
  bg2:      '#0c1526',
  bg3:      '#111f35',
  bgCard:   '#0f1a2e',
  bgHover:  '#162540',

  // Borders
  border:   '#1a2d4a',
  borderDim:'#0f1e30',

  // Accent — light blue
  accent:     '#4d9fff',
  accentDim:  '#2d6fcc',
  accentGlow: 'rgba(77,159,255,0.12)',
  accentSoft: 'rgba(77,159,255,0.08)',

  // Semantic
  success:  '#34d399',
  warning:  '#fbbf24',
  danger:   '#f87171',
  purple:   '#a78bfa',

  // Text
  text:       '#eef2ff',
  textDim:    '#7b93b8',
  textMuted:  '#3d5470',
  white:      '#ffffff',

  // Muscle group colours
  chest:      '#f87171',
  back:       '#60a5fa',
  shoulders:  '#a78bfa',
  biceps:     '#fbbf24',
  triceps:    '#fb923c',
  legs:       '#34d399',
  core:       '#f472b6',
  cardio:     '#38bdf8',
  calves:     '#2dd4bf',
  glutes:     '#c084fc',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const font = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 26,
  xxxl: 32,
};

export const muscleColor = (muscle) => {
  const map = {
    'Chest': colors.chest,
    'Back': colors.back,
    'Shoulders': colors.shoulders,
    'Biceps': colors.biceps,
    'Triceps': colors.triceps,
    'Legs': colors.legs,
    'Quads': colors.legs,
    'Hamstrings': colors.legs,
    'Glutes': colors.glutes,
    'Core': colors.core,
    'Cardio': colors.cardio,
    'Calves': colors.calves,
    'Full Body': colors.accent,
  };
  return map[muscle] || colors.accent;
};
