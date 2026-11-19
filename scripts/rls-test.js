const URL = 'https://shrawyvdtfrccroetnxy.supabase.co';
const ANON = 'sb_publishable_ELZL-cFF_0FBVFn5i--Kzg_G4Lz5S_B';
const SVC = process.env.SUPABASE_SERVICE_KEY; if (!SVC) { console.error('Set SUPABASE_SERVICE_KEY (Supabase secret key) in the environment first.'); process.exit(2); }
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { (ok ? pass++ : fail++); console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

async function admin(method, path, body) {
  const r = await fetch(URL + path, { method, headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return r.json().catch(() => ({}));
}
async function login(email, password) {
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  const j = await r.json(); return j.access_token;
}
async function rest(method, table, token, { query = '', body, prefer } = {}) {
  const headers = { apikey: ANON, Authorization: 'Bearer ' + (token || ANON), 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(`${URL}/rest/v1/${table}${query}`, { method, headers, body: body && JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
}

(async () => {
  const stamp = Date.now();
  const A = await admin('POST', '/auth/v1/admin/users', { email: `rls.a.${stamp}@example.com`, password: 'RlsTest-A-1234', email_confirm: true });
  const B = await admin('POST', '/auth/v1/admin/users', { email: `rls.b.${stamp}@example.com`, password: 'RlsTest-B-1234', email_confirm: true });
  const ta = await login(A.email, 'RlsTest-A-1234'), tb = await login(B.email, 'RlsTest-B-1234');
  check('both test users can log in', !!ta && !!tb);

  const row = { id: 'rls-a-' + stamp, user_id: A.id, name: 'A private workout', started_at: 1 };
  const ins = await rest('POST', 'workout_sessions', ta, { body: row, prefer: 'return=representation' });
  check('A can insert own row', ins.status === 201, 'HTTP ' + ins.status);

  const spoof = await rest('POST', 'workout_sessions', ta, { body: { id: 'rls-spoof-' + stamp, user_id: B.id, name: 'spoofed', started_at: 1 } });
  check('A CANNOT insert a row owned by B', spoof.status >= 400, 'HTTP ' + spoof.status);

  const readA = await rest('GET', 'workout_sessions', ta, { query: '?select=id' });
  check('A can read own row', Array.isArray(readA.json) && readA.json.length === 1, 'rows=' + (readA.json && readA.json.length));
  const readB = await rest('GET', 'workout_sessions', tb, { query: '?select=id' });
  check('B CANNOT see A\'s row', Array.isArray(readB.json) && readB.json.length === 0, 'rows=' + (readB.json && readB.json.length));

  const upd = await rest('PATCH', 'workout_sessions', tb, { query: `?id=eq.${row.id}`, body: { name: 'hacked' }, prefer: 'return=representation' });
  check('B CANNOT update A\'s row', Array.isArray(upd.json) && upd.json.length === 0, 'HTTP ' + upd.status + ' rows=' + (upd.json && upd.json.length));
  const del = await rest('DELETE', 'workout_sessions', tb, { query: `?id=eq.${row.id}`, prefer: 'return=representation' });
  check('B CANNOT delete A\'s row', Array.isArray(del.json) && del.json.length === 0, 'HTTP ' + del.status);
  const still = await rest('GET', 'workout_sessions', ta, { query: `?id=eq.${row.id}&select=name` });
  check('A\'s row is intact after B\'s attempts', still.json && still.json[0] && still.json[0].name === 'A private workout');

  const chg = await rest('PATCH', 'workout_sessions', ta, { query: `?id=eq.${row.id}`, body: { user_id: B.id }, prefer: 'return=representation' });
  check('A CANNOT hand own row to B (WITH CHECK)', chg.status >= 400 || (Array.isArray(chg.json) && chg.json.length === 0), 'HTTP ' + chg.status);

  // exercises table was the hole: no owner rows
  const exNull = await rest('POST', 'exercises', ta, { body: { id: 'ex-null-' + stamp, name: 'x', muscle: 'Chest', category: 'Upper Body' } });
  check('logged-in user CANNOT create ownerless exercise', exNull.status >= 400, 'HTTP ' + exNull.status);
  const exOwn = await rest('POST', 'exercises', ta, { body: { id: 'ex-own-' + stamp, user_id: A.id, name: 'My move', muscle: 'Chest', category: 'Upper Body', is_custom: 1 } });
  check('logged-in user CAN create own custom exercise', exOwn.status === 201, 'HTTP ' + exOwn.status);
  const exSeen = await rest('GET', 'exercises', tb, { query: '?select=id' });
  check('B CANNOT see A\'s custom exercise', Array.isArray(exSeen.json) && exSeen.json.length === 0);

  // template + its exercises, including the new rir/side columns on logged_sets
  const tpl = await rest('POST', 'workout_templates', ta, { body: { id: 'tpl-a-' + stamp, user_id: A.id, name: 'A routine' } });
  check('A can create a template', tpl.status === 201, 'HTTP ' + tpl.status);
  const te = await rest('POST', 'template_exercises', ta, { body: { id: 'te-a-' + stamp, user_id: A.id, template_id: 'tpl-a-' + stamp, exercise_id: 'bench-press' } });
  check('A can add an exercise to own template (user_id column)', te.status === 201, 'HTTP ' + te.status);
  const teB = await rest('POST', 'template_exercises', tb, { body: { id: 'te-b-' + stamp, user_id: B.id, template_id: 'tpl-a-' + stamp, exercise_id: 'bench-press' } });
  check('B CANNOT add an exercise to A\'s template', teB.status >= 400, 'HTTP ' + teB.status);
  const teSee = await rest('GET', 'template_exercises', tb, { query: '?select=id' });
  check('B CANNOT see A\'s template exercises', Array.isArray(teSee.json) && teSee.json.length === 0);
  const ls = await rest('POST', 'logged_sets', ta, { body: { id: 'ls-a-' + stamp, user_id: A.id, session_id: row.id, exercise_id: 'bench-press', exercise_name: 'Bench Press', set_number: 1, weight: 60, reps: 10, rir: 2, side: 'L' } });
  check('A can log a set with rir + side', ls.status === 201, 'HTTP ' + ls.status + ' ' + (ls.text || '').slice(0, 80));
  const badRir = await rest('POST', 'logged_sets', ta, { body: { id: 'ls-bad-' + stamp, user_id: A.id, session_id: row.id, exercise_id: 'bench-press', exercise_name: 'x', set_number: 2, weight: 1, reps: 1, rir: 11 } });
  check('rir above 10 is rejected', badRir.status >= 400, 'HTTP ' + badRir.status);

  // anonymous (not logged in)
  for (const t of ['workout_sessions', 'logged_sets', 'workout_templates', 'template_exercises', 'scheduled_workouts', 'exercises']) {
    const r = await rest('GET', t, null, { query: '?select=*' });
    check(`anonymous CANNOT read ${t}`, r.status >= 400 || (Array.isArray(r.json) && r.json.length === 0), 'HTTP ' + r.status);
  }
  const anonW = await rest('POST', 'exercises', null, { body: { id: 'anon-' + stamp, name: 'x', muscle: 'Chest', category: 'Upper Body' } });
  check('anonymous CANNOT write exercises', anonW.status >= 400, 'HTTP ' + anonW.status + ' ' + (anonW.text || '').slice(0, 60));
  const anonW2 = await rest('POST', 'workout_sessions', null, { body: { id: 'anon-' + stamp, name: 'x', started_at: 1 } });
  check('anonymous CANNOT write workout_sessions', anonW2.status >= 400, 'HTTP ' + anonW2.status);

  await admin('DELETE', '/auth/v1/admin/users/' + A.id); await admin('DELETE', '/auth/v1/admin/users/' + B.id);
  console.log(`\n${pass} passed, ${fail} failed. Test users deleted.`);
  process.exit(fail ? 1 : 0);
})();
