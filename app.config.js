module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "production";
  const isDevelopment = variant === "development";

  const appName = isDevelopment ? "JMP-Tools-Native Dev" : config.name;
  const appScheme = isDevelopment ? "jmp-tools-native-dev" : config.scheme;
  const androidPackage = isDevelopment
    ? "com.jmp.tools.app.dev"
    : "com.jmp.tools.app";
  const iosBundleIdentifier = isDevelopment
    ? "com.jmp.tools.app.dev"
    : "com.jmp.tools.app";

  return {
    ...config,
    name: appName,
    scheme: appScheme,
    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...config.android,
      package: androidPackage,
    },
  };
};