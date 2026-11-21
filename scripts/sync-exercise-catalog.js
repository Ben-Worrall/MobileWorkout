#!/usr/bin/env node
// Uploads the id -> muscle map of the built-in exercise library to Supabase (table exercise_catalog),
// so friends' progress can be grouped by muscle. Re-run whenever constants/exercises*.js changes.
// Usage: SUPABASE_MGMT_TOKEN=sbp_... node scripts/sync-exercise-catalog.js
const fs = require('fs');
const path = require('path');

const REF = 'shrawyvdtfrccroetnxy';
const token = process.env.SUPABASE_MGMT_TOKEN;
if (!token) { console.error('Set SUPABASE_MGMT_TOKEN (Supabase account access token) first.'); process.exit(2); }

const toCjs = s => s.replace(/export (const|function) /g, '$1 ').replace(/import \{[^}]*\} from '[^']*';/g, '');
const read = f => fs.readFileSync(path.join(__dirname, '..', 'constants', f), 'utf8');
const list = new Function(toCjs(read('exercises.generated.js')) + '\n' + toCjs(read('exercises.js')) + '\nreturn BUILTIN_EXERCISES;')();

const esc = s => String(s).replace(/'/g, "''");
const values = list.map(e => `('${esc(e.id)}','${esc(e.name)}','${esc(e.muscle)}')`).join(',\n');
const query = `INSERT INTO public.exercise_catalog (id, name, muscle) VALUES\n${values}\nON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, muscle = EXCLUDED.muscle;`;

fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
}).then(async r => {
  console.log(`catalog upload: HTTP ${r.status}, ${list.length} exercises`);
  if (!r.ok) { console.error(await r.text()); process.exit(1); }
});
