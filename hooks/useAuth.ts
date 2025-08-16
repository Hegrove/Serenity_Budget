import { useState, useEffect } from 'react';
import { authService, AuthState, User } from '@/services/AuthService';

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
        const user = await authService.getCurrentUser();
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
    const handleAuthChange = (state: AuthState) => {
      setAuthState(state);
    };

    authService.addAuthListener(handleAuthChange);

    // Nettoyer l'abonnement
    return () => {
      authService.removeAuthListener(handleAuthChange);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.login(email, password);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.register(email, password, firstName, lastName);
    setAuthState(prev => ({ ...prev, isLoading: false }));
    return result;
  };

  const logout = async () => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    await authService.logout();
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