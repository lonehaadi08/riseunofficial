const { getDefaultConfig } = require('expo/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

// This tells Metro to resolve Firebase's .cjs files properly
defaultConfig.resolver.sourceExts.push('cjs');

// THIS IS THE MAGIC FIX for the SDK 53+ auth crash:
// It disables the new package exports feature that breaks Firebase
defaultConfig.resolver.unstable_enablePackageExports = false;

module.exports = defaultConfig;