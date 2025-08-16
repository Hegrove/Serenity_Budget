import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowRight, Eye, EyeOff, Mail, Lock, User, Check } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { register } = useAuth();
  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();

  const passwordsMatch = password === confirmPassword && password.length > 0;
  const isPasswordStrong = password.length >= 6;

  const handleRegister = async () => {
    console.log('handleRegister appelé');
    
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !password.trim()) {
      console.log('Validation échouée - champs manquants');
      triggerError();
      Alert.alert('Erreur', 'Veuillez remplir tous les champs');
      return;
    }

    if (!passwordsMatch) {
      console.log('Validation échouée - mots de passe différents');
      triggerError();
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    if (!isPasswordStrong) {
      console.log('Validation échouée - mot de passe trop faible');
      triggerError();
      Alert.alert('Erreur', 'Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (!acceptTerms) {
      console.log('Validation échouée - conditions non acceptées');
      triggerError();
      Alert.alert('Erreur', 'Veuillez accepter les conditions d\'utilisation');
      return;
    }

    console.log('Validation réussie, début de l\'inscription');
    setIsLoading(true);
    triggerLight();

    try {
      console.log('Appel du service d\'inscription');
      const result = await register(email, password, firstName, lastName);
      console.log('Résultat de l\'inscription:', result);
      
      if (result.success) {
        triggerSuccess();
        router.replace('/(tabs)');
      } else {
        triggerError();
        Alert.alert('Erreur', result.message || 'Erreur lors de la création du compte');
      }
    } catch (error) {
      triggerError();
      console.error('Erreur lors de l\'inscription:', error);
      Alert.alert('Erreur', 'Une erreur est survenue lors de la création du compte');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez Sérénité Budget</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.nameRow}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Prénom</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#64748b" />
                <TextInput
                  style={styles.input}
                  placeholder="Prénom"
                  value={firstName}
                  onChangeText={setFirstName}
                  autoCapitalize="words"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Nom</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#64748b" />
                <TextInput
                  style={styles.input}
                  placeholder="Nom"
                  value={lastName}
                  onChangeText={setLastName}
                  autoCapitalize="words"
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>
          </View>

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
            <View style={[
              styles.inputContainer,
              isPasswordStrong && password.length > 0 && styles.inputContainerSuccess
            ]}>
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
            {isPasswordStrong && password.length > 0 && (
              <Text style={styles.successText}>Fort</Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirmer le mot de passe</Text>
            <View style={[
              styles.inputContainer,
              passwordsMatch && styles.inputContainerSuccess
            ]}>
              <Lock size={20} color="#64748b" />
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                placeholderTextColor="#94a3b8"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}>
                {showConfirmPassword ? (
                  <EyeOff size={20} color="#64748b" />
                ) : (
                  <Eye size={20} color="#64748b" />
                )}
              </TouchableOpacity>
            </View>
            {passwordsMatch && (
              <View style={styles.successRow}>
                <Check size={16} color="#059669" />
                <Text style={styles.successText}>Les mots de passe correspondent</Text>
              </View>
            )}
          </View>

          <TouchableOpacity 
            style={styles.termsContainer}
            onPress={() => setAcceptTerms(!acceptTerms)}>
            <View style={[styles.checkbox, acceptTerms && styles.checkboxChecked]}>
              {acceptTerms && <Check size={16} color="#ffffff" />}
            </View>
            <Text style={styles.termsText}>
              J'accepte les{' '}
              <Text style={styles.termsLink}>conditions d'utilisation</Text>
              {' '}et la{' '}
              <Text style={styles.termsLink}>politique de confidentialité</Text>
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.registerButton, isLoading && styles.registerButtonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}>
            <Text style={styles.registerButtonText}>
              {isLoading ? 'Création...' : 'Créer mon compte'}
            </Text>
            {!isLoading && <ArrowRight size={20} color="#ffffff" />}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Déjà un compte ? </Text>
          <TouchableOpacity onPress={() => router.push('/auth/login')}>
            <Text style={styles.footerLink}>Se connecter</Text>
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
    marginBottom: 32,
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
    marginBottom: 24,
  },
  nameRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
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
  inputContainerSuccess: {
    borderColor: '#059669',
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
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6,
  },
  successText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#059669',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 32,
    gap: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#0891b2',
    borderColor: '#0891b2',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    lineHeight: 20,
  },
  termsLink: {
    color: '#0891b2',
    fontFamily: 'Inter-SemiBold',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0891b2',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
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