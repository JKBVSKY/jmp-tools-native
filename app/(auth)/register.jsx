import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../_context/AuthContext';
import { useColors } from '../../_hooks/useColors';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { signUp } = useAuth();
  const colors = useColors();

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const result = await signUp(email, password, name);
    setLoading(false);

    if (result.success) {
      router.replace('/(app)');
    } else {
      Alert.alert('Registration Failed', result.error);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.text }]}>Create an account</Text>
        <Text style={[styles.desc, { color: colors.text }]}>Enter your personal data to create your account.</Text>

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.outButBorder }]}
          placeholder="Full Name"
          placeholderTextColor={colors.phText}
          value={name}
          onChangeText={setName}
        />

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

        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBackground, color: colors.text, borderColor: colors.outButBorder }]}
          placeholder="Confirm Password"
          placeholderTextColor={colors.phText}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
        />

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled, { backgroundColor: colors.butBackground }]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={[styles.buttonText, { color: colors.butText }]}>
            {loading ? 'Creating Account...' : 'Sign Up'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text style={[styles.linkText, { color: colors.text }]}>
            Already have an account? Login
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
    backgroundColor: '#f5f5f5',
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
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  button: {
    backgroundColor: '#c50000',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  linkText: {
    color: '#c50000',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
  backText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 20,
    fontSize: 16,
  },
});
