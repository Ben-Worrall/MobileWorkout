import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system';
import { colors, spacing, radius, font } from '../constants/theme';

const APP_VERSION = '1.0.0';
const GITHUB_RELEASES_API = 'https://api.github.com/repos/Ben-Worrall/MobileWorkout/releases/latest';
const WEBSITE_URL = 'https://ben-worrall.github.io/MobileWorkout/';

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
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateInfo, setUpdateInfo] = useState(null); // { version, apkUrl } | null
  const [upToDate, setUpToDate] = useState(false);

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

      // Find the APK asset in the release
      const apkAsset = (data.assets || []).find(a =>
        a.name.endsWith('.apk') && a.browser_download_url
      );

      if (tag === APP_VERSION) {
        setUpToDate(true);
      } else if (apkAsset) {
        setUpdateInfo({ version: tag, apkUrl: apkAsset.browser_download_url });
      } else {
        // No APK attached yet — open releases page
        setUpdateInfo({ version: tag, apkUrl: null });
      }
    } catch (e) {
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

      // Delete old download if exists
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

      // Open the APK — Android will prompt "Install this app?"
      // Uses content:// URI via Linking; Android handles the install intent
      await Linking.openURL(result.uri);
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

        {/* DATA */}
        <Text style={s.sectionLabel}>DATA</Text>
        <View style={s.section}>
          <SettingsRow
            icon="cloud-upload-outline"
            label="Cloud Sync"
            value="Coming soon"
            iconColor={colors.textMuted}
          />
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
});
