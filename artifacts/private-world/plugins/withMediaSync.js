const { withAndroidManifest } = require('@expo/config-plugins');

const permissionNames = [
  'android.permission.READ_MEDIA_IMAGES',
  'android.permission.READ_MEDIA_VIDEO',
  'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
];

module.exports = function withMediaSync(config) {
  return withAndroidManifest(config, (manifestConfig) => {
    const manifest = manifestConfig.modResults.manifest;
    const permissions = manifest['uses-permission'] || [];
    const existing = new Set(permissions.map((item) => item.$['android:name']));

    for (const name of permissionNames) {
      if (!existing.has(name)) permissions.push({ $: { 'android:name': name } });
    }

    if (!existing.has('android.permission.READ_EXTERNAL_STORAGE')) {
      permissions.push({
        $: {
          'android:name': 'android.permission.READ_EXTERNAL_STORAGE',
          'android:maxSdkVersion': '32',
        },
      });
    }

    manifest['uses-permission'] = permissions;
    return manifestConfig;
  });
};
