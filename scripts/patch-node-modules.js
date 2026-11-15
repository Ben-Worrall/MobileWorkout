#!/usr/bin/env node
// Re-applies patches to node_modules that are needed for SDK 51 builds.
// expo-font and expo-constants are missing useCoreDependencies() which causes
// "Could not find method useCoreDependencies()" build errors.
const fs = require('fs');
const path = require('path');

const patches = [
  'expo-font/android/build.gradle',
  'expo-constants/android/build.gradle',
];

for (const rel of patches) {
  const file = path.join(__dirname, '..', 'node_modules', rel);
  if (!fs.existsSync(file)) continue;
  let src = fs.readFileSync(file, 'utf8');
  if (src.includes('useCoreDependencies()')) continue; // already patched
  src = src.replace('applyKotlinExpoModulesCorePlugin()', 'applyKotlinExpoModulesCorePlugin()\nuseCoreDependencies()');
  if (!src.includes('useCoreDependencies()')) {
    console.warn(`[patch] Could not apply patch to ${rel}`);
    continue;
  }
  fs.writeFileSync(file, src);
  console.log(`[patch] Patched ${rel}`);
}
