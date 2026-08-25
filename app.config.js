const { execSync } = require('child_process');

// Funkcja pobierająca liczbę commitów z historii Gita
function getGitCommitCount() {
  try {
    const stdout = execSync('git rev-list --count HEAD');
    const commitCount = parseInt(stdout.toString().trim(), 10);
    return isNaN(commitCount) || commitCount === 0 ? 1 : commitCount;
  } catch (error) {
    console.warn("⚠️ Nie udało się pobrać liczby commitów z Gita, używam domyślnej wartości 1.");
    return 1;
  }
}

module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "production";
  const isDevelopment = variant === "development";

  // Pobieramy unikalny numer buildu na podstawie historii Gita
  const buildNumber = getGitCommitCount();
  const appName = isDevelopment ? "JMP-Tools-Native Dev" : config.name;

  const appScheme = isDevelopment
    ? "jmp-tools-native-dev"
    : config.scheme;

  const androidPackage = isDevelopment
    ? "com.jmp.tools.app.dev"
    : "com.jmp.tools.app";

  const iosBundleIdentifier = isDevelopment
    ? "com.jmp.tools.app.dev"
    : "com.jmp.tools.app";

  const appIcon = isDevelopment
    ? "./assets/icon-dev.png"
    : "./assets/icon.png";

  const splashImage = isDevelopment
    ? "./assets/icon-dev.png"
    : "./assets/icon.png";

  return {
    ...config,
    version: "0.11.0",
    name: appName,
    scheme: appScheme,
    icon: appIcon,

    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
      buildNumber: String(buildNumber), // Wymagany String dla iOS
    },

    android: {
      ...config.android,
      package: androidPackage,
      versionCode: buildNumber, // Wymagany Integer dla Androida
      googleServicesFile: isDevelopment
        ? "./google-services-dev.json"
        : "./google-services.json",
    },

    plugins: [
      "expo-router",

      [
        "expo-splash-screen",
        {
          image: splashImage,
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark: {
            backgroundColor: "#000000",
          },
        },
      ],

      [
        "expo-notifications",
        {
          defaultChannel: "default",
        },
      ],

      "expo-secure-store",
      "@react-native-community/datetimepicker",
    ],
  };
};