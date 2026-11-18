import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking, Modal } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import { APP_VERSION } from '../constants/version';
import { colors, spacing, radius, font } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { uploadLocalData } from '../utils/sync';
import { getSetting, setSetting } from '../utils/database';

const GITHUB_RELEASES_API = 'https://api.github.com/repos/Ben-Worrall/MobileWorkout/releases/latest';
const WEBSITE_URL = 'https://ben-worrall.github.io/MobileWorkout/';

const REST_OPTIONS = [
  { label: '30 sec', value: 30 },
  { label: '1 min', value: 60 },
  { label: '1:30', value: 90 },
  { label: '2 min', value: 120 },
  { label: '3 min', value: 180 },
  { label: '5 min', value: 300 },
];

function restLabel(secs) {
  const opt = REST_OPTIONS.find(o => o.value === secs);
  if (opt) return opt.label;
  const m = Math.floor(secs / 60);
  const sec = secs % 60;
  return sec === 0 ? `${m} min` : `${m}:${String(sec).padStart(2, '0')}`;
}

function SettingsRow({ icon, iconColor, label, value, onPress, rightEl }) {
  return (
    <TouchableOpacity style={s.row} onPress={onPress} disabled={!onPress}>
      <View style={[s.rowIcon, { backgroundColor: (iconColor || colors.accent) + '1a' }]}>
        <Ionicons name={icon} size={18} color={iconColor || colors.accent} />
      </View>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.rowRight}>
        {value ? <Text style={s.rowValue}>{value}</Text> : null}
        {rightEl || null}
        {onPress && !rightEl ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function Settings() {
  const { user, signOut } = useAuth();
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [upToDate, setUpToDate] = useState(false);
  const [restDuration, setRestDuration] = useState(90);
  const [showRestPicker, setShowRestPicker] = useState(false);

  useEffect(() => {
    getSetting('rest_duration', '90').then(v => setRestDuration(parseInt(v) || 90));
  }, []);

  async function handleSetRest(secs) {
    await setSetting('rest_duration', String(secs));
    setRestDuration(secs);
    setShowRestPicker(false);
  }

  async function checkForUpdates() {
    setChecking(true);
    setUpToDate(false);
    setUpdateInfo(null);
    try {
      const res = await fetch(GITHUB_RELEASES_API, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      const tag = (data.tag_name || '').replace(/^v/, '');
      const apkAsset = (data.assets || []).find(a =>
        a.name.endsWith('.apk') && a.browser_download_url
      );
      const newer = tag.split('.').map(Number).reduce((r, n, i) => r || Math.sign(n - (Number(APP_VERSION.split('.')[i]) || 0)), 0) > 0;
      if (!newer) {
        setUpToDate(true);
      } else if (apkAsset) {
        setUpdateInfo({ version: tag, apkUrl: apkAsset.browser_download_url });
      } else {
        setUpdateInfo({ version: tag, apkUrl: null });
      }
    } catch {
      Alert.alert('Update check failed', 'Could not reach GitHub. Check your internet connection.');
    } finally {
      setChecking(false);
    }
  }

  async function downloadAndInstall() {
    if (!updateInfo?.apkUrl) {
      Linking.openURL(WEBSITE_URL);
      return;
    }

    setDownloading(true);
    setDownloadProgress(0);

    try {
      const dest = FileSystem.documentDirectory + 'GymNote-update.apk';
      const info = await FileSystem.getInfoAsync(dest);
      if (info.exists) await FileSystem.deleteAsync(dest, { idempotent: true });

      const download = FileSystem.createDownloadResumable(
        updateInfo.apkUrl,
        dest,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setDownloadProgress(totalBytesWritten / totalBytesExpectedToWrite);
          }
        }
      );

      const result = await download.downloadAsync();
      if (!result?.uri) throw new Error('Download failed');

      // Android 7+ requires content:// URI for install intents, not file://
      const contentUri = await FileSystem.getContentUriAsync(result.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1,
        type: 'application/vnd.android.package-archive',
      });
    } catch (e) {
      Alert.alert('Download failed', 'Could not download the update. Try again or visit the website.', [
        { text: 'Open Website', onPress: () => Linking.openURL(WEBSITE_URL) },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } finally {
      setDownloading(false);
      setDownloadProgress(0);
    }
  }

  const checkLabel = checking
    ? 'Checking...'
    : upToDate
    ? 'Up to date ✓'
    : updateInfo
    ? `v${updateInfo.version} available`
    : undefined;

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.textDim} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* WORKOUT */}
        <Text style={s.sectionLabel}>WORKOUT</Text>
        <View style={s.section}>
          <SettingsRow
            icon="timer-outline"
            label="Rest Timer"
            value={restLabel(restDuration)}
            iconColor={colors.accent}
            onPress={() => setShowRestPicker(true)}
          />
        </View>

        {/* APP */}
        <Text style={s.sectionLabel}>APP</Text>
        <View style={s.section}>
          <SettingsRow icon="information-circle-outline" label="Version" value={APP_VERSION} />
          <View style={s.separator} />
          <SettingsRow
            icon="cloud-download-outline"
            label="Check for Updates"
            value={checkLabel}
            iconColor={updateInfo ? colors.success : upToDate ? colors.success : colors.accent}
            onPress={checking ? undefined : checkForUpdates}
          />
        </View>

        {/* Update banner */}
        {updateInfo && (
          <View style={s.updateBanner}>
            <View style={s.updateBannerTop}>
              <View style={s.updateBannerLeft}>
                <Ionicons name="arrow-up-circle" size={22} color={colors.success} />
                <View>
                  <Text style={s.updateBannerTitle}>Update available — v{updateInfo.version}</Text>
                  <Text style={s.updateBannerSub}>
                    {updateInfo.apkUrl ? 'Downloads and installs automatically' : 'Opens the download page'}
                  </Text>
                </View>
              </View>
            </View>

            {downloading ? (
              <View style={s.progressWrap}>
                <View style={s.progressBar}>
                  <View style={[s.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                </View>
                <Text style={s.progressText}>{Math.round(downloadProgress * 100)}% downloading...</Text>
              </View>
            ) : (
              <TouchableOpacity style={s.installBtn} onPress={downloadAndInstall}>
                <Ionicons name={updateInfo.apkUrl ? 'download' : 'open-outline'} size={16} color={colors.white} />
                <Text style={s.installBtnText}>
                  {updateInfo.apkUrl ? 'Download & Install' : 'Open Website'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* ACCOUNT */}
        <Text style={s.sectionLabel}>ACCOUNT</Text>
        <View style={s.section}>
          {user ? (
            <>
              <SettingsRow
                icon="person-circle-outline"
                label="Signed in as"
                value={user.email}
                iconColor={colors.accent}
              />
              <View style={s.separator} />
              <SettingsRow
                icon="cloud-upload-outline"
                label="Sync local data"
                iconColor={colors.success}
                onPress={async () => {
                  try {
                    await uploadLocalData();
                    Alert.alert('Synced', 'Your workouts have been uploaded to your account.');
                  } catch (e) {
                    Alert.alert('Sync failed', e.message);
                  }
                }}
              />
              <View style={s.separator} />
              <SettingsRow
                icon="log-out-outline"
                label="Sign Out"
                iconColor={colors.danger}
                onPress={() =>
                  Alert.alert('Sign Out', 'Your data stays on this device.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
                  ])
                }
              />
            </>
          ) : (
            <SettingsRow
              icon="log-in-outline"
              label="Sign In / Create Account"
              iconColor={colors.accent}
              onPress={() => router.push('/auth')}
            />
          )}
        </View>

        {/* ABOUT */}
        <Text style={s.sectionLabel}>ABOUT</Text>
        <View style={s.section}>
          <SettingsRow
            icon="globe-outline"
            label="Website"
            value="Gym Note"
            iconColor={colors.accent}
            onPress={() => Linking.openURL(WEBSITE_URL)}
          />
          <View style={s.separator} />
          <SettingsRow
            icon="logo-github"
            label="Source Code"
            value="GitHub"
            iconColor={colors.textDim}
            onPress={() => Linking.openURL('https://github.com/Ben-Worrall/MobileWorkout')}
          />
        </View>

      </ScrollView>

      {/* Rest timer picker */}
      <Modal visible={showRestPicker} transparent animationType="slide" onRequestClose={() => setShowRestPicker(false)}>
        <TouchableOpacity style={s.pickerOverlay} activeOpacity={1} onPress={() => setShowRestPicker(false)}>
          <View style={s.pickerSheet}>
            <View style={s.pickerHandle} />
            <Text style={s.pickerTitle}>Rest Timer Duration</Text>
            {REST_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={s.pickerOption}
                onPress={() => handleSetRest(opt.value)}
              >
                <Text style={[s.pickerOptionText, restDuration === opt.value && s.pickerOptionTextActive]}>
                  {opt.label}
                </Text>
                {restDuration === opt.value && (
                  <Ionicons name="checkmark" size={18} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: font.lg, fontWeight: '700', color: colors.text },
  scroll: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: 100, gap: spacing.sm },
  sectionLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, paddingLeft: spacing.xs, marginTop: spacing.sm },
  section: { backgroundColor: colors.bgCard, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  separator: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 36 + spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md },
  rowIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, fontSize: font.base, fontWeight: '500', color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowValue: { fontSize: font.sm, color: colors.textDim },
  updateBanner: {
    backgroundColor: colors.success + '12', borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.success + '44',
    padding: spacing.md, gap: spacing.md,
  },
  updateBannerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  updateBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  updateBannerTitle: { fontSize: font.base, fontWeight: '700', color: colors.success },
  updateBannerSub: { fontSize: font.sm, color: colors.success + 'bb', marginTop: 2 },
  installBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.success, borderRadius: radius.full, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  installBtnText: { color: colors.white, fontWeight: '700', fontSize: font.base },
  progressWrap: { gap: spacing.xs },
  progressBar: { height: 6, backgroundColor: colors.bg3, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 6, backgroundColor: colors.success, borderRadius: radius.full },
  progressText: { fontSize: font.sm, color: colors.success, textAlign: 'center' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: colors.bg2, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  pickerHandle: { width: 36, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  pickerTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  pickerOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.borderDim },
  pickerOptionText: { fontSize: font.base, color: colors.textDim, fontWeight: '500' },
  pickerOptionTextActive: { color: colors.accent, fontWeight: '700' },
});
