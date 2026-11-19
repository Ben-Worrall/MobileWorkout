import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';
import { getDb, seedExercises } from '../utils/database';
import { BUILTIN_EXERCISES } from '../constants/exercises';
import { AuthProvider, useAuth } from '../context/AuthContext';

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

export default function RootLayout() {
  useEffect(() => {
    getDb().then(() => seedExercises(BUILTIN_EXERCISES)).catch(console.error);
  }, []);

  return (
    <AuthProvider>
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
