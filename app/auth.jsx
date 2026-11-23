import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors, spacing, radius, font } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { syncAfterLogin } from '../utils/sync';

export default function AuthScreen() {
  const [tab, setTab] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, continueAsGuest, user, guest } = useAuth();
  const isGate = !user && !guest;

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  async function handleGuest() {
    await continueAsGuest();
    leave();
  }

  async function handleSubmit() {
    const e = email.trim();
    const p = password.trim();
    if (!e || !p) { Alert.alert('Enter email and password'); return; }
    if (p.length < 6) { Alert.alert('Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
      if (tab === 'login') {
        await signIn(e, p);
        try {
          await syncAfterLogin();
        } catch (syncErr) {
          console.warn('[auth] sync after login failed:', syncErr.message);
          Alert.alert('Signed in', 'You are signed in, but syncing your workouts failed. Open Settings and tap Sync now to try again.');
        }
        leave();
      } else {
        const data = await signUp(e, p);
        if (!data.session) {
          Alert.alert(
            'Confirm your email',
            'We sent a confirmation link to your email. Open it, then come back and log in.',
          );
          setTab('login');
          return;
        }
        await syncAfterLogin();
        Alert.alert('Account created!', 'Your workouts are now backed up to your account.', [
          { text: 'OK', onPress: leave },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          <View style={s.logoRow}>
            <Ionicons name="barbell" size={40} color={colors.accent} />
            <Text style={s.appName}>Gym Note</Text>
          </View>

          <View style={s.tabRow}>
            <TouchableOpacity
              style={[s.tab, tab === 'login' && s.tabActive]}
              onPress={() => setTab('login')}
            >
              <Text style={[s.tabText, tab === 'login' && s.tabTextActive]}>Log In</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, tab === 'signup' && s.tabActive]}
              onPress={() => setTab('signup')}
            >
              <Text style={[s.tabText, tab === 'signup' && s.tabTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          <View style={s.form}>
            <View style={s.inputWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            <View style={s.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Password"
                placeholderTextColor={colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
              />
              <TouchableOpacity onPress={() => setShowPass(v => !v)} style={s.eyeBtn}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.submitBtn} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color={colors.white} />
                : <Text style={s.submitText}>{tab === 'login' ? 'Log In' : 'Create Account'}</Text>
              }
            </TouchableOpacity>

            {tab === 'signup' && (
              <Text style={s.hint}>Your existing workouts will be synced to your new account.</Text>
            )}
          </View>

          {isGate && (
            <View style={s.guestBox}>
              <TouchableOpacity style={s.guestBtn} onPress={handleGuest}>
                <Text style={s.guestText}>Continue without an account</Text>
              </TouchableOpacity>
              <Text style={s.hint}>
                Your workouts are saved on this device only. They stay when you update the app,
                but are lost if you uninstall it. You can sign in later from Settings.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  logoRow: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl },
  appName: { fontSize: font.xxxl, fontWeight: '800', color: colors.text },
  tabRow: { flexDirection: 'row', backgroundColor: colors.bg2, borderRadius: radius.lg, padding: 4 },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md, alignItems: 'center' },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: font.base, fontWeight: '600', color: colors.textDim },
  tabTextActive: { color: colors.white },
  form: { gap: spacing.md },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  inputIcon: { paddingLeft: spacing.md },
  input: { flex: 1, color: colors.text, fontSize: font.base, padding: spacing.md },
  eyeBtn: { padding: spacing.md },
  submitBtn: { backgroundColor: colors.accent, borderRadius: radius.full, padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  submitText: { color: colors.white, fontWeight: '700', fontSize: font.base },
  guestBox: { gap: spacing.md, alignItems: 'center' },
  guestBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, alignSelf: 'stretch', alignItems: 'center', backgroundColor: colors.bg2 },
  guestText: { color: colors.text, fontWeight: '600', fontSize: font.base },
  hint: { textAlign: 'center', color: colors.textMuted, fontSize: font.sm, lineHeight: 18 },
});
