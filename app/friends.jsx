import { useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Switch, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, radius, font } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import {
  getMyProfile, saveUsername, setShareProgress, sendFriendRequest, respondToRequest,
  removeFriendship, listFriends, normalizeUsername, USERNAME_RULE,
} from '../utils/social';

export default function FriendsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [friends, setFriends] = useState([]);
  const [nameInput, setNameInput] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [addInput, setAddInput] = useState('');
  const [addMsg, setAddMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    try {
      const p = await getMyProfile();
      setProfile(p);
      setFriends(p ? await listFriends() : []);
    } catch (e) {
      Alert.alert('Could not load', e.message || 'Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function handleSaveName() {
    setBusy(true);
    const res = await saveUsername(nameInput, !!profile);
    setBusy(false);
    if (!res.ok) { setNameMsg(res.message); return; }
    setNameMsg('');
    setEditingName(false);
    setNameInput('');
    await load();
  }

  async function handleAdd() {
    if (!addInput.trim()) return;
    setBusy(true);
    const res = await sendFriendRequest(addInput);
    setBusy(false);
    setAddMsg({ ok: res.ok, text: res.message });
    if (res.ok) { setAddInput(''); await load(); }
  }

  async function handleRespond(f, accept) {
    try { await respondToRequest(f.friendship_id, accept); await load(); }
    catch (e) { Alert.alert('Failed', e.message); }
  }

  function handleRemove(f) {
    const text = f.direction === 'friend' ? `Remove ${f.username} from your friends?` : 'Cancel this request?';
    Alert.alert(f.direction === 'friend' ? 'Remove friend' : 'Cancel request', text, [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', style: 'destructive', onPress: async () => { try { await removeFriendship(f.friendship_id); await load(); } catch (e) { Alert.alert('Failed', e.message); } } },
    ]);
  }

  async function toggleShare(v) {
    setProfile(p => ({ ...p, share_progress: v }));
    try { await setShareProgress(v); } catch (e) { Alert.alert('Failed', e.message); load(); }
  }

  const incoming = friends.filter(f => f.direction === 'incoming');
  const outgoing = friends.filter(f => f.direction === 'outgoing');
  const accepted = friends.filter(f => f.direction === 'friend');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.back}><Ionicons name="arrow-back" size={22} color={colors.textDim} /></TouchableOpacity>
        <Text style={s.title}>Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={s.center}><ActivityIndicator color={colors.accent} /></View>
      ) : !user ? (
        <View style={s.center}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={s.bigText}>Sign in to use friends</Text>
          <Text style={s.dim}>Create an account to pick a username, add friends and compare progress.</Text>
          <TouchableOpacity style={s.primary} onPress={() => router.push('/auth')}><Text style={s.primaryText}>Sign in / Create account</Text></TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          {/* My profile */}
          <View style={s.card}>
            <Text style={s.label}>MY PROFILE</Text>
            {profile && !editingName ? (
              <>
                <View style={s.row}>
                  <Text style={s.username}>@{profile.username}</Text>
                  <TouchableOpacity onPress={() => { setEditingName(true); setNameInput(profile.username); setNameMsg(''); }}>
                    <Text style={s.link}>Change</Text>
                  </TouchableOpacity>
                </View>
                <View style={[s.row, { marginTop: spacing.md }]}>
                  <View style={{ flex: 1, paddingRight: spacing.md }}>
                    <Text style={s.rowTitle}>Share my progress with friends</Text>
                    <Text style={s.dim}>Friends see totals, top lifts and recent workouts. Never your notes.</Text>
                  </View>
                  <Switch value={profile.share_progress} onValueChange={toggleShare}
                    trackColor={{ false: colors.bg3, true: colors.accent + '99' }} thumbColor={profile.share_progress ? colors.accent : colors.textDim} />
                </View>
              </>
            ) : (
              <>
                <Text style={s.dim}>{profile ? 'Pick a new username.' : 'Choose a username so friends can find you. It must be unique.'}</Text>
                <TextInput style={s.input} value={nameInput} onChangeText={t => { setNameInput(t); setNameMsg(''); }} autoCapitalize="none" autoCorrect={false}
                  placeholder="username" placeholderTextColor={colors.textMuted} maxLength={21} />
                <Text style={s.hint}>{USERNAME_RULE}</Text>
                {nameMsg ? <Text style={s.error}>{nameMsg}</Text> : null}
                <View style={s.row}>
                  <TouchableOpacity style={[s.primary, { flex: 1 }, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleSaveName}>
                    <Text style={s.primaryText}>{profile ? 'Save username' : 'Claim username'}</Text>
                  </TouchableOpacity>
                  {profile ? (
                    <TouchableOpacity style={{ paddingHorizontal: spacing.md }} onPress={() => { setEditingName(false); setNameMsg(''); }}>
                      <Text style={s.link}>Cancel</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              </>
            )}
          </View>

          {profile ? (
            <>
              {/* Add a friend */}
              <View style={s.card}>
                <Text style={s.label}>ADD A FRIEND</Text>
                <View style={s.row}>
                  <TextInput style={[s.input, { flex: 1, marginTop: 0 }]} value={addInput} onChangeText={t => { setAddInput(t); setAddMsg(null); }} autoCapitalize="none" autoCorrect={false}
                    placeholder="their username" placeholderTextColor={colors.textMuted} maxLength={21} onSubmitEditing={handleAdd} />
                  <TouchableOpacity style={[s.sendBtn, busy && { opacity: 0.6 }]} disabled={busy} onPress={handleAdd}>
                    <Ionicons name="person-add" size={18} color={colors.white} />
                  </TouchableOpacity>
                </View>
                {addMsg ? <Text style={[s.hint, { color: addMsg.ok ? colors.success : colors.danger, marginTop: spacing.sm }]}>{addMsg.text}</Text> : null}
              </View>

              {incoming.length > 0 && (
                <View style={s.card}>
                  <Text style={s.label}>FRIEND REQUESTS</Text>
                  {incoming.map(f => (
                    <View key={f.friendship_id} style={s.listRow}>
                      <Text style={s.rowTitle}>@{f.username}</Text>
                      <View style={s.row}>
                        <TouchableOpacity style={s.accept} onPress={() => handleRespond(f, true)}><Text style={s.acceptText}>Accept</Text></TouchableOpacity>
                        <TouchableOpacity style={s.decline} onPress={() => handleRespond(f, false)}><Text style={s.declineText}>Decline</Text></TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={s.card}>
                <Text style={s.label}>MY FRIENDS ({accepted.length})</Text>
                {accepted.length === 0 ? <Text style={s.dim}>No friends yet. Add someone by their username above.</Text> : null}
                {accepted.map(f => (
                  <TouchableOpacity key={f.friendship_id} style={s.listRow} onPress={() => router.push({ pathname: '/friend', params: { id: f.friend_id, username: f.username } })}>
                    <Text style={s.rowTitle}>@{f.username}</Text>
                    <View style={s.row}>
                      <Text style={s.link}>View progress</Text>
                      <TouchableOpacity onPress={() => handleRemove(f)} hitSlop={8} style={{ marginLeft: spacing.md }}>
                        <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                ))}
                {outgoing.map(f => (
                  <View key={f.friendship_id} style={s.listRow}>
                    <Text style={[s.rowTitle, { color: colors.textDim }]}>@{f.username}</Text>
                    <View style={s.row}>
                      <Text style={s.dim}>Request sent</Text>
                      <TouchableOpacity onPress={() => handleRemove(f)} hitSlop={8} style={{ marginLeft: spacing.md }}>
                        <Ionicons name="close-circle-outline" size={20} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 40, padding: 4 },
  title: { fontSize: font.md, fontWeight: '700', color: colors.text },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  bigText: { fontSize: font.xl, fontWeight: '700', color: colors.textDim, textAlign: 'center' },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: 80 },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm },
  label: { fontSize: font.xs, fontWeight: '700', color: colors.textDim, letterSpacing: 0.8, marginBottom: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  username: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  rowTitle: { fontSize: font.base, fontWeight: '600', color: colors.text },
  dim: { fontSize: font.sm, color: colors.textMuted, lineHeight: 18 },
  hint: { fontSize: font.xs, color: colors.textMuted },
  error: { fontSize: font.sm, color: colors.danger },
  link: { fontSize: font.sm, color: colors.accent, fontWeight: '700' },
  input: { backgroundColor: colors.bg3, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, color: colors.text, padding: spacing.md, fontSize: font.base, marginTop: spacing.sm },
  primary: { backgroundColor: colors.accent, borderRadius: radius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  primaryText: { color: colors.white, fontWeight: '700', fontSize: font.base },
  sendBtn: { width: 46, height: 46, borderRadius: radius.md, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  listRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm + 2, borderTopWidth: 1, borderTopColor: colors.borderDim },
  accept: { backgroundColor: colors.success + '26', borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  acceptText: { color: colors.success, fontWeight: '700', fontSize: font.sm },
  decline: { borderRadius: radius.full, paddingHorizontal: spacing.md, paddingVertical: 6 },
  declineText: { color: colors.textMuted, fontWeight: '600', fontSize: font.sm },
});
