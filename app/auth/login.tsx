import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight, Eye, EyeOff, Mail, Lock } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { login } = useAuth();
  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      triggerError();
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    setIsLoading(true);
    triggerLight();

    try {
      const result = await login(email, password);
      if (result.success) {
        triggerSuccess();
        router.replace('/(tabs)');
      } else {
        triggerError();
        Alert.alert('Erreur', result.message || 'Erreur de connexion');
      }
    } catch (error) {
      triggerError();
      console.error('Erreur de connexion:', error);
      Alert.alert('Erreur', 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Bon retour !</Text>
          <Text style={styles.subtitle}>Connectez-vous à votre compte</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputContainer}>
              <Mail size={20} color="#64748b" />
              <TextInput
                style={styles.input}
                placeholder="votre@email.com"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.inputContainer}>
              <Lock size={20} color="#64748b" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}>
                {showPassword ? (
                  <EyeOff size={20} color="#64748b" />
                ) : (
                  <Eye size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={styles.forgotPassword}>
            <Text style={styles.forgotPasswordText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}>
            <Text style={styles.loginButtonText}>
              {isLoading ? 'Connexion...' : 'Se connecter'}
            </Text>
            {!isLoading && <ArrowRight size={20} color="#ffffff" />}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Pas encore de compte ? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/register')}>
            <Text style={styles.footerLink}>Créer un compte</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
  },
  form: {
    marginBottom: 32,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  eyeButton: {
    padding: 4,
  },
  forgotPassword: {
    alignItems: 'flex-end',
    marginBottom: 32,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#0891b2',
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0891b2',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  footerLink: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
});