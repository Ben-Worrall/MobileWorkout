#!/usr/bin/env node
// Builds constants/exercises.generated.js from the free-exercise-db project (Unlicense / public domain):
//   https://github.com/yuhonas/free-exercise-db
// Usage: node scripts/build-exercises.js [path-to-exercises.json]
// Without an argument it downloads dist/exercises.json into the OS temp dir (nothing downloaded is committed).
const fs = require('fs');
const os = require('os');
const path = require('path');

const SRC_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json';
const OUT = path.join(__dirname, '..', 'constants', 'exercises.generated.js');
const CAP_PER_MUSCLE = { Chest: 26, Back: 40, Shoulders: 28, Biceps: 20, Triceps: 20, Legs: 40, Glutes: 14, Calves: 8, Core: 30, Traps: 10, Forearms: 12 };

const MUSCLE_MAP = {
  quadriceps: 'Legs', hamstrings: 'Legs', adductors: 'Legs', abductors: 'Glutes', glutes: 'Glutes',
  lats: 'Back', 'middle back': 'Back', 'lower back': 'Back', traps: 'Traps', forearms: 'Forearms',
  abdominals: 'Core', shoulders: 'Shoulders', chest: 'Chest', biceps: 'Biceps', triceps: 'Triceps', calves: 'Calves',
};
const EQUIPMENT_MAP = {
  barbell: 'Barbell', 'e-z curl bar': 'Barbell', dumbbell: 'Dumbbell', cable: 'Cable', machine: 'Machine',
  'body only': 'Bodyweight', kettlebells: 'Kettlebell', bands: 'Bands',
};
const CATEGORY_OK = new Set(['strength', 'powerlifting', 'plyometrics']); // cardio is covered by the hand-written list
const UNILATERAL_RE = /\b(single|one[- ]arm|one[- ]leg|one[- ]legged|alternat\w*|unilateral|split squat|lunge\w*|step[- ]?up\w*|concentration|kickback\w*|pistol|bulgarian)\b/i;
const NOT_UNILATERAL_RE = /\b(two[- ]arm|both|double)\b/i;

// Equivalence key for de-duplication: ignores case, punctuation, plurals, the word "barbell" (bare names mean barbell)
// and filler words, so "Barbell Squat", "Squats" and "Squat" all collapse to one key.
const norm = s => s
  .toLowerCase()
  .replace(/\(.*?\)/g, ' ')
  .replace(/\s-\s.*$/, ' ')
  .replace(/\bdb\b/g, 'dumbbell')
  .replace(/\b(barbell|bicep|tricep|exercise|the|with)\b/g, ' ')
  .replace(/[^a-z0-9]+/g, '')
  .replace(/(es|s)$/, '');

// Obscure, gimmicky, very advanced or equipment-heavy variations that do not belong in a general-purpose library.
const DENY = new RegExp([
  'gorilla', 'spell caster', 'bottoms', 'butt-?up', 'wind sprint', 'anti-gravity', 'bradford', 'rocky',
  'no hyperextension bench', 'vertical swing', 'rocket jump', 'skating', 'prowler', 'calf-machine', 'box jump',
  'cocoon', 'judo', 'spider crawl', 'landmine 180', 'tuck jump', 'scissors jump', 'star jump', 'skipping',
  'butt kick', 'flutter kick', '^leg lift$', 'isometric', 'elbow to knee', 'chair squat', 'kneeling squat',
  'butt lift', 'speed box', 'board press', 'pin press', 'chains', 'with bands?', 'reverse band', 'finger curl',
  'wrist rotation', 'cuban', 'jm press', 'body tricep', 'bench jump', 'lateral bound', 'long jump', 'split jump',
  'dumbbell clean', 'clean and press', 'sumo high pull', 'halo', 'hanging bar good morning', 'off pins',
  'leverage iso', 'shotgun', 'incline shoulder raise', 'bent-arm', 'dumbbell raise$', 'front raise and pullover',
  'monster walk', 'thigh abductor', 'pull through', 'plie', 'rear lunge', 'ab rollout', 'barbell rollout',
  'jackknife', '3/4', 'bosu', 'cable internal', 'external rotation', 'standing cable lift', 'cable russian',
  'incline inner', 'flexor', 'drag curl', 'cross body', 'lying supine', 'squat with', 'rack pull with',
  'sumo deadlift with', 'seated good morning', 'deficit', 'leverage deadlift', 'calf raise on a dumbbell',
  'rocking', 'kettlebell', 'trail', 'plyo', 'push up to side plank', 'incline push-up (medium|wide)', 'power clean', 'snatch', 'jefferson', 'car drivers', 'around the world', 'clock push', 'jammer', 'janda', 'frog sit', 'neck press', 'guillotine', 'behind neck', 'lunge sprint', 'jump squat', 'hang power', 'natural glute', 'cambered', 'middle back shrug', 'seated leg tuck', 'band good morning', 'standing palms-in',
].join('|'), 'i');

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function describe(instructions) {
  const steps = (instructions || []).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  let out = '';
  for (const st of steps.slice(0, 4)) {
    if ((out + ' ' + st).trim().length > 460) break;
    out = (out + ' ' + st).trim();
  }
  return out;
}

async function load() {
  const arg = process.argv[2];
  if (arg) return JSON.parse(fs.readFileSync(arg, 'utf8'));
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(path.join(os.tmpdir(), 'free-exercise-db.json'), text);
  return JSON.parse(text);
}

async function main() {
  const raw = await load();

  // Existing hand-written library, read as text so this script needs no ESM/Babel setup.
  const existingSrc = fs.readFileSync(path.join(__dirname, '..', 'constants', 'exercises.js'), 'utf8');
  const existingNames = [...existingSrc.matchAll(/\bname:\s*'([^']+)'/g)].map(m => m[1]);
  const seen = new Set(existingNames.map(norm));

  const candidates = [];
  for (const e of raw) {
    if (!CATEGORY_OK.has(e.category)) continue;
    if (e.level === 'expert') continue;
    const muscle = MUSCLE_MAP[(e.primaryMuscles || [])[0]];
    const equipment = EQUIPMENT_MAP[e.equipment];
    if (!muscle || !equipment) continue; // other / null / exercise ball / foam roll / medicine ball are skipped
    const description = describe(e.instructions);
    if (description.length < 40) continue;
    const name = e.name.replace(/\s+/g, ' ').trim();
    if (name.length > 48 || DENY.test(name)) continue;
    let score = 0;
    if (e.mechanic === 'compound') score += 3;
    if (e.level === 'beginner') score += 2;
    if (['Barbell', 'Dumbbell', 'Cable', 'Machine', 'Bodyweight'].includes(equipment)) score += 2;
    if (e.category === 'powerlifting') score += 1;
    if (/\b(smith|reverse grip|wide grip|close grip|medium grip)\b/i.test(name)) score -= 1;
    candidates.push({
      name, key: norm(name), muscle, equipment, description, score,
      unilateral: UNILATERAL_RE.test(name) && !NOT_UNILATERAL_RE.test(name),
    });
  }

  candidates.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const counts = {};
  const picked = [];
  for (const c of candidates) {
    if (seen.has(c.key)) continue;
    if ((counts[c.muscle] || 0) >= (CAP_PER_MUSCLE[c.muscle] || 20)) continue;
    counts[c.muscle] = (counts[c.muscle] || 0) + 1;
    seen.add(c.key);
    picked.push(c);
  }
  picked.sort((a, b) => a.muscle.localeCompare(b.muscle) || a.name.localeCompare(b.name));

  const used = new Set();
  const lines = picked.map(c => {
    let id = 'fx-' + slug(c.name);
    while (used.has(id)) id += '-2';
    used.add(id);
    return '  ' + JSON.stringify({
      id, name: c.name, muscle: c.muscle,
      category: ['Legs', 'Glutes', 'Calves'].includes(c.muscle) ? 'Lower Body' : c.muscle === 'Core' ? 'Core' : 'Upper Body',
      equipment: c.equipment, notes: c.description, ...(c.unilateral ? { unilateral: true } : {}),
    }) + ',';
  });

  const out =
`// GENERATED by scripts/build-exercises.js from free-exercise-db (Unlicense / public domain).
// https://github.com/yuhonas/free-exercise-db  -  do not edit by hand; re-run the script instead.
export const GENERATED_EXERCISES = [
${lines.join('\n')}
];
`;
  fs.writeFileSync(OUT, out);
  console.log(`existing: ${existingNames.length}, generated: ${picked.length}, total: ${existingNames.length + picked.length}`);
  console.log('per muscle:', JSON.stringify(counts));
  console.log('unilateral flagged:', picked.filter(p => p.unilateral).length);
  console.log('file size:', Math.round(fs.statSync(OUT).size / 1024) + ' KB');
}

main().catch(e => { console.error(e); process.exit(1); });
