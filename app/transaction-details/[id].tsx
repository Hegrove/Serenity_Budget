import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Check, ChevronDown, Trash2, CreditCard as Edit3 } from 'lucide-react-native';
import { databaseService, Transaction } from '@/services/DatabaseService';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { formatCurrency, formatDate } from '@/utils/formatters';

const CATEGORIES = [
  'Alimentation',
  'Transport',
  'Sorties',
  'Shopping',
  'Santé',
  'Logement',
  'Revenus',
  'Épargne',
  'Autres'
];

export default function TransactionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();

  useEffect(() => {
    loadTransaction();
  }, [id]);

  const loadTransaction = async () => {
    try {
      await databaseService.initialize();
      const transactions = await databaseService.getTransactions();
      const foundTransaction = transactions.find(t => t.id?.toString() === id);
      
      if (foundTransaction) {
        setTransaction(foundTransaction);
        setTitle(foundTransaction.title);
        setAmount(foundTransaction.amount.toString());
        setCategory(foundTransaction.category);
        setDescription(foundTransaction.description || '');
      } else {
        Alert.alert('Erreur', 'Transaction introuvable');
        router.back();
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la transaction:', error);
      Alert.alert('Erreur', 'Impossible de charger la transaction');
      router.back();
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !amount.trim() || !category) {
      triggerError();
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }

    const numericAmount = parseFloat(amount.replace(',', '.'));
    if (isNaN(numericAmount)) {
      triggerError();
      Alert.alert('Erreur', 'Le montant doit être un nombre valide.');
      return;
    }

    setIsLoading(true);

    try {
      await databaseService.initialize();
      
      // Calculer la différence pour ajuster le budget
      const oldAmount = transaction?.amount || 0;
      const newAmount = numericAmount;
      const oldCategory = transaction?.category || '';
      const newCategory = category;

      // Mettre à jour la transaction
      await databaseService.updateTransaction(parseInt(id!), {
        title: title.trim(),
        amount: newAmount,
        category: newCategory,
        description: description.trim() || null,
      });

      // Ajuster les budgets des catégories
      if (oldAmount < 0 && oldCategory) {
        // Retirer l'ancien montant de l'ancienne catégorie
        await databaseService.updateCategorySpent(oldCategory, oldAmount); // oldAmount est négatif, donc on soustrait
      }

      if (newAmount < 0 && newCategory) {
        // Ajouter le nouveau montant à la nouvelle catégorie
        await databaseService.updateCategorySpent(newCategory, Math.abs(newAmount));
      }

      triggerSuccess();
      setIsEditing(false);
      router.back();
    } catch (error) {
      triggerError();
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder les modifications.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    setShowDeleteModal(true);
    triggerLight();
  };

  const confirmDelete = async () => {
    console.log('🗑️ confirmDelete appelé');
    console.log('Transaction à supprimer:', transaction);
    
    if (!transaction?.id) return;

    setIsLoading(true);

    try {
      console.log('🔄 Initialisation de la base de données...');
      await databaseService.initialize();
      
      // Si c'était une dépense, retirer le montant du budget de la catégorie
      if (transaction.amount < 0 && transaction.category) {
        console.log('💰 Ajustement du budget pour la catégorie:', transaction.category);
        console.log('Montant à retirer des dépenses:', Math.abs(transaction.amount));
        
        // Pour une suppression, on retire le montant dépensé (donc on soustrait la valeur absolue)
        await databaseService.updateCategorySpent(transaction.category, -Math.abs(transaction.amount));
      }

      console.log('🗑️ Suppression de la transaction ID:', transaction.id);
      await databaseService.deleteTransaction(transaction.id);
      console.log('✅ Transaction supprimée avec succès');
      
      triggerSuccess();
      console.log('🔄 Navigation vers l\'arrière...');
      router.back();
    } catch (error) {
      triggerError();
      console.error('Erreur lors de la suppression:', error);
      Alert.alert('Erreur', 'Impossible de supprimer la transaction.');
    } finally {
      console.log('🔄 Fin du processus de suppression');
      setIsLoading(false);
    }
    setShowDeleteModal(false);
  };

  const selectCategory = (selectedCategory: string) => {
    setCategory(selectedCategory);
    setShowCategoryPicker(false);
    triggerLight();
  };

  if (!transaction) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <X size={24} color="#64748b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Modifier transaction' : 'Détails transaction'}
        </Text>
        {isEditing ? (
          <TouchableOpacity 
            style={[styles.headerButton, styles.saveButton, isLoading && { opacity: 0.6 }]}
            disabled={isLoading}
            onPress={handleSave}>
            <Check size={24} color="#ffffff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => {
              setIsEditing(true);
              triggerLight();
            }}>
            <Edit3 size={24} color="#64748b" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {isEditing ? (
          <>
            {/* Mode édition */}
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
            </View>

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
          </>
        ) : (
          <>
            {/* Mode lecture */}
            <View style={styles.detailsCard}>
              <View style={styles.amountSection}>
                <Text style={[
                  styles.detailAmount,
                  { color: transaction.amount > 0 ? '#059669' : '#1e293b' }
                ]}>
                  {formatCurrency(transaction.amount)}
                </Text>
                <Text style={styles.detailDate}>{formatDate(transaction.date)}</Text>
              </View>
              
              <View style={styles.detailsGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Titre</Text>
                  <Text style={styles.detailValue}>{transaction.title}</Text>
                </View>
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Catégorie</Text>
                  <Text style={styles.detailValue}>{transaction.category}</Text>
                </View>
                
                {transaction.description && (
                  <View style={styles.detailItem}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{transaction.description}</Text>
                  </View>
                )}
                
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Type</Text>
                  <Text style={styles.detailValue}>
                    {transaction.amount > 0 ? 'Revenu' : 'Dépense'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.editButton}
                onPress={() => {
                  setIsEditing(true);
                  triggerLight();
                }}>
                <Edit3 size={20} color="#0891b2" />
                <Text style={styles.editButtonText}>Modifier</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={handleDelete}>
                <Trash2 size={20} color="#dc2626" />
                <Text style={styles.deleteButtonText}>Supprimer</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal de confirmation de suppression */}
      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.deleteModalContainer}>
            <View style={styles.deleteModalHeader}>
              <Text style={styles.deleteModalTitle}>Supprimer la transaction</Text>
            </View>
            
            <View style={styles.deleteModalContent}>
              <Text style={styles.deleteModalText}>
                Êtes-vous sûr de vouloir supprimer cette transaction ?
              </Text>
              <Text style={styles.deleteModalSubtext}>
                Cette action est irréversible.
              </Text>
            </View>
            
            <View style={styles.deleteModalActions}>
              <TouchableOpacity 
                style={styles.deleteModalCancelButton}
                onPress={() => {
                  setShowDeleteModal(false);
                  triggerLight();
                }}>
                <Text style={styles.deleteModalCancelText}>Annuler</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.deleteModalConfirmButton, isLoading && { opacity: 0.6 }]}
                disabled={isLoading}
                onPress={confirmDelete}>
                <Text style={styles.deleteModalConfirmText}>
                  {isLoading ? 'Suppression...' : 'Supprimer'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
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
  detailsCard: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  amountSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailAmount: {
    fontSize: 36,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  detailDate: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  detailsGrid: {
    gap: 16,
  },
  detailItem: {
    gap: 4,
  },
  detailLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  detailValue: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#0891b2',
  },
  editButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#dc2626',
  },
  deleteButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#dc2626',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  deleteModalContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  deleteModalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  deleteModalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    textAlign: 'center',
  },
  deleteModalContent: {
    padding: 20,
  },
  deleteModalText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalSubtext: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
  },
  deleteModalActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  deleteModalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
  },
  deleteModalCancelText: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  deleteModalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: '#fef2f2',
  },
  deleteModalConfirmText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#dc2626',
  },
});