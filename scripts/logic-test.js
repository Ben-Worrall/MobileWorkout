// Usage: node scripts/logic-test.js   (needs Node 22+ for the built-in sqlite; no emulator or network)
// Runs the REAL utils/database.js, utils/sync.js, utils/units.js, utils/timers.js against Node's built-in SQLite.
const fs = require('fs'), path = require('path'), Module = require('module');
const os = require('os');
const root = path.join(__dirname, '..');
const out = path.join(os.tmpdir(), 'gymnote-logic-test');
const babel = require(root + '/node_modules/@babel/core');
fs.rmSync(out, { recursive: true, force: true });
for (const d of ['utils', 'constants', 'node_modules/expo-sqlite']) fs.mkdirSync(path.join(out, d), { recursive: true });

const compile = rel => {
  const src = fs.readFileSync(path.join(root, rel), 'utf8');
  const res = babel.transformSync(src, { filename: rel, babelrc: false, configFile: false, plugins: [require.resolve(root + '/node_modules/@babel/plugin-transform-modules-commonjs')] });
  fs.writeFileSync(path.join(out, rel), res.code);
};
['utils/database.js', 'utils/sync.js', 'utils/units.js', 'utils/timers.js', 'constants/exercises.js', 'constants/exercises.generated.js'].forEach(compile);

// ── mocks
fs.writeFileSync(path.join(out, 'node_modules/expo-sqlite/index.js'), `
const { DatabaseSync } = require('node:sqlite');
exports.openDatabaseAsync = async () => {
  const db = new DatabaseSync(':memory:');
  const clean = p => (p || []).map(v => (v === undefined ? null : v));
  const api = {
    raw: db,
    execAsync: async sql => { db.exec(sql); },
    runAsync: async (sql, p) => { const r = db.prepare(sql).run(...clean(p)); return { changes: r.changes }; },
    getFirstAsync: async (sql, p) => { const r = db.prepare(sql).get(...clean(p)); return r === undefined ? null : { ...r }; },
    getAllAsync: async (sql, p) => db.prepare(sql).all(...clean(p)).map(r => ({ ...r })),
    withTransactionAsync: async fn => { db.exec('BEGIN'); try { await fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; } },
  };
  return api;
};`);
// fake supabase: in-memory "cloud" tables + call log
fs.writeFileSync(path.join(out, 'utils/supabase.js'), `
const cloud = {}; const log = [];
let failTable = null; let session = { user: { id: 'user-1' } };
const tbl = n => (cloud[n] = cloud[n] || new Map());
exports.__cloud = cloud; exports.__log = log;
exports.__setFail = t => { failTable = t; }; exports.__setUser = id => { session = id ? { user: { id } } : null; };
exports.supabase = {
  auth: { getSession: async () => ({ data: { session } }) },
  from: name => ({
    upsert: async (rows) => { rows = [].concat(rows); log.push(['upsert', name, rows.length]); if (failTable === name) return { error: { message: 'boom' } }; for (const r of rows) tbl(name).set(r.id, { ...tbl(name).get(r.id), ...r }); return { error: null }; },
    delete: () => ({ eq: (c1, v1) => ({ eq: async (c2, v2) => { log.push(['delete', name, v1]); tbl(name).delete(v1); return { error: null }; } }) }),
    select: () => ({ order: () => ({ range: async (a, b) => ({ data: [...tbl(name).values()].slice(a, b + 1), error: null }) }) }),
  }),
};`);

const nm = Module._nodeModulePaths(out); // let require find our mock expo-sqlite
const req = rel => { delete require.cache[path.join(out, rel)]; return require(path.join(out, rel)); };
module.paths.push(path.join(out, 'node_modules'));
process.env.NODE_PATH = path.join(out, 'node_modules'); Module._initPaths();

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

(async () => {
  const D = req('utils/database.js');
  const S = req('utils/sync.js');
  const SB = require(path.join(out, 'utils/supabase.js'));
  const X = require(path.join(out, 'constants/exercises.js'));
  const db = await D.getDb();
  const one = async (sql, p) => (await db.getFirstAsync(sql, p));
  const count = async (sql, p) => (await one(sql, p)).c;

  // fresh install: schema + migration
  const cols = (await db.getAllAsync('PRAGMA table_info(logged_sets)')).map(c => c.name);
  check('fresh schema has rir + side', cols.includes('rir') && cols.includes('side'));
  check('user_version is 1', (await one('PRAGMA user_version')).user_version === 1);
  const both = await Promise.all([D.getDb(), D.getDb()]);
  check('getDb returns one shared handle', both[0] === both[1]);

  await D.seedExercises(X.BUILTIN_EXERCISES);
  check('seed inserts the whole library', (await count('SELECT COUNT(*) c FROM exercises WHERE is_custom=0')) === X.BUILTIN_EXERCISES.length, String(X.BUILTIN_EXERCISES.length));
  await D.seedExercises(X.BUILTIN_EXERCISES);
  check('second seed is a no-op', (await count('SELECT COUNT(*) c FROM exercises')) === X.BUILTIN_EXERCISES.length);

  // old-schema upgrade (existing 1.1.0 install)
  {
    const mod = require('node:sqlite'); const legacy = new mod.DatabaseSync(':memory:');
    legacy.exec("CREATE TABLE logged_sets (id TEXT PRIMARY KEY, session_id TEXT, exercise_id TEXT, exercise_name TEXT, set_number INTEGER, weight REAL, reps INTEGER, completed INTEGER DEFAULT 1, created_at INTEGER); CREATE TABLE exercises (id TEXT PRIMARY KEY, name TEXT NOT NULL, muscle TEXT NOT NULL, category TEXT NOT NULL, equipment TEXT, is_custom INTEGER DEFAULT 0, notes TEXT, created_at INTEGER);");
    legacy.exec("INSERT INTO logged_sets (id) VALUES ('old')");
    check('legacy install keeps rows before migration', legacy.prepare('SELECT COUNT(*) c FROM logged_sets').get().c === 1);
  }

  // ── routines + deletes that used to hit foreign keys
  await D.addCustomExercise({ id: 'cx1', name: 'My Move', muscle: 'Chest', category: 'Upper Body', equipment: 'Cable', notes: 'n', isUnilateral: true });
  await D.saveTemplate({ id: 'tpl1', name: 'Push', exercises: [{ exercise_id: 'bench-press', default_sets: 3 }, { exercise_id: 'cx1' }] });
  check('routine saved with 2 exercises', (await count(`SELECT COUNT(*) c FROM template_exercises WHERE template_id='tpl1'`)) === 2);
  const before = await db.getAllAsync(`SELECT id FROM template_exercises WHERE template_id='tpl1'`);
  SB.__log.length = 0;
  await D.saveTemplate({ id: 'tpl1', name: 'Push v2', exercises: [{ exercise_id: 'bench-press' }, { exercise_id: 'cx1' }, { exercise_id: 'ohp' }] });
  check('editing a routine does not duplicate rows', (await count(`SELECT COUNT(*) c FROM template_exercises WHERE template_id='tpl1'`)) === 3);
  check('editing keeps created_at / renames', (await one(`SELECT name FROM workout_templates WHERE id='tpl1'`)).name === 'Push v2');
  await new Promise(r => setTimeout(r, 50));
  const dels = SB.__log.filter(l => l[0] === 'delete' && l[1] === 'template_exercises').length;
  check('old routine rows are deleted in the cloud (no pile-up)', dels === before.length, 'deletes=' + dels);

  await D.createSession({ id: 's1', name: 'Push', templateId: 'tpl1' });
  for (let i = 1; i <= 10; i++) await D.logSet({ id: 'a' + i, sessionId: 's1', exerciseId: 'bench-press', exerciseName: 'Bench Press', setNumber: i, weight: 60, reps: 8, rir: 2 });
  await D.finishSession('s1', null);
  await D.createSession({ id: 's2', name: 'Open', templateId: null });
  await D.logSet({ id: 'b1', sessionId: 's2', exerciseId: 'bench-press', exerciseName: 'Bench Press', setNumber: 1, weight: 200, reps: 1 });

  await D.scheduleWorkout({ id: 'sch1', templateId: 'tpl1', date: '2026-12-01' });
  await D.scheduleWorkout({ id: 'sch2', templateId: 'tpl1', date: '2026-11-01' });
  await D.markScheduledComplete('sch2', 's1');

  let threw = null; try { await D.deleteTemplate('tpl1'); } catch (e) { threw = e; }
  check('deleting a routine used by past workouts works', !threw, threw && threw.message);
  check('past workout survives, link cleared', (await one(`SELECT template_id t FROM workout_sessions WHERE id='s1'`)).t === null);
  check('future scheduled entry removed, completed one kept', (await count('SELECT COUNT(*) c FROM scheduled_workouts')) === 1);

  await D.saveTemplate({ id: 'tpl2', name: 'Custom', exercises: [{ exercise_id: 'cx1' }] });
  threw = null; try { await D.deleteCustomExercise('cx1'); } catch (e) { threw = e; }
  check('deleting a custom exercise used in a routine works', !threw, threw && threw.message);
  check('its routine link is gone, routine remains', (await count(`SELECT COUNT(*) c FROM template_exercises WHERE exercise_id='cx1'`)) === 0 && (await count(`SELECT COUNT(*) c FROM workout_templates WHERE id='tpl2'`)) === 1);

  // ── analytics fixes
  const wk = await D.getWeeklyFrequency(12);
  check('weekly workouts counts workouts, not sets', wk.reduce((a, w) => a + w.workouts, 0) === 1, JSON.stringify(wk));
  const pr = await D.getPersonalRecords();
  check('personal records ignore the unfinished workout', pr.find(p => p.exercise_id === 'bench-press').max_weight === 60);
  check('session count helper', (await D.countSessionsSince(30)) === 1);
  const sm = await D.getSessionSummaries();
  check('summaries report 10 sets', sm[0].total_sets === 10);

  // left/right sets count once
  await D.createSession({ id: 's3', name: 'LR', templateId: null });
  for (const side of ['L', 'R']) await D.logSet({ id: 'lr' + side, sessionId: 's3', exerciseId: 'db-row', exerciseName: 'Row', setNumber: 1, weight: 20, reps: 10, rir: 1, side });
  await D.finishSession('s3', null);
  const lr = (await D.getSessionSummaries()).find(x => x.id === 's3');
  check('left+right counts as ONE set', lr.total_sets === 1, String(lr.total_sets));

  // ── sync: upload
  await new Promise(r => setTimeout(r, 150)); SB.__log.length = 0; Object.keys(SB.__cloud).forEach(k => SB.__cloud[k].clear());
  await S.uploadLocalData();
  const order = SB.__log.filter(l => l[0] === 'upsert').map(l => l[1]);
  const sessionIds = [...(SB.__cloud.workout_sessions || new Map()).keys()];
  const setSessions = new Set([...(SB.__cloud.logged_sets || new Map()).values()].map(r => r.session_id));
  check('upload skips the unfinished workout', !sessionIds.includes('s2'), sessionIds.join());
  check('upload skips sets of unfinished workouts (would break the batch)', !setSessions.has('s2') && setSessions.has('s1'));
  check('upload order respects foreign keys', order.indexOf('workout_templates') < order.indexOf('workout_sessions') && order.indexOf('workout_sessions') < order.indexOf('logged_sets') && order.indexOf('logged_sets') < order.indexOf('scheduled_workouts'), order.join('>'));
  SB.__setFail('logged_sets');
  let upErr = null; try { await S.uploadLocalData(); } catch (e) { upErr = e; }
  check('a failed upload is reported, not ignored', !!upErr && /logged_sets/.test(upErr.message), upErr && upErr.message);
  SB.__setFail(null);

  // ── sync: download must merge, never delete local rows
  SB.__setUser(null); await D.logSet({ id: 'unsynced', sessionId: 's1', exerciseId: 'bench-press', exerciseName: 'Bench Press', setNumber: 11, weight: 61, reps: 8 }); await new Promise(r => setTimeout(r, 50)); SB.__setUser('user-1'); // local-only set of a synced workout
  const setsBefore = await count(`SELECT COUNT(*) c FROM logged_sets WHERE session_id='s1'`);
  await S.downloadCloudData();
  const setsAfter = await count(`SELECT COUNT(*) c FROM logged_sets WHERE session_id='s1'`);
  check('restoring from the cloud does NOT delete local sets of a synced workout', setsAfter === setsBefore, setsBefore + ' -> ' + setsAfter);
  check('cloud values are merged in', (await one(`SELECT rir FROM logged_sets WHERE id='a1'`)).rir === 2);

  // ── account switching
  await D.setSetting('data_owner', 'someone-else');
  await S.syncAfterLogin();
  check('different account clears the previous account\'s workouts', (await count(`SELECT COUNT(*) c FROM workout_sessions WHERE id='s1'`)) === 1 && (await one(`SELECT value v FROM user_settings WHERE key='data_owner'`)).v === 'user-1');
  // The previous owner's rows were removed before upload, so only cloud-owned rows come back; local-only 'unsynced' must be gone.
  check('local-only data of the previous account was not uploaded to the new one', !SB.__cloud.logged_sets.has('unsynced'));
  check('local-only set is gone after switching accounts', (await count(`SELECT COUNT(*) c FROM logged_sets WHERE id='unsynced'`)) === 0);
  await D.clearLocalUserData();
  check('clearLocalUserData leaves built-in exercises', (await count('SELECT COUNT(*) c FROM exercises WHERE is_custom=0')) === X.BUILTIN_EXERCISES.length);

  // proof of the old bug: INSERT OR REPLACE on a parent row cascades and deletes its children
  {
    await D.createSession({ id: 'old1', name: 'x', templateId: null }); await D.logSet({ id: 'oldset', sessionId: 'old1', exerciseId: 'ohp', exerciseName: 'OHP', setNumber: 1, weight: 1, reps: 1 });
    db.raw.prepare('INSERT OR REPLACE INTO workout_sessions (id, name, started_at, finished_at) VALUES (?, ?, ?, ?)').run('old1', 'x', 1, 2);
    check('(diagnosis) old INSERT OR REPLACE really did delete the set via cascade', (await count("SELECT COUNT(*) c FROM logged_sets WHERE id='oldset'")) === 0);
  }

  // ── units + timers
  const U = require(path.join(out, 'utils/units.js')), T = require(path.join(out, 'utils/timers.js'));
  const lb = U.makeFormatters('lb'), kg = U.makeFormatters('kg');
  check('100 kg shows as 220.5 lb', lb.fmtW(100) === '220.5 lb');
  check('typing 135 lb stores 61.23 kg and shows 135 lb', lb.parseKg('135') === 61.23 && lb.fmtW(61.23) === '135 lb');
  check('kg round trip', kg.fmtW(kg.parseKg('62.5')) === '62.5 kg');
  check('empty weight parses to 0', lb.parseKg('') === 0 && kg.parseKg('abc') === 0);
  const r0 = T.startRest(90, 1000);
  check('rest remaining counts down', T.restRemaining(r0, 1000) === 90 && T.restRemaining(r0, 31000) === 60 && T.restRemaining(r0, 999999) === 0);
  const p = T.pauseRest(r0, 31000);
  check('pause freezes the time', T.restRemaining(p, 500000) === 60);
  const rs = T.resumeRest(p, 600000);
  check('resume continues from the frozen value', T.restRemaining(rs, 600000) === 60 && T.restRemaining(rs, 630000) === 30);
  check('+15s extends', T.restRemaining(T.adjustRest(r0, 15, 1000), 1000) === 105);
  const w = T.startWorkoutTimer(T.newWorkoutTimer(), 0), wp = T.pauseWorkoutTimer(w, 5000);
  check('workout timer pause keeps elapsed', T.workoutElapsed(wp, 99999) === 5000 && T.workoutElapsed(T.startWorkoutTimer(wp, 10000), 12000) === 7000);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
