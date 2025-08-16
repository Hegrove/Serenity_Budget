import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, User, Bell, Shield, Trash2, LogOut, Save } from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { databaseService } from '@/services/DatabaseService';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();
  
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [notifications, setNotifications] = useState(true);
  const [biometric, setBiometric] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName);
      setLastName(user.lastName);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      triggerError();
      Alert.alert('Erreur', 'Le prénom et le nom sont obligatoires');
      return;
    }

    setIsSaving(true);
    triggerLight();

    try {
      // Ici on pourrait appeler authService.updateProfile
      // Pour l'instant, on simule juste la sauvegarde
      triggerSuccess();
      setIsEditing(false);
      Alert.alert('Succès', 'Profil mis à jour avec succès');
    } catch (error) {
      triggerError();
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnexion',
          style: 'destructive',
          onPress: async () => {
            triggerLight();
            await logout();
            router.replace('/auth/login');
          },
        },
      ]
    );
  };

  const handleResetData = () => {
    Alert.alert(
      'Réinitialiser les données',
      'Cette action supprimera définitivement toutes vos transactions et paramètres de budget. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Réinitialiser',
          style: 'destructive',
          onPress: async () => {
            try {
              await databaseService.resetAllData();
              triggerSuccess();
              Alert.alert('Succès', 'Toutes les données ont été réinitialisées');
            } catch (error) {
              triggerError();
              console.error('Erreur lors de la réinitialisation:', error);
              Alert.alert('Erreur', 'Impossible de réinitialiser les données');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        {isEditing && (
          <TouchableOpacity 
            style={[styles.headerButton, styles.saveButton, isSaving && { opacity: 0.6 }]}
            disabled={isSaving}
            onPress={handleSaveProfile}>
            <Save size={24} color="#ffffff" />
          </TouchableOpacity>
        )}
        {!isEditing && <View style={styles.headerSpacer} />}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Profil utilisateur */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color="#0891b2" />
            <Text style={styles.sectionTitle}>Profil</Text>
            {!isEditing && (
              <TouchableOpacity 
                onPress={() => {
                  setIsEditing(true);
                  triggerLight();
                }}>
                <Text style={styles.editLink}>Modifier</Text>
              </TouchableOpacity>
            )}
          </View>
          
          <View style={styles.profileCard}>
            {isEditing ? (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Prénom</Text>
                  <TextInput
                    style={styles.input}
                    value={firstName}
                    onChangeText={setFirstName}
                    placeholder="Votre prénom"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Nom</Text>
                  <TextInput
                    style={styles.input}
                    value={lastName}
                    onChangeText={setLastName}
                    placeholder="Votre nom"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </>
            ) : (
              <>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{user?.firstName} {user?.lastName}</Text>
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                </View>
                <View style={styles.profileStats}>
                  <Text style={styles.profileStatsText}>
                    Membre depuis {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('fr-FR') : 'N/A'}
                  </Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Notifications */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Bell size={20} color="#0891b2" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>
          
          <View style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Notifications push</Text>
                <Text style={styles.settingDescription}>Recevoir des alertes pour les dépassements de budget</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
                thumbColor={notifications ? '#0891b2' : '#f4f4f5'}
              />
            </View>
          </View>
        </View>

        {/* Sécurité */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color="#0891b2" />
            <Text style={styles.sectionTitle}>Sécurité</Text>
          </View>
          
          <View style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>Authentification biométrique</Text>
                <Text style={styles.settingDescription}>Utiliser l'empreinte digitale ou Face ID</Text>
              </View>
              <Switch
                value={biometric}
                onValueChange={setBiometric}
                trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
                thumbColor={biometric ? '#0891b2' : '#f4f4f5'}
              />
            </View>
          </View>
        </View>

        {/* Actions dangereuses */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Trash2 size={20} color="#dc2626" />
            <Text style={[styles.sectionTitle, { color: '#dc2626' }]}>Zone de danger</Text>
          </View>
          
          <View style={styles.dangerCard}>
            <TouchableOpacity style={styles.dangerButton} onPress={handleResetData}>
              <Trash2 size={20} color="#dc2626" />
              <View style={styles.dangerButtonContent}>
                <Text style={styles.dangerButtonTitle}>Réinitialiser toutes les données</Text>
                <Text style={styles.dangerButtonDescription}>
                  Supprime définitivement toutes vos transactions et paramètres
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Déconnexion */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <LogOut size={20} color="#dc2626" />
          <Text style={styles.logoutButtonText}>Se déconnecter</Text>
        </TouchableOpacity>

        {/* Informations de version */}
        <View style={styles.versionInfo}>
          <Text style={styles.versionText}>Serenity Budget v1.0.0</Text>
          <Text style={styles.versionSubtext}>Vos données sont stockées localement et chiffrées</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#0891b2',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    flex: 1,
  },
  editLink: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  profileCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileInfo: {
    marginBottom: 12,
  },
  profileName: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  profileStats: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  profileStatsText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  settingCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  settingInfo: {
    flex: 1,
  },
  settingName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  dangerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  dangerButtonContent: {
    flex: 1,
  },
  dangerButtonTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#dc2626',
    marginBottom: 4,
  },
  dangerButtonDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#dc2626',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
    marginBottom: 32,
  },
  logoutButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#dc2626',
  },
  versionInfo: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  versionText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#64748b',
    marginBottom: 4,
  },
  versionSubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94a3b8',
    textAlign: 'center',
  },
});