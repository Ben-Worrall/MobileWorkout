#!/usr/bin/env node
// Verifies the friends feature rules against the live Supabase project.
// Usage: SUPABASE_SERVICE_KEY=sb_secret_... node scripts/friends-test.js   (creates and deletes its own test users)
const URL = 'https://shrawyvdtfrccroetnxy.supabase.co';
const ANON = 'sb_publishable_ELZL-cFF_0FBVFn5i--Kzg_G4Lz5S_B';
const SVC = process.env.SUPABASE_SERVICE_KEY;
if (!SVC) { console.error('Set SUPABASE_SERVICE_KEY first.'); process.exit(2); }
let pass = 0, fail = 0;
const check = (name, ok, extra = '') => { ok ? pass++ : fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : '')); };

const admin = async (method, path, body) => {
  const r = await fetch(URL + path, { method, headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body) });
  return r.json().catch(() => ({}));
};
const login = async (email, password) => {
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return (await r.json()).access_token;
};
const call = async (token, method, path, body, prefer) => {
  const headers = { apikey: ANON, Authorization: 'Bearer ' + (token || ANON), 'Content-Type': 'application/json' };
  if (prefer) headers.Prefer = prefer;
  const r = await fetch(URL + '/rest/v1/' + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, text };
};
const rpc = (token, fn, args = {}) => call(token, 'POST', 'rpc/' + fn, args);

(async () => {
  const s = Date.now(), users = [];
  const mk = async tag => {
    const u = await admin('POST', '/auth/v1/admin/users', { email: `ft.${tag}.${s}@example.com`, password: 'FriendTest-1234', email_confirm: true });
    users.push(u.id);
    return { id: u.id, token: await login(u.email, 'FriendTest-1234') };
  };
  const A = await mk('a'), B = await mk('b'), C = await mk('c');
  const nameA = 'ft_alice_' + String(s).slice(-6), nameB = 'ft_bob_' + String(s).slice(-6);

  // usernames
  let r = await call(A.token, 'POST', 'profiles', { user_id: A.id, username: nameA }, 'return=minimal');
  check('A can claim a username', r.status === 201, 'HTTP ' + r.status);
  r = await call(B.token, 'POST', 'profiles', { user_id: B.id, username: nameA.toUpperCase().replace('FT_', 'ft_') });
  check('username must be lowercase (format rule)', r.status >= 400, 'HTTP ' + r.status);
  r = await call(B.token, 'POST', 'profiles', { user_id: B.id, username: nameA });
  check('B CANNOT take A\'s exact username', r.status === 409, 'HTTP ' + r.status);
  r = await call(B.token, 'POST', 'profiles', { user_id: B.id, username: 'x' });
  check('too-short username rejected', r.status >= 400, 'HTTP ' + r.status);
  r = await call(B.token, 'POST', 'profiles', { user_id: A.id, username: 'ft_spoof_' + s });
  check('B CANNOT create a profile for A', r.status >= 400, 'HTTP ' + r.status);
  r = await call(B.token, 'POST', 'profiles', { user_id: B.id, username: nameB });
  check('B can claim a different username', r.status === 201, 'HTTP ' + r.status);
  const chk = await call(A.token, 'PATCH', `profiles?user_id=eq.${A.id}`, { username: nameB });
  check('A CANNOT rename to B\'s username (case-insensitive unique)', chk.status === 409, 'HTTP ' + chk.status);

  // requests
  r = await rpc(C.token, 'send_friend_request', { p_username: nameA });
  check('user with no username must claim one first', r.json === 'need_username', String(r.json));
  r = await rpc(A.token, 'send_friend_request', { p_username: 'nobody_' + s });
  check('unknown username -> not_found', r.json === 'not_found', String(r.json));
  r = await rpc(A.token, 'send_friend_request', { p_username: nameA });
  check('cannot friend yourself', r.json === 'self', String(r.json));
  r = await rpc(A.token, 'send_friend_request', { p_username: nameB.toUpperCase() });
  check('A can request B (username match ignores case)', r.json === 'sent', String(r.json));
  r = await rpc(A.token, 'send_friend_request', { p_username: nameB });
  check('duplicate request -> already_sent', r.json === 'already_sent', String(r.json));
  r = await call(A.token, 'POST', 'friendships', { requester: A.id, addressee: C.id, status: 'accepted' });
  check('cannot insert a friendship directly', r.status >= 400, 'HTTP ' + r.status);

  const fB = (await rpc(B.token, 'my_friends')).json || [];
  check('B sees the incoming request from A', fB.length === 1 && fB[0].direction === 'incoming' && fB[0].username === nameA);
  const fid = fB[0] && fB[0].friendship_id;
  r = await call(A.token, 'PATCH', `friendships?id=eq.${fid}`, { status: 'accepted' }, 'return=representation');
  check('A CANNOT accept their own request', !(Array.isArray(r.json) && r.json.length), 'HTTP ' + r.status);
  r = await rpc(A.token, 'friend_overview', { p_friend: B.id });
  check('no progress visible before accepting', r.json && r.json.error === 'not_friends', JSON.stringify(r.json));
  r = await rpc(C.token, 'respond_friend_request', { p_id: fid, p_accept: true });
  check('third party CANNOT accept B\'s request', r.json === 'not_found', String(r.json));
  r = await rpc(B.token, 'respond_friend_request', { p_id: fid, p_accept: true });
  check('B accepts', r.json === 'ok', String(r.json));
  const fA = (await rpc(A.token, 'my_friends')).json || [];
  check('A now lists B as a friend', fA.length === 1 && fA[0].direction === 'friend' && fA[0].username === nameB);

  // progress sharing: give B a finished workout
  const day = 86400000, t0 = Date.now() - 3 * day;
  await admin('POST', '/rest/v1/workout_sessions', { id: 'ft-s-' + s, user_id: B.id, name: 'Push', started_at: t0, finished_at: t0 + 3600000 });
  await fetch(URL + '/rest/v1/logged_sets', { method: 'POST', headers: { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' },
    body: JSON.stringify([{ id: 'ft-l1-' + s, user_id: B.id, session_id: 'ft-s-' + s, exercise_id: 'bench-press', exercise_name: 'Bench Press', set_number: 1, weight: 80, reps: 8, rir: 2 },
                          { id: 'ft-l2-' + s, user_id: B.id, session_id: 'ft-s-' + s, exercise_id: 'bench-press', exercise_name: 'Bench Press', set_number: 2, weight: 80, reps: 7, rir: 1 }]) });
  r = await rpc(A.token, 'friend_overview', { p_friend: B.id });
  check('A sees B\'s overview', r.json && r.json.username === nameB && Number(r.json.workouts_30) === 1, JSON.stringify(r.json).slice(0, 90));
  check('overview has top lift 80 kg', r.json && r.json.top_lifts && r.json.top_lifts[0] && Number(r.json.top_lifts[0].max_weight) === 80);
  check('overview has recent session with volume 1200', r.json && r.json.recent_sessions && Number(r.json.recent_sessions[0].volume) === 1200 && Number(r.json.recent_sessions[0].sets) === 2);
  r = await rpc(A.token, 'friend_muscle_weeks', { p_friend: B.id, p_days: 90 });
  check('muscle weeks group bench press under Chest', Array.isArray(r.json) && r.json.some(x => x.muscle === 'Chest' && Number(x.sets) === 2 && Number(x.hard_sets) === 2), JSON.stringify(r.json).slice(0, 100));
  r = await call(A.token, 'GET', 'workout_sessions?select=id');
  check('friend still has NO direct row access to B\'s workouts', Array.isArray(r.json) && r.json.length === 0);
  r = await rpc(C.token, 'friend_overview', { p_friend: B.id });
  check('non-friend C cannot see B', r.json && r.json.error === 'not_friends', JSON.stringify(r.json));
  r = await rpc(C.token, 'friend_muscle_weeks', { p_friend: B.id });
  check('non-friend C gets no muscle data', Array.isArray(r.json) && r.json.length === 0);

  // privacy toggle
  await call(B.token, 'PATCH', `profiles?user_id=eq.${B.id}`, { share_progress: false });
  r = await rpc(A.token, 'friend_overview', { p_friend: B.id });
  check('share_progress=false hides progress from friends', r.json && r.json.error === 'not_shared', JSON.stringify(r.json));
  r = await rpc(A.token, 'friend_muscle_weeks', { p_friend: B.id });
  check('share_progress=false hides muscle data too', Array.isArray(r.json) && r.json.length === 0);

  // anonymous
  for (const fn of ['my_friends', 'send_friend_request', 'friend_overview', 'friend_muscle_weeks', 'respond_friend_request', 'are_friends']) {
    r = await rpc(null, fn, {});
    check(`anonymous cannot call ${fn}`, r.status === 401 || r.status === 403 || r.status === 404, 'HTTP ' + r.status);
  }
  for (const t of ['profiles', 'friendships', 'exercise_catalog']) {
    r = await call(null, 'GET', t + '?select=*');
    check(`anonymous cannot read ${t}`, r.status === 401 || r.status === 403, 'HTTP ' + r.status);
  }
  r = await call(C.token, 'GET', 'profiles?select=username');
  check('C cannot list other people\'s profiles', Array.isArray(r.json) && r.json.length === 0);

  // unfriend
  r = await call(A.token, 'DELETE', `friendships?id=eq.${fid}`, undefined, 'return=representation');
  check('A can unfriend', Array.isArray(r.json) && r.json.length === 1);
  r = await rpc(A.token, 'friend_overview', { p_friend: B.id });
  check('after unfriending, access is gone', r.json && r.json.error === 'not_friends');

  for (const id of users) await admin('DELETE', '/auth/v1/admin/users/' + id);
  console.log(`\n${pass} passed, ${fail} failed. Test users deleted.`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
