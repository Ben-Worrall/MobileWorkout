const { withSettingsGradle, withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

function withGradleWrapperFix(config) {
  return withDangerousMod(config, [
    'android',
    async (mod) => {
      const wrapperPath = path.join(
        mod.modRequest.platformProjectRoot,
        'gradle', 'wrapper', 'gradle-wrapper.properties'
      );
      if (fs.existsSync(wrapperPath)) {
        let contents = fs.readFileSync(wrapperPath, 'utf8');
        contents = contents.replace(
          /distributionUrl=.*gradle-.*\.zip/,
          'distributionUrl=https\\://services.gradle.org/distributions/gradle-8.3-all.zip'
        );
        fs.writeFileSync(wrapperPath, contents, 'utf8');
      }
      return mod;
    },
  ]);
}

function withSettingsGradleFix(config) {
  return withSettingsGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Fix 1: Add repositories to pluginManagement so AGP and other plugins can be found
    if (!contents.includes('repositories {') && contents.includes('pluginManagement {')) {
      contents = contents.replace(
        'pluginManagement {',
        'pluginManagement {\n  repositories {\n    google()\n    mavenCentral()\n    gradlePluginPortal()\n  }'
      );
    }

    // Fix 2: Replace Windows-incompatible array.execute() for @react-native/gradle-plugin (in pluginManagement)
    contents = contents.replace(
      `includeBuild(new File(["node", "--print", "require.resolve('@react-native/gradle-plugin/package.json')"].execute(null, rootDir).text.trim()).getParentFile().toString())`,
      `includeBuild(new File(rootDir, "../node_modules/@react-native/gradle-plugin").canonicalPath)`
    );

    // Fix 3: Replace Windows-incompatible array.execute() in dependencyResolutionManagement (react-native libs.versions.toml)
    contents = contents.replace(
      `from(files(new File(["node", "--print", "require.resolve('react-native/package.json')"].execute(null, rootDir).text.trim(), "../gradle/libs.versions.toml")))`,
      `from(files(new File(rootDir, "../node_modules/react-native/gradle/libs.versions.toml")))`
    );

    // Fix 4: Replace Windows-incompatible array.execute() for expo autolinking.gradle apply
    contents = contents.replace(
      `apply from: new File(["node", "--print", "require.resolve('expo/package.json')"].execute(null, rootDir).text.trim(), "../scripts/autolinking.gradle");`,
      `apply from: new File(rootDir, "../node_modules/expo/scripts/autolinking.gradle");`
    );

    // Fix 5: Replace Windows-incompatible array.execute() for @react-native-community/cli-platform-android
    contents = contents.replace(
      `apply from: new File(["node", "--print", "require.resolve('@react-native-community/cli-platform-android/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim(), "../native_modules.gradle");`,
      `apply from: new File(rootDir, "../node_modules/@react-native-community/cli-platform-android/native_modules.gradle");`
    );

    // Fix 6: Replace Windows-incompatible array.execute() for @react-native/gradle-plugin (at bottom of file)
    contents = contents.replace(
      `includeBuild(new File(["node", "--print", "require.resolve('@react-native/gradle-plugin/package.json', { paths: [require.resolve('react-native/package.json')] })"].execute(null, rootDir).text.trim()).getParentFile())`,
      `includeBuild(new File(rootDir, "../node_modules/@react-native/gradle-plugin").canonicalPath)`
    );

    mod.modResults.contents = contents;
    return mod;
  });
}

module.exports = function withAndroidSettingsFix(config) {
  config = withSettingsGradleFix(config);
  config = withGradleWrapperFix(config);
  return config;
};
