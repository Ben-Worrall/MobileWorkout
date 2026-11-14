import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '../constants/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="active-workout" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="workout-detail" />
      </Stack>
    </>
  );
}
