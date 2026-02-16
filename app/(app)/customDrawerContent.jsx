import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { DrawerContentScrollView, DrawerItemList } from "@react-navigation/drawer";
import { useColors } from '../../_hooks/useColors';
import { useAuth } from "../../_context/AuthContext";
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

function CustomDrawerContent(props) {
  const colors = useColors();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={{ flex: 1 }}>
      <DrawerContentScrollView {...props}>
        <View style={[styles.logoContainer, { paddingTop: 10 }]}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: colors.text }]}>JMP-Tools v0.4.1</Text>
        </View>

        {/* Navigation items */}
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      {/* Sign Out button at bottom */}
      <Pressable
        onPress={handleSignOut}
        style={[
          styles.signOutButton,
          {
            borderTopColor: colors.border || '#ddd',
            backgroundColor: colors.draBackground
          }
        ]}
      >
        <MaterialIcons name="logout" size={24} style={{ color: colors.text, marginRight: 6 }} />
        <Text style={[styles.signOutText, { color: colors.text }]}>
          Wyloguj
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  logoContainer: {
    alignItems: "center",
    marginVertical: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  signOutButton: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomDrawerContent;