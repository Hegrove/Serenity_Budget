import { supabase } from '@/lib/supabase';
import { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { databaseService } from './DatabaseService';

export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  isVerified: boolean;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
}

class AuthService {
  private currentUser: User | null = null;
  private authListeners: ((state: AuthState) => void)[] = [];

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    // Écouter les changements de session Supabase
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session?.user?.email);
      
      if (session?.user) {
        this.currentUser = this.mapSupabaseUser(session.user);
        await databaseService.initialize();
      } else {
        this.currentUser = null;
      }
      
      this.notifyListeners();
    });

    // Vérifier la session existante
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      this.currentUser = this.mapSupabaseUser(session.user);
      await databaseService.initialize();
    }
    
    this.notifyListeners();
  }

  private mapSupabaseUser(supabaseUser: SupabaseUser): User {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email!,
      firstName: supabaseUser.user_metadata?.firstName || '',
      lastName: supabaseUser.user_metadata?.lastName || '',
      createdAt: supabaseUser.created_at,
      isVerified: supabaseUser.email_confirmed_at !== null,
    };
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 6) {
      return { isValid: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
    }
    return { isValid: true };
  }

  async register(email: string, password: string, firstName: string, lastName: string): Promise<{ success: boolean; message?: string; user?: User }> {
    try {
      console.log('AuthService.register appelé avec:', { email, firstName, lastName });
      
      // Validation des données
      if (!email.trim() || !password.trim() || !firstName.trim() || !lastName.trim()) {
        return { success: false, message: 'Tous les champs sont obligatoires' };
      }

      if (!this.validateEmail(email)) {
        return { success: false, message: 'Adresse email invalide' };
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        return { success: false, message: passwordValidation.message };
      }

      console.log('Validation réussie, appel Supabase...');

      // Créer l'utilisateur avec Supabase
      const { data, error } = await supabase.auth.signUp({
        email: email.toLowerCase(),
        password: password,
        options: {
          data: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
          },
        },
      });

      console.log('Réponse Supabase:', { data, error });

      if (error) {
        console.error('Erreur Supabase:', error);
        return { success: false, message: error.message };
      }

      if (data.user) {
        const user = this.mapSupabaseUser(data.user);
        console.log('Utilisateur créé:', user);
        
        // Initialiser la base de données pour ce nouvel utilisateur
        await databaseService.initialize();
        
        return { success: true, user };
      }

      return { success: false, message: 'Erreur lors de la création du compte' };
    } catch (error: any) {
      console.error('Erreur lors de l\'inscription:', error);
      return { success: false, message: error.message || 'Erreur lors de la création du compte' };
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; message?: string; user?: User }> {
    try {
      console.log('AuthService.login appelé avec:', email);
      
      if (!email.trim() || !password.trim()) {
        return { success: false, message: 'Email et mot de passe requis' };
      }

      console.log('Validation réussie, appel Supabase...');

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase(),
        password: password,
      });

      console.log('Réponse Supabase login:', { data, error });

      if (error) {
        console.error('Erreur Supabase login:', error);
        return { success: false, message: error.message };
      }

      if (data.user) {
        const user = this.mapSupabaseUser(data.user);
        console.log('Utilisateur connecté:', user);
        
        // Initialiser la base de données pour cet utilisateur
        await databaseService.initialize();
        
        return { success: true, user };
      }

      return { success: false, message: 'Erreur lors de la connexion' };
    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      return { success: false, message: error.message || 'Erreur lors de la connexion' };
    }
  }

  async logout(): Promise<void> {
    try {
      console.log('Déconnexion...');
      await supabase.auth.signOut();
      this.currentUser = null;
      this.notifyListeners();
    } catch (error) {
      console.error('Erreur lors de la déconnexion:', error);
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser) {
      return this.currentUser;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.currentUser = this.mapSupabaseUser(session.user);
        return this.currentUser;
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    }

    return null;
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  // Système d'écoute pour les changements d'état d'authentification
  addAuthListener(callback: (state: AuthState) => void) {
    this.authListeners.push(callback);
  }

  removeAuthListener(callback: (state: AuthState) => void) {
    this.authListeners = this.authListeners.filter(listener => listener !== callback);
  }

  private notifyListeners() {
    const state: AuthState = {
      isAuthenticated: this.currentUser !== null,
      user: this.currentUser,
      isLoading: false,
    };
    this.authListeners.forEach(listener => listener(state));
  }

  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        return { success: false, message: error.message };
      }
      
      return { success: true, message: 'Un email de réinitialisation a été envoyé' };
    } catch (error: any) {
      console.error('Erreur lors de la réinitialisation:', error);
      return { success: false, message: error.message || 'Erreur lors de la réinitialisation' };
    }
  }

  async updateProfile(updates: Partial<Pick<User, 'firstName' | 'lastName'>>): Promise<{ success: boolean; message?: string }> {
    try {
      if (!this.currentUser) {
        return { success: false, message: 'Utilisateur non connecté' };
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          firstName: updates.firstName,
          lastName: updates.lastName,
        },
      });

      if (error) {
        return { success: false, message: error.message };
      }

      // Mettre à jour l'utilisateur local
      if (this.currentUser) {
        if (updates.firstName !== undefined) this.currentUser.firstName = updates.firstName;
        if (updates.lastName !== undefined) this.currentUser.lastName = updates.lastName;
      }

      this.notifyListeners();
      return { success: true };
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return { success: false, message: error.message || 'Erreur lors de la mise à jour' };
    }
  }
}

export const authService = new AuthService();