import { Tabs, useSegments } from 'expo-router';
import { router } from 'expo-router';
import { Chrome as Home, Receipt, Target, Users } from 'lucide-react-native';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export default function TabLayout() {
  const { triggerLight } = useHapticFeedback();
  const segments = useSegments();
  const lastSegment = segments[segments.length - 1];
  const isOnTransactions = lastSegment === 'transactions';

  const handleFabPress = () => {
    triggerLight();
    router.push('/add-transaction');
  };

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#0891b2',
          tabBarInactiveTintColor: '#64748b',
          tabBarStyle: {
            backgroundColor: '#ffffff',
            borderTopWidth: 1,
            borderTopColor: '#e2e8f0',
            height: 80,
            paddingBottom: 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontFamily: 'Inter-Medium',
            fontSize: 12,
            marginTop: 4,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Accueil',
            tabBarIcon: ({ size, color }) => (
              <Home size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="transactions"
          options={{
            title: 'Transactions',
            tabBarIcon: ({ size, color }) => (
              <Receipt size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="budget"
          options={{
            title: 'Budget',
            tabBarIcon: ({ size, color }) => (
              <Target size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="family"
          options={{
            title: 'Famille',
            tabBarIcon: ({ size, color }) => (
              <Users size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      
      {/* FAB flottant - uniquement dans l'onglet Transactions */}
      {isOnTransactions && (
        <View style={styles.fabContainer}>
          <TouchableOpacity style={styles.fab} onPress={handleFabPress}>
            <View style={styles.fabInner}>
              <View style={[styles.fabLine, styles.fabLineVertical]} />
              <View style={[styles.fabLine, styles.fabLineHorizontal]} />
            </View>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    zIndex: 1000,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0891b2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
  fabInner: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabLine: {
    backgroundColor: '#ffffff',
    position: 'absolute',
  },
  fabLineVertical: {
    width: 2,
    height: 16,
  },
  fabLineHorizontal: {
    width: 16,
    height: 2,
  },
});