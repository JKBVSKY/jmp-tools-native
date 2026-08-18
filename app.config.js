module.exports = ({ config }) => {
  const variant = process.env.APP_VARIANT || "production";
  const isDevelopment = variant === "development";

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

    name: appName,
    scheme: appScheme,
    icon: appIcon,

    ios: {
      ...config.ios,
      bundleIdentifier: iosBundleIdentifier,
    },

    android: {
      ...config.android,
      package: androidPackage,
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