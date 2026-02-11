import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../_context/AuthContext';
import { useColors } from '../../_hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const router = useRouter();
  const { signIn } = useAuth();
  const colors = useColors();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Błąd', 'Wypełnij wszystkie pola');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.success) {
      router.replace('/(app)');
    } else {
      Alert.alert('Logowanie nieudane', result.error);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.title }]}>Zaloguj Się</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Wprowadź swoje dane osobowe, aby się zalogować.
        </Text>

        <TextInput
          style={[styles.input, {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
            color: colors.text,
          }]}
          placeholder="Email"
          placeholderTextColor={colors.phText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* Password input with eye button */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.passwordInput, {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.text,
            }]}
            placeholder="Hasło"
            placeholderTextColor={colors.phText}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowPassword(!showPassword)}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={24}
              color={colors.iconColor}
            />
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.button,
            { backgroundColor: colors.butBackground },
            loading && styles.buttonDisabled
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.butText }]}>
            {loading ? 'Logowanie...' : 'Zaloguj'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={[styles.linkText, { color: colors.text }]}>
            Nie masz konta? Utwórz tutaj
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            ← Powrót
          </Text>
        </Pressable>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  desc: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  passwordInput: {
    padding: 15,
    paddingRight: 50, // Make room for eye button
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
  },
  eyeButton: {
    position: 'absolute',
    right: 15,
    top: 15,
    padding: 5,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  linkText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  backText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});