import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserPlus, QrCode, Share2, Users } from 'lucide-react-native';

interface FamilyMember {
  id: string;
  name: string;
  avatar: string;
  totalSpent: number;
  isActive: boolean;
}

interface SharedExpense {
  id: string;
  title: string;
  amount: number;
  date: string;
  paidBy: string;
  participants: string[];
}

export default function FamilyScreen() {
  const [sharedBudgetEnabled, setSharedBudgetEnabled] = useState(true);

  const familyMembers: FamilyMember[] = [
    { id: '1', name: 'Vous', avatar: '👤', totalSpent: 623.50, isActive: true },
    { id: '2', name: 'Marie', avatar: '👩', totalSpent: 445.20, isActive: true },
    { id: '3', name: 'Paul', avatar: '👨', totalSpent: 0, isActive: false },
  ];

  const sharedExpenses: SharedExpense[] = [
    { id: '1', title: 'Courses familiales', amount: 87.60, date: 'Aujourd\'hui', paidBy: 'Vous', participants: ['Vous', 'Marie'] },
    { id: '2', title: 'Restaurant', amount: 65.40, date: 'Hier', paidBy: 'Marie', participants: ['Vous', 'Marie'] },
    { id: '3', title: 'Essence (voyage)', amount: 75.00, date: '2 jours', paidBy: 'Vous', participants: ['Vous', 'Marie', 'Paul'] },
  ];

  const renderMember = (member: FamilyMember) => (
    <View key={member.id} style={styles.memberCard}>
      <View style={styles.memberInfo}>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>{member.avatar}</Text>
        </View>
        <View style={styles.memberDetails}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberStatus}>
            {member.isActive ? 'Actif' : 'Invité en attente'}
          </Text>
        </View>
      </View>
      <View style={styles.memberStats}>
        <Text style={styles.memberAmount}>{member.totalSpent.toFixed(2)}€</Text>
        <Text style={styles.memberLabel}>Ce mois</Text>
      </View>
    </View>
  );

  const renderSharedExpense = (expense: SharedExpense) => (
    <View key={expense.id} style={styles.expenseCard}>
      <View style={styles.expenseInfo}>
        <Text style={styles.expenseTitle}>{expense.title}</Text>
        <Text style={styles.expenseDetails}>
          Payé par {expense.paidBy} • {expense.participants.length} participant{expense.participants.length > 1 ? 's' : ''}
        </Text>
      </View>
      <View style={styles.expenseRight}>
        <Text style={styles.expenseAmount}>{expense.amount.toFixed(2)}€</Text>
        <Text style={styles.expenseDate}>{expense.date}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Famille</Text>
        <TouchableOpacity style={styles.inviteButton}>
          <UserPlus size={20} color="#0891b2" />
          <Text style={styles.inviteButtonText}>Inviter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Configuration budget partagé */}
        <View style={styles.configCard}>
          <View style={styles.configHeader}>
            <Users size={24} color="#0891b2" />
            <View style={styles.configInfo}>
              <Text style={styles.configTitle}>Budget partagé</Text>
              <Text style={styles.configSubtitle}>
                Synchroniser les dépenses communes
              </Text>
            </View>
            <Switch
              value={sharedBudgetEnabled}
              onValueChange={setSharedBudgetEnabled}
              trackColor={{ false: '#e2e8f0', true: '#bfdbfe' }}
              thumbColor={sharedBudgetEnabled ? '#0891b2' : '#f4f4f5'}
            />
          </View>
        </View>

        {/* Membres de la famille */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Membres ({familyMembers.length})</Text>
          {familyMembers.map(renderMember)}
        </View>

        {/* Actions d'invitation */}
        <View style={styles.inviteActions}>
          <TouchableOpacity style={styles.inviteActionButton}>
            <QrCode size={20} color="#64748b" />
            <Text style={styles.inviteActionText}>Code QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.inviteActionButton}>
            <Share2 size={20} color="#64748b" />
            <Text style={styles.inviteActionText}>Partager lien</Text>
          </TouchableOpacity>
        </View>

        {/* Dépenses communes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dépenses communes</Text>
          {sharedExpenses.map(renderSharedExpense)}
        </View>

        {/* Répartition */}
        <View style={styles.splitCard}>
          <Text style={styles.splitTitle}>Répartition équitable</Text>
          <View style={styles.splitStats}>
            <View style={styles.splitStatItem}>
              <Text style={styles.splitStatName}>Vous devez</Text>
              <Text style={[styles.splitStatAmount, { color: '#dc2626' }]}>-15.40€</Text>
            </View>
            <View style={styles.splitStatItem}>
              <Text style={styles.splitStatName}>Marie doit</Text>
              <Text style={[styles.splitStatAmount, { color: '#059669' }]}>+15.40€</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.splitButton}>
            <Text style={styles.splitButtonText}>Régler les comptes</Text>
          </TouchableOpacity>
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inviteButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#0891b2',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  configCard: {
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
  configHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  configInfo: {
    flex: 1,
  },
  configTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  configSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 16,
  },
  memberCard: {
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
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  memberAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberAvatarText: {
    fontSize: 20,
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberStatus: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  memberStats: {
    alignItems: 'flex-end',
  },
  memberAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  inviteActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  inviteActionText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#64748b',
  },
  expenseCard: {
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
  },
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1e293b',
    marginBottom: 4,
  },
  expenseDetails: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748b',
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#1e293b',
    marginBottom: 4,
  },
  expenseDate: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#94a3b8',
  },
  splitCard: {
    backgroundColor: '#fef3c7',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fbbf24',
  },
  splitTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#92400e',
    marginBottom: 16,
    textAlign: 'center',
  },
  splitStats: {
    gap: 12,
    marginBottom: 16,
  },
  splitStatItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  splitStatName: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#92400e',
  },
  splitStatAmount: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  splitButton: {
    backgroundColor: '#f59e0b',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  splitButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#ffffff',
  },
});