import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { getDb, seedExercises } from '../utils/database';
import { BUILTIN_EXERCISES } from '../constants/exercises';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { UnitProvider } from '../context/UnitContext';
import { syncIfDirty } from '../utils/sync';

function AuthGate() {
  const { user, guest, ready } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const onAuth = segments[0] === 'auth';
  const needsLogin = ready && !user && !guest;

  useEffect(() => {
    if (needsLogin && !onAuth) router.replace('/auth');
  }, [needsLogin, onAuth]);

  if (ready && !needsLogin) return null;
  if (needsLogin && onAuth) return null;
  return (
    <View style={styles.splash} pointerEvents="auto">
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

function SyncWatcher() {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return undefined;
    syncIfDirty();
    const sub = AppState.addEventListener('change', state => { if (state === 'active') syncIfDirty(); });
    return () => sub.remove();
  }, [user]);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    getDb().then(() => seedExercises(BUILTIN_EXERCISES)).catch(console.error);
  }, []);

  return (
    <AuthProvider>
    <UnitProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="auth"
          options={{ presentation: 'modal', animation: 'slide_from_bottom', gestureEnabled: false }}
        />
        <Stack.Screen
          name="active-workout"
          options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="create-template"
          options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="edit-session"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="exercise-detail"
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="settings"
          options={{ animation: 'slide_from_right' }}
        />
      </Stack>
      <AuthGate />
      <SyncWatcher />
    </UnitProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
