const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// TFLite model dosyalarinin uygulama paketine dahil edilmesi icin
config.resolver.assetExts.push('tflite');

module.exports = config;
