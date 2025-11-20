import { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, Alert, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../_context/AuthContext';
import { useColors } from '../../_hooks/useColors';
import { Ionicons } from '@expo/vector-icons';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // Toggle password visibility
  const [showConfirmPassword, setShowConfirmPassword] = useState(false); // Toggle confirm password visibility
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
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.title }]}>Create an account</Text>
        <Text style={[styles.desc, { color: colors.textSecondary }]}>
          Enter your personal data to create your account.
        </Text>

        <TextInput
          style={[styles.input, {
            backgroundColor: colors.inputBackground,
            borderColor: colors.inputBorder,
            color: colors.text,
          }]}
          placeholder="Full Name"
          placeholderTextColor={colors.phText}
          value={name}
          onChangeText={setName}
        />

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
            placeholder="Password"
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

        {/* Confirm Password input with eye button */}
        <View style={styles.passwordContainer}>
          <TextInput
            style={[styles.passwordInput, {
              backgroundColor: colors.inputBackground,
              borderColor: colors.inputBorder,
              color: colors.text,
            }]}
            placeholder="Confirm Password"
            placeholderTextColor={colors.phText}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirmPassword}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.eyeButton}
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
          >
            <Ionicons
              name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
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
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            ← Back
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