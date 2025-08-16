import { useState, useEffect, useRef } from 'react';
import { AuthState, User } from '@/services/AuthService';
import { authService } from '@/services/AuthService';

export function useAuth() {
  const isMountedRef = useRef(true);
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    isLoading: true,
  });

  useEffect(() => {
    isMountedRef.current = true;
    
    // Vérifier l'état d'authentification au démarrage
    const checkAuthState = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (isMountedRef.current) {
          setAuthState({
            isAuthenticated: user !== null,
            user,
            isLoading: false,
          });
        }
      } catch (error) {
        console.error('Erreur lors de la vérification de l\'authentification:', error);
        if (isMountedRef.current) {
          setAuthState({
            isAuthenticated: false,
            user: null,
            isLoading: false,
          });
        }
      }
    };

    checkAuthState();

    // S'abonner aux changements d'état d'authentification
    const handleAuthChange = (newState: AuthState) => {
      if (isMountedRef.current) {
        setAuthState(newState);
      }
    };

    authService.addAuthListener(handleAuthChange);

    return () => {
      isMountedRef.current = false;
      authService.removeAuthListener(handleAuthChange);
    };
  }, []);

  const login = async (email: string, password: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.login(email, password);
    if (result.success && result.user) {
      setAuthState({
        isAuthenticated: true,
        user: result.user,
        isLoading: false,
      });
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
    return result;
  };

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    setAuthState(prev => ({ ...prev, isLoading: true }));
    const result = await authService.register(email, password, firstName, lastName);
    if (result.success && result.user) {
      setAuthState({
        isAuthenticated: true,
        user: result.user,
        isLoading: false,
      });
    } else {
      setAuthState(prev => ({ ...prev, isLoading: false }));
    }
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