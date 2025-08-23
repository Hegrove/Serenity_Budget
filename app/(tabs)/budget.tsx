import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Settings, PieChart, Plus, CreditCard as Edit3 } from 'lucide-react-native';
import { databaseService, BudgetCategory } from '@/services/DatabaseService';
import { formatCurrency } from '@/utils/formatters';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { ADD_CATEGORY_ROUTE } from '@/utils/routes';

export default function BudgetScreen() {
  const [budgetMethod, setBudgetMethod] = useState<'thirds' | 'envelopes'>('thirds');
  const [categories, setCategories] = useState<BudgetCategory[]>([]);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [monthlyIncome, setMonthlyIncome] = useState('');
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [categoryAmount, setCategoryAmount] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [budgetOverflow, setBudgetOverflow] = useState(false);

  const { triggerLight, triggerSuccess, triggerError } = useHapticFeedback();

  useFocusEffect(
    React.useCallback(() => {
      const recalculateAndLoad = async () => {
        try {
          await databaseService.initialize();
          await databaseService.recalculateBudgetSpending();
          await loadBudgetData();
        } catch (error) {
          console.error('Erreur lors du recalcul:', error);
        }
      };
      recalculateAndLoad();
    }, [])
  );

  const loadBudgetData = async () => {
    try {
      const budgetCategories = await databaseService.getBudgetCategories();
      // Filtrer complètement la catégorie "Revenus" de l'affichage
      const filteredCategories = budgetCategories.filter(cat => cat.name !== 'Revenus');
      setCategories(filteredCategories);
      
      // Charger le budget mensuel
      const budget = await databaseService.getMonthlyBudget();
      setMonthlyBudget(budget);
      
      // Vérifier si les allocations dépassent le budget
      const sumAllocated = budgetCategories
        .filter(cat => (cat.includedInBudget ?? 1) === 1)
        .reduce((sum, cat) => sum + cat.allocated, 0);
      setBudgetOverflow(sumAllocated > budget + 0.009); // tolérance arrondis
    } catch (error) {
      console.error('Erreur lors du chargement du budget:', error);
    }
  };

  const handleSetupBudget = async () => {
    if (!monthlyIncome.trim()) {
      triggerError();
      Alert.alert('Erreur', 'Veuillez entrer votre revenu mensuel.');
      return;
    }

    const income = parseFloat(monthlyIncome.replace(',', '.'));
    if (isNaN(income) || income <= 0) {
      triggerError();
      Alert.alert('Erreur', 'Le revenu doit être un nombre positif.');
      return;
    }

    try {
      await setupPersonalizedMethod(income);
      
      triggerSuccess();
      setShowSetupModal(false);
      setMonthlyIncome('');
      await loadBudgetData();
    } catch (error) {
      triggerError();
      console.error('Erreur lors de la configuration du budget:', error);
      Alert.alert('Erreur', 'Impossible de configurer le budget.');
    }
  };

  const setupPersonalizedMethod = async (income: number) => {
    await databaseService.resetBudgetCategories();
    
    // Répartition suggérée basée sur le revenu (total = 100%)
    const percentages = [
      { name: 'Logement', percentage: 0.30, color: '#059669' },
      { name: 'Alimentation', percentage: 0.25, color: '#0891b2' },
      { name: 'Transport', percentage: 0.10, color: '#7c3aed' },
      { name: 'Sorties', percentage: 0.10, color: '#dc2626' },
      { name: 'Shopping', percentage: 0.10, color: '#f59e0b' },
      { name: 'Épargne', percentage: 0.10, color: '#10b981' },
      { name: 'Santé', percentage: 0.05, color: '#f97316' },
    ];

    // Calculer les montants arrondis
    const budgets = percentages.map(cat => ({
      ...cat,
      allocated: Math.round(income * cat.percentage)
    }));

    // Calculer la différence due aux arrondis
    const totalAllocated = budgets.reduce((sum, cat) => sum + cat.allocated, 0);
    const difference = income - totalAllocated;

    // Ajuster la première catégorie (Logement) pour compenser la différence
    if (difference !== 0) {
      budgets[0].allocated += difference;
    }
    
    // Créer les catégories avec les montants ajustés
    for (const category of budgets) {
      await databaseService.addBudgetCategory({
        name: category.name,
        allocated: category.allocated,
        spent: 0,
        color: category.color,
        isActive: true
      });
    }
  };

  const handleEditCategory = (category: BudgetCategory) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setCategoryAmount(category.allocated.toString());
    setShowCategoryModal(true);
    triggerLight();
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim() || !categoryAmount.trim()) {
      triggerError();
      Alert.alert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }

    const amount = parseFloat(categoryAmount.replace(',', '.'));
    if (isNaN(amount) || amount < 0) {
      triggerError();
      Alert.alert('Erreur', 'Le montant doit être un nombre positif.');
      return;
    }

    // Vérifier les doublons de noms
    const trimmedName = categoryName.trim();
    const existingCategory = categories.find(cat => 
      cat.name.toLowerCase() === trimmedName.toLowerCase() && 
      cat.id !== editingCategory?.id
    );
    
    if (existingCategory) {
      triggerError();
      Alert.alert('Erreur', 'Une catégorie avec ce nom existe déjà.');
      return;
    }

    try {
      if (editingCategory) {
        await databaseService.updateBudgetCategory(editingCategory.id!, {
          name: trimmedName,
          allocated: amount,
        });
      } else {
        await databaseService.addBudgetCategory({
          name: trimmedName,
          allocated: amount,
          spent: 0,
          color: '#64748b',
          isActive: true,
        });
      }

      triggerSuccess();
      setShowCategoryModal(false);
      resetCategoryModal();
      await loadBudgetData();
    } catch (error) {
      triggerError();
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder la catégorie.');
    }
  };

  const resetCategoryModal = () => {
    setEditingCategory(null);
    setCategoryName('');
    setCategoryAmount('');
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#dc2626';
    if (percentage >= 80) return '#f59e0b';
    return '#059669';
  };

  // Calculer les totaux seulement pour les catégories incluses dans le budget
  const budgeted = categories.filter(cat => (cat.includedInBudget ?? 1) === 1);
  const unbudgeted = categories.filter(cat => (cat.includedInBudget ?? 1) === 0);
  
  const budgetedSpent = budgeted.reduce((sum, cat) => sum + cat.spent, 0);
  const unbudgetedSpent = unbudgeted.reduce((sum, cat) => sum + cat.spent, 0);
  const displayedSpent = budgetedSpent + unbudgetedSpent;
  const totalAllocated = budgeted.reduce((sum, cat) => sum + cat.allocated, 0);
  const totalRemaining = totalAllocated - budgetedSpent;
  
  const progress = monthlyBudget > 0 ? budgetedSpent / monthlyBudget : 0;

  const renderCategoryCard = (category: BudgetCategory) => {
    const percentage = category.allocated > 0 ? (category.spent / category.allocated) * 100 : 0;
    const remaining = category.allocated - category.spent;
    const isOutOfBudget = category.includedInBudget === false;

    return (
      <TouchableOpacity 
        key={category.id} 
        style={[styles.categoryCard, isOutOfBudget && styles.categoryCardOutOfBudget]}
        onPress={() => handleEditCategory(category)}>
        <View style={styles.categoryHeader}>
          <View style={styles.categoryInfo}>
            <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
            <Text style={styles.categoryName}>{category.name}</Text>
            {isOutOfBudget && (
              <View style={styles.outOfBudgetBadge}>
                <Text style={styles.outOfBudgetBadgeText}>Hors budget</Text>
              </View>
            )}
          </View>
          <View style={styles.categoryActions}>
            {isOutOfBudget ? (
              <Text style={styles.categorySpentOnly}>
                {category.spent.toFixed(0)}€ dépensés
              </Text>
            ) : (
              <Text style={styles.categoryRemaining}>
                {remaining >= 0 ? `${remaining.toFixed(0)}€ restants` : `Dépassé de ${Math.abs(remaining).toFixed(0)}€`}
              </Text>
            )}
            <Edit3 size={16} color="#64748b" />
          </View>
        </View>
        
        <View style={styles.amountRow}>
          <Text style={styles.spentAmount}>{category.spent.toFixed(0)}€</Text>
          {!isOutOfBudget && (
            <Text style={styles.allocatedAmount}>/ {category.allocated.toFixed(0)}€</Text>
          )}
        </View>
        
        {!isOutOfBudget && (
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill,
                  { 
                    width: `${Math.min(percentage, 100)}%`,
                    backgroundColor: getProgressColor(percentage)
                  }
                ]} 
              />
            </View>
            <Text style={[styles.progressPercentage, { color: getProgressColor(percentage) }]}>
              {percentage.toFixed(0)}%
            </Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <PieChart size={64} color="#94a3b8" />
      <Text style={styles.emptyStateTitle}>Aucun budget configuré</Text>
      <Text style={styles.emptyStateText}>
        Commencez par définir votre budget mensuel pour suivre vos dépenses par catégorie.
      </Text>
      <TouchableOpacity 
        style={styles.setupButton}
        onPress={() => setShowSetupModal(true)}>
        <Text style={styles.setupButtonText}>Configurer mon budget</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Budget</Text>
        <TouchableOpacity style={styles.settingsButton}>
          <Settings size={24} color="#64748b" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {categories.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            {/* Résumé du budget */}
            {/* Alerte si allocations > budget */}
            {budgetOverflow && (
              <View style={styles.alertCard}>
                <Text style={styles.alertTitle}>⚠️ Budget dépassé</Text>
                <Text style={styles.alertText}>
                  Alloué: {formatCurrency(totalAllocated)} • Budget: {formatCurrency(monthlyBudget)}
                </Text>
                <Text style={styles.alertHint}>
                  Augmentez le budget ou ajustez les allocations par catégorie.
                </Text>
              </View>
            )}

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <PieChart size={24} color="#0891b2" />
                <Text style={styles.summaryTitle}>Budget mensuel</Text>
              </View>
              <View style={styles.summaryStats}>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatLabel}>Alloué</Text>
                  <Text style={styles.summaryStatValue}>{formatCurrency(totalAllocated)}</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatLabel}>Dépensé</Text>
                  <Text style={styles.summaryStatValue}>{formatCurrency(displayedSpent)}</Text>
                </View>
                <View style={styles.summaryStatItem}>
                  <Text style={styles.summaryStatLabel}>Restant</Text>
                  <Text style={[styles.summaryStatValue, { color: totalRemaining >= 0 ? '#059669' : '#dc2626' }]}>
                    {formatCurrency(totalRemaining)}
                  </Text>
                </View>
              </View>
              {unbudgetedSpent > 0 && (
                <Text style={styles.summaryNote}>
                  dont hors budget : {formatCurrency(unbudgetedSpent)}
                </Text>
              )}
            </View>

            {/* Actions rapides */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => {
                  setShowSetupModal(true);
                  triggerLight();
                }}>
                <Text style={styles.actionButtonText}>Définir mon revenu</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.actionButtonSecondary}
                onPress={() => {
                  resetCategoryModal();
                  setShowCategoryModal(true);
                  triggerLight();
                }}>
                <Text style={styles.actionButtonSecondaryText}>Ajouter catégorie</Text>
              </TouchableOpacity>
            </View>

            {/* Catégories */}
            <View style={styles.categoriesContainer}>
              {budgeted.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>Budget</Text>
                  {budgeted.map(renderCategoryCard)}
                </>
              )}
              
              {unbudgeted.length > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { marginTop: 32 }]}>Dépenses non budgétées</Text>
                  <Text style={styles.sectionSubtitle}>
                    Total des dépenses hors budget : {formatCurrency(unbudgetedSpent)}
                  </Text>
                  {unbudgeted.map(cat => (
                    <TouchableOpacity 
                      key={cat.id} 
                      style={styles.categoryRowUnbudgeted}
                      onPress={() => handleEditCategory(cat)}>
                      <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                      <Text style={styles.categoryRowName}>{cat.name}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.categoryRowAmount}>{formatCurrency(cat.spent || 0)}</Text>
                      <Edit3 size={16} color="#64748b" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Modal de configuration du budget */}
      <Modal
        visible={showSetupModal}
        animationType="slide"
        presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowSetupModal(false)}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Définir mon revenu</Text>
            <TouchableOpacity onPress={handleSetupBudget}>
              <Text style={styles.modalSave}>Valider</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Revenu mensuel net</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 2500"
                value={monthlyIncome}
                onChangeText={setMonthlyIncome}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.methodExplanation}>
              <Text style={styles.methodTitle}>
                Budget personnalisé
              </Text>
              <Text style={styles.methodDescription}>
                Répartissez votre revenu selon vos priorités et créez vos propres catégories
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal d'édition de catégorie */}
      <Modal
        visible={showCategoryModal}
        animationType="slide"
        presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => {
              setShowCategoryModal(false);
              resetCategoryModal();
            }}>
              <Text style={styles.modalCancel}>Annuler</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingCategory ? 'Modifier catégorie' : 'Nouvelle catégorie'}
            </Text>
            <TouchableOpacity onPress={handleSaveCategory}>
              <Text style={styles.modalSave}>Valider</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.modalContent}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Nom de la catégorie</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Alimentation"
                value={categoryName}
                onChangeText={setCategoryName}
                placeholderTextColor="#94a3b8"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Budget alloué (€)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: 400"
                value={categoryAmount}
                onChangeText={setCategoryAmount}
                keyboardType="numeric"
                placeholderTextColor="#94a3b8"
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  setupButton: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
  },
  setupButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  summaryTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryStatItem: {
    alignItems: 'center',
  },
  summaryStatLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    marginBottom: 4,
  },
  summaryStatValue: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#0891b2',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
  actionButtonSecondary: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  actionButtonSecondaryText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  categoriesContainer: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 8,
  },
  categoryCard: {
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  categoryName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    flex: 1,
  },
  outOfBudgetBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  outOfBudgetBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryRemaining: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  categorySpentOnly: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#f59e0b',
  },
  categoryCardOutOfBudget: {
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 16,
    gap: 4,
  },
  spentAmount: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  allocatedAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  progressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    minWidth: 40,
    textAlign: 'right',
  },
  sectionSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    marginBottom: 16,
    marginTop: -8,
  },
  categoryRowUnbudgeted: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderLeftWidth: 3,
    borderLeftColor: '#f59e0b',
  },
  categoryRowName: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1e293b',
  },
  categoryRowAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  summaryNote: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  alertCard: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  alertTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400e',
    marginBottom: 8,
  },
  alertText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400e',
    marginBottom: 4,
  },
  alertHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#92400e',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalCancel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  modalSave: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  modalContent: {
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
  methodExplanation: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  methodTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 8,
  },
  methodDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    lineHeight: 20,
  },
});