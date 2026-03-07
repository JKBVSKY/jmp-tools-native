import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../_context/AuthContext';
import Spacer from '../../components/Spacer';
import { useColors } from '../../_hooks/useColors';

export default function Welcome() {
  const colors = useColors();
  const router = useRouter();
  const { continueAsGuest } = useAuth();

  const handleGuestMode = async () => {
    await continueAsGuest();
    router.replace('/(app)');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Image
        source={require("../../assets/welcome_icon.png")}
        style={[styles.logo, { borderWidth: 4, borderColor: colors.outButBorder }]}
        resizeMode="contain"
      />
      <Spacer />
      <Text style={[styles.title, { color: colors.text }]}>Witaj w JMP-Tools</Text>
      <Text style={[styles.subtitle, { color: colors.text }]}>
        Śledź swoją pracę efektywnie
      </Text>

      <View style={styles.buttonContainer}>
        <Pressable
          style={[styles.button, styles.primaryButton, { backgroundColor: colors.butBackground }]}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={[styles.primaryButtonText, { color: colors.butText }]}>Zaloguj Się</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.secondaryButton, { backgroundColor: colors.outButBackground, borderColor: colors.outButBorder   }]}
          onPress={() => router.push('/(auth)/register')}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.outButText }]}>Utwórz Konto</Text>
        </Pressable>

        <Pressable
          style={styles.guestButton}
          onPress={handleGuestMode}
        >
          <Text style={[styles.guestButtonText, { color: colors.text }]}>Zaloguj się Jako Gość</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 50,
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 400,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#c50000',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#c50000',
  },
  secondaryButtonText: {
    color: '#c50000',
    fontSize: 18,
    fontWeight: '600',
  },
  guestButton: {
    marginTop: 20,
    padding: 12,
  },
  guestButtonText: {
    color: '#666',
    fontSize: 16,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
