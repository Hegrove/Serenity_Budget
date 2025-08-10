import React, { useState } from 'react';
import { useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Check, ChevronDown } from 'lucide-react-native';
import { databaseService } from '@/services/DatabaseService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const CATEGORIES = [
  'Alimentation',
  'Transport',
  'Sorties',
  'Shopping',
  'Santé',
  'Logement',
  'Épargne',
  'Revenus',
  'Autres'
];

export default function AddTransactionScreen() {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();

  // Initialize database when component mounts
  useEffect(() => {
    const initDB = async () => {
      try {
        await databaseService.initialize();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };
    initDB();
  }, []);

  const handleSave = async () => {
    console.log('🔥 BOUTON CLIQUÉ - handleSave appelé');
    
    console.log('=== DEBUT handleSave ===');
    
    if (isLoading) {
      console.log('⚠️ Déjà en cours de chargement, abandon');
      return;
    }

    console.log('✅ Pas en cours de chargement, on continue');
    setIsLoading(true);
    
    console.log('📝 Validation des champs...');
    console.log('Title:', title);
    console.log('Amount:', amount);
    console.log('Category:', category);
    
    if (!title.trim() || !amount.trim() || !category) {
      console.log('❌ Validation échouée - champs manquants');
      triggerError();
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      setIsLoading(false);
      return;
    }

    console.log('🔢 Parsing du montant...');
    const numericAmount = parseFloat(amount.replace(',', '.'));
    console.log('Montant parsé:', numericAmount);
    
    if (isNaN(numericAmount)) {
      console.log('❌ Montant invalide');
      triggerError();
      Alert.alert('Erreur', 'Le montant doit être un nombre valide.');
      setIsLoading(false);
      return;
    }

    console.log('📦 Création de l\'objet transaction...');
    
    const transactionData = {
      title: title.trim(),
      amount: numericAmount,
      category,
      date: new Date().toISOString(),
      description: description.trim() || null,
    };

    console.log('Transaction data:', transactionData);

    try {
      console.log('🗄️ Initialisation de la base de données...');
      await databaseService.initialize();
      console.log('✅ Base de données initialisée');
      
      console.log('💾 Sauvegarde de la transaction...');
      await databaseService.addTransaction(transactionData);
      console.log('✅ Transaction sauvegardée avec succès');
      
      triggerSuccess();
      
      console.log('🔄 Navigation vers transactions...');
      router.replace('/(tabs)/transactions');
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde:', error);
      triggerError();
      Alert.alert('Erreur', 'Impossible de sauvegarder la transaction.');
    } finally {
      console.log('🔄 Fin du processus, setIsLoading(false)');
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    triggerLight();
    router.back();
  };

  const selectCategory = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setShowCategoryPicker(false);
    triggerLight();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleCancel}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Nouvelle transaction</Text>
        <TouchableOpacity 
          style={[
            styles.headerButton, 
            styles.saveButton,
            isLoading && { opacity: 0.6 }
          ]}
          disabled={isLoading}
          hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
          onPress={handleSave}>
          <Check size={24} color="#ffffff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {/* Titre de la transaction */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Titre *</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Courses Carrefour"
            value={title}
            onChangeText={setTitle}
            placeholderTextColor="#94a3b8"
            maxLength={100}
          />
        </View>

        {/* Montant */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Montant *</Text>
          <View style={styles.amountContainer}>
            <TextInput
              style={styles.amountInput}
              placeholder="0,00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
              placeholderTextColor="#94a3b8"
            />
            <Text style={styles.currency}>€</Text>
          </View>
          <Text style={styles.hint}>Utilisez un montant négatif pour une dépense</Text>
        </View>

        {/* Catégorie */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Catégorie *</Text>
          <TouchableOpacity 
            style={styles.categorySelector}
            onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
            <Text style={[styles.categorySelectorText, !category && styles.placeholder]}>
              {category || 'Sélectionner une catégorie'}
            </Text>
            <ChevronDown size={20} color="#64748b" />
          </TouchableOpacity>
          
          {showCategoryPicker && (
            <View style={styles.categoryPicker}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={styles.categoryOption}
                  onPress={() => selectCategory(cat)}>
                  <Text style={styles.categoryOptionText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Description (optionnelle) */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Ajouter une note (optionnel)"
            value={description}
            onChangeText={setDescription}
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={3}
            maxLength={500}
          />
        </View>

        {/* Exemples rapides */}
        <View style={styles.quickExamples}>
          <Text style={styles.quickExamplesTitle}>Exemples rapides</Text>
          <View style={styles.quickExamplesGrid}>
            <TouchableOpacity 
              style={styles.quickExample}
              onPress={() => {
                setTitle('Courses alimentaires');
                setAmount('-50');
                setCategory('Alimentation');
                triggerLight();
              }}>
              <Text style={styles.quickExampleText}>🛒 Courses (-50€)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickExample}
              onPress={() => {
                setTitle('Salaire');
                setAmount('2000');
                setCategory('Revenus');
                triggerLight();
              }}>
              <Text style={styles.quickExampleText}>💰 Salaire (+2000€)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickExample}
              onPress={() => {
                setTitle('Essence');
                setAmount('-60');
                setCategory('Transport');
                triggerLight();
              }}>
              <Text style={styles.quickExampleText}>⛽ Essence (-60€)</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.quickExample}
              onPress={() => {
                setTitle('Restaurant');
                setAmount('-35');
                setCategory('Sorties');
                triggerLight();
              }}>
              <Text style={styles.quickExampleText}>🍽️ Restaurant (-35€)</Text>
            </TouchableOpacity>
          </View>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
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
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  amountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  amountInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  currency: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#64748b',
    marginLeft: 8,
  },
  hint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    marginTop: 4,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categorySelectorText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  placeholder: {
    color: '#94a3b8',
  },
  categoryPicker: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  categoryOptionText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  quickExamples: {
    marginTop: 32,
  },
  quickExamplesTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 16,
  },
  quickExamplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickExample: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickExampleText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
});