import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Award, TrendingUp, TrendingDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { databaseService, Transaction } from '@/services/DatabaseService';
import { formatCurrency, formatDate } from '@/utils/formatters';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [soldeDisponible, setSoldeDisponible] = useState(0);
  const [resteAujourdhui, setResteAujourdhui] = useState(0);
  const [resteCeMois, setResteCeMois] = useState(0);
  const [progressionBudget, setProgressionBudget] = useState(0);
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [unbudgetedSpent, setUnbudgetedSpent] = useState(0);
  const [budgetOverflow, setBudgetOverflow] = useState(false);
  const [monthlyBudget, setMonthlyBudget] = useState(0);
  const [totalAllocated, setTotalAllocated] = useState(0);

  useEffect(() => {
    initializeData();
  }, []);

  const initializeData = async () => {
    try {
      await databaseService.initialize();
      await loadData();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation:', error);
    }
  };

  const loadData = async () => {
    try {
      const transactions = await databaseService.getTransactions(3);
      setRecentTransactions(transactions);
      
      // Calculer le solde total
      const allTransactions = await databaseService.getTransactions();
      const totalBalance = allTransactions.reduce((sum, t) => sum + t.amount, 0);
      setSoldeDisponible(totalBalance);
      
      // Pour l'instant, on met les autres valeurs à 0
      // Ces calculs seront implémentés avec la logique de budget
      setResteAujourdhui(0);
      setResteCeMois(0);
      setProgressionBudget(0);
      
      // Calculer les dépenses non budgétées
      const budgetCategories = await databaseService.getBudgetCategories();
      const total = budgetCategories
        .filter(cat => (cat.includedInBudget ?? 1) === 0 && cat.name !== 'Revenus')
        .reduce((sum, cat) => sum + cat.spent, 0);
      setUnbudgetedSpent(total);
      
      // Charger le budget mensuel et vérifier les dépassements
      const budget = await databaseService.getMonthlyBudget();
      setMonthlyBudget(budget);
      
      const sumAllocated = budgetCategories
        .filter(cat => (cat.includedInBudget ?? 1) === 1)
        .reduce((sum, cat) => sum + cat.allocated, 0);
      setTotalAllocated(sumAllocated);
      setBudgetOverflow(sumAllocated > budget + 0.009); // tolérance arrondis
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // Utiliser useFocusEffect pour recharger les données quand on revient sur l'écran
  const { useFocusEffect } = require('@react-navigation/native');
  
  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      const load = async () => {
        try {
          await databaseService.initialize();
          await loadData();
        } catch (error) {
          console.error('Erreur lors du rechargement:', error);
        }
      };
      load();
      return () => { mounted = false; };
    }, [])
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateTitle}>Bienvenue dans Serenity Budget ! 👋</Text>
      <Text style={styles.emptyStateText}>
        Commencez par ajouter votre première transaction en appuyant sur le bouton "+" en bas à droite.
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Bonjour ! 👋</Text>
            <Text style={styles.subtitle}>Voici votre situation financière</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton}>
              <Award size={24} color="#64748b" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton}>
              <Bell size={24} color="#64748b" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Solde principal */}
        <View style={styles.balanceCard}>
          <LinearGradient
            colors={['#f8fafc', '#f1f5f9']}
            style={styles.balanceGradient}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceAmount}>{formatCurrency(soldeDisponible)}</Text>
            <View style={styles.balanceIndicator}>
              {soldeDisponible >= 0 ? (
                <TrendingUp size={16} color="#059669" />
              ) : (
                <TrendingDown size={16} color="#dc2626" />
              )}
              <Text style={[styles.balanceChange, { color: soldeDisponible >= 0 ? '#059669' : '#dc2626' }]}>
                {recentTransactions.length > 0 ? 'Dernière activité' : 'Aucune transaction'}
              </Text>
            </View>
          </LinearGradient>
        </View>

        {/* Indicateurs rapides */}
        <View style={styles.indicatorsGrid}>
          <View style={styles.indicatorCard}>
            <Text style={styles.indicatorLabel}>Reste aujourd'hui</Text>
            <Text style={[styles.indicatorAmount, { color: resteAujourdhui >= 0 ? '#059669' : '#dc2626' }]}>
              {formatCurrency(resteAujourdhui)}
            </Text>
          </View>
          <View style={styles.indicatorCard}>
            <Text style={styles.indicatorLabel}>Reste ce mois</Text>
            <Text style={[styles.indicatorAmount, { color: resteCeMois >= 0 ? '#059669' : '#dc2626' }]}>
              {formatCurrency(resteCeMois)}
            </Text>
          </View>
        </View>

        {/* Progression budget */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>Progression du budget</Text>
            <Text style={styles.progressPercentage}>{progressionBudget}%</Text>
          </View>
          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBackground}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${progressionBudget}%`,
                    backgroundColor: progressionBudget >= 80 ? '#dc2626' : progressionBudget >= 60 ? '#f59e0b' : '#0891b2'
                  }
                ]} 
              />
            </View>
          </View>
        </View>

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

        {/* Dépenses non budgétées */}
        {unbudgetedSpent > 0 && (
          <View style={styles.unbudgetedCard}>
            <View style={styles.unbudgetedHeader}>
              <Text style={styles.unbudgetedTitle}>⚠️ Dépenses non budgétées</Text>
            </View>
            <Text style={styles.unbudgetedAmount}>{formatCurrency(unbudgetedSpent)}</Text>
            <Text style={styles.unbudgetedDescription}>
              Pensez à budgéter ces dépenses pour garder le contrôle.
            </Text>
          </View>
        )}

        {/* Transactions récentes ou état vide */}
        <View style={styles.recentCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transactions récentes</Text>
            {recentTransactions.length > 0 && (
              <TouchableOpacity>
                <Text style={styles.sectionLink}>Voir tout</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {recentTransactions.length === 0 ? (
            renderEmptyState()
          ) : (
            <View style={styles.transactionsList}>
              {recentTransactions.map((transaction) => (
                <TransactionItem 
                  key={transaction.id}
                  title={transaction.title}
                  category={transaction.category}
                  amount={transaction.amount}
                  date={formatDate(transaction.date)}
                />
              ))}
            </View>
          )}
        </View>

        {/* Conseils IA */}
        {recentTransactions.length > 0 && (
          <View style={styles.aiCard}>
            <View style={styles.aiHeader}>
              <Text style={styles.aiTitle}>💡 Conseil du jour</Text>
            </View>
            <Text style={styles.aiMessage}>
              Continuez comme ça ! Ajoutez plus de transactions pour obtenir des conseils personnalisés.
            </Text>
            <TouchableOpacity style={styles.aiButton}>
              <Text style={styles.aiButtonText}>En savoir plus</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function TransactionItem({ title, category, amount, date }: {
  title: string;
  category: string;
  amount: number;
  date: string;
}) {
  return (
    <View style={styles.transactionItem}>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionTitle}>{title}</Text>
        <Text style={styles.transactionCategory}>{category}</Text>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[
          styles.transactionAmount,
          { color: amount > 0 ? '#059669' : '#1e293b' }
        ]}>
          {formatCurrency(amount)}
        </Text>
        <Text style={styles.transactionDate}>{date}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
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
  balanceCard: {
    marginBottom: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  balanceGradient: {
    padding: 24,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 48,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 12,
  },
  balanceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  balanceChange: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
  },
  indicatorsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  indicatorCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  indicatorLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
    marginBottom: 8,
  },
  indicatorAmount: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
  },
  progressCard: {
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
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  progressPercentage: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  progressBarContainer: {
    height: 8,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    borderRadius: 4,
  },
  recentCard: {
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
  },
  sectionLink: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#0891b2',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
  },
  transactionsList: {
    gap: 12,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1e293b',
    marginBottom: 4,
  },
  transactionCategory: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94a3b8',
  },
  aiCard: {
    backgroundColor: '#fef3c7',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  aiHeader: {
    marginBottom: 12,
  },
  aiTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400e',
  },
  aiMessage: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400e',
    lineHeight: 20,
    marginBottom: 16,
  },
  aiButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  aiButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#ffffff',
  },
  unbudgetedCard: {
    backgroundColor: '#fef3c7',
    padding: 20,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  unbudgetedHeader: {
    marginBottom: 8,
  },
  unbudgetedTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400e',
  },
  unbudgetedAmount: {
    fontSize: 28,
    fontFamily: 'Inter-SemiBold',
    color: '#92400e',
    marginBottom: 8,
  },
  unbudgetedDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#92400e',
    lineHeight: 20,
  },
  alertCard: {
    backgroundColor: '#fef3c7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#fbbf24',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
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
});