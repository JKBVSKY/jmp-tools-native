import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../_context/AuthContext';
import { useColors } from '../../_hooks/useColors';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signIn } = useAuth();
  const colors = useColors();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const result = await signIn(email, password);
    setLoading(false);

    if (result.success) {
      router.replace('/(app)');
    } else {
      Alert.alert('Login Failed', result.error);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Sign in</Text>
        <Text style={[styles.desc, { color: colors.text }]}>Enter valid e-mail adress & password to continue</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.outButBorder }]}
          placeholder="Email"
          placeholderTextColor={colors.phText}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.outButBorder }]}
          placeholder="Password"
          placeholderTextColor={colors.phText}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.butBackground }]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.butText }]}>
            {loading ? 'Logging in...' : 'Login'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/register')}>
          <Text style={[styles.linkText, { color: colors.text }]}>
            Don't have an account? Sign up
          </Text>
        </Pressable>

        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.text }]}>← Back</Text>
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
