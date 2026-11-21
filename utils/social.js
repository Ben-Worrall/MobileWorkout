import { supabase } from './supabase';

export const USERNAME_RULE = '3-20 characters: lowercase letters, numbers and underscores';
export const normalizeUsername = s => String(s || '').trim().toLowerCase().replace(/^@/, '');
export const isValidUsername = s => /^[a-z0-9_]{3,20}$/.test(s);

async function uid() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}

export async function getMyProfile() {
  const id = await uid();
  const { data, error } = await supabase.from('profiles').select('username, share_progress').eq('user_id', id).maybeSingle();
  if (error) throw error;
  return data; // null when no username claimed yet
}

// Returns { ok: true } or { ok: false, error: 'invalid' | 'taken' | 'failed', message }
export async function saveUsername(raw, hasProfile) {
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) return { ok: false, error: 'invalid', message: `Username must be ${USERNAME_RULE}.` };
  const id = await uid();
  const q = hasProfile
    ? supabase.from('profiles').update({ username }).eq('user_id', id)
    : supabase.from('profiles').insert({ user_id: id, username });
  const { error } = await q;
  if (error) {
    if (error.code === '23505') return { ok: false, error: 'taken', message: `"${username}" is already taken. Try another.` };
    return { ok: false, error: 'failed', message: error.message };
  }
  return { ok: true, username };
}

export async function setShareProgress(share) {
  const id = await uid();
  const { error } = await supabase.from('profiles').update({ share_progress: share }).eq('user_id', id);
  if (error) throw error;
}

const REQUEST_MESSAGES = {
  sent: 'Friend request sent.',
  accepted: 'You are now friends!',
  already_friends: 'You are already friends.',
  already_sent: 'You already sent them a request.',
  not_found: 'No user with that username.',
  self: 'That is your own username.',
  need_username: 'Choose your own username first.',
};

export async function sendFriendRequest(raw) {
  const username = normalizeUsername(raw);
  if (!isValidUsername(username)) return { ok: false, message: `Usernames are ${USERNAME_RULE}.` };
  const { data, error } = await supabase.rpc('send_friend_request', { p_username: username });
  if (error) return { ok: false, message: error.message };
  return { ok: data === 'sent' || data === 'accepted', code: data, message: REQUEST_MESSAGES[data] || String(data) };
}

export async function respondToRequest(friendshipId, accept) {
  const { error } = await supabase.rpc('respond_friend_request', { p_id: friendshipId, p_accept: accept });
  if (error) throw error;
}

export async function removeFriendship(friendshipId) {
  const { error } = await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function listFriends() {
  const { data, error } = await supabase.rpc('my_friends');
  if (error) throw error;
  return data || [];
}

export async function getFriendOverview(friendId) {
  const { data, error } = await supabase.rpc('friend_overview', { p_friend: friendId });
  if (error) throw error;
  return data;
}

export async function getFriendMuscleWeeks(friendId, days = 90) {
  const { data, error } = await supabase.rpc('friend_muscle_weeks', { p_friend: friendId, p_days: days });
  if (error) throw error;
  return (data || []).map(r => ({ ...r, volume: Number(r.volume) || 0, sets: Number(r.sets) || 0, hard_sets: Number(r.hard_sets) || 0 }));
}
