import { useState, useEffect } from 'react';
import { AuthState, User } from '@/services/AuthService';

// Service d'authentification simplifié pour l'onboarding
const mockAuthService = {
  getCurrentUser: async (): Promise<User | null> => {
    // Pour la démo, on considère l'utilisateur comme connecté après l'onboarding
    const hasCompletedOnboarding = localStorage.getItem('onboarding_completed');
    if (hasCompletedOnboarding) {
      return {
        id: '1',
        email: 'demo@serenity.com',
        firstName: 'Demo',
        lastName: 'User',
        createdAt: new Date().toISOString(),
        isVerified: true,
      };
    }
    return null;
  },
  
  login: async (email: string, password: string) => {
    localStorage.setItem('onboarding_completed', 'true');
    return { success: true };
  },
  
  register: async (email: string, password: string, firstName: string, lastName: string) => {
    localStorage.setItem('onboarding_completed', 'true');
    return { success: true };
  },
  
  logout: async () => {
    localStorage.removeItem('onboarding_completed');
  },
  
  addAuthListener: (callback: (state: AuthState) => void) => {},
  removeAuthListener: (callback: (state: AuthState) => void) => {},
};

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    // Vérifier l'état d'authentification au démarrage
    const checkAuthState = async () => {
      try {
        const user = await mockAuthService.getCurrentUser();
        setAuthState({
          isAuthenticated: user !== null,
          user,
          isLoading: false,
        });
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          isLoading: false,
        });
      }
    };

    checkAuthState();

    // S'abonner aux changements d'état d'authentification
    // Pour la démo, pas besoin de listeners
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await mockAuthService.login(email, password);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await mockAuthService.register(email, password, firstName, lastName);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    await mockAuthService.logout();
    setAuthState({
      isAuthenticated: false,
      user: null,
      isLoading: false,
    });
  };

  return {
    ...authState,
    login,
    register,
    logout,
  };
}