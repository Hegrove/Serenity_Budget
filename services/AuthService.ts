import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { databaseService } from './DatabaseService';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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

  // Helper pour le stockage sécurisé compatible web
  private async secureGetItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  }

  private async secureSetItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  }

  private async secureDeleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  }

  // Simulation d'une base de données utilisateurs (en production, utiliser Supabase)
  private users: Map<string, {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    createdAt: string;
    isVerified: boolean;
  }> = new Map();

  constructor() {
    this.loadStoredUsers();
  }

  private async loadStoredUsers() {
    try {
      const storedUsers = await this.secureGetItem('stored_users');
      if (storedUsers) {
        const usersData = JSON.parse(storedUsers);
        this.users = new Map(usersData);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des utilisateurs:', error);
    }
  }

  private async saveUsers() {
    try {
      const usersArray = Array.from(this.users.entries());
      await this.secureSetItem('stored_users', JSON.stringify(usersArray));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde des utilisateurs:', error);
    }
  }

  private generateId(): string {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
  }

  private hashPassword(password: string): string {
    // En production, utiliser bcrypt ou une vraie fonction de hachage
    return btoa(password + 'serenity_salt');
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  private validatePassword(password: string): { isValid: boolean; message?: string } {
    if (password.length < 6) {
      return { isValid: false, message: 'Le mot de passe doit contenir au moins 6 caractères' };
    }
    if (!/(?=.*[a-z])(?=.*[A-Z])/.test(password)) {
      return { isValid: false, message: 'Le mot de passe doit contenir au moins une majuscule et une minuscule' };
    }
    return { isValid: true };
  }

  async register(email: string, password: string, firstName: string, lastName: string): Promise<{ success: boolean; message?: string; user?: User }> {
    try {
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

      // Vérifier si l'utilisateur existe déjà
      if (this.users.has(email.toLowerCase())) {
        return { success: false, message: 'Un compte existe déjà avec cette adresse email' };
      }

      // Créer le nouvel utilisateur
      const userId = this.generateId();
      const hashedPassword = this.hashPassword(password);
      const now = new Date().toISOString();

      const userData = {
        id: userId,
        email: email.toLowerCase(),
        password: hashedPassword,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        createdAt: now,
        isVerified: true, // Auto-vérifié pour simplifier
      };

      this.users.set(email.toLowerCase(), userData);
      await this.saveUsers();

      // Créer l'objet utilisateur public (sans mot de passe)
      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: userData.createdAt,
        isVerified: userData.isVerified,
      };

      // Sauvegarder la session
      await this.secureSetItem('current_user', JSON.stringify(user));
      this.currentUser = user;

      // Initialiser la base de données pour ce nouvel utilisateur
      await databaseService.initialize();

      this.notifyListeners();

      return { success: true, user };
    } catch (error) {
      console.error('Erreur lors de l\'inscription:', error);
      return { success: false, message: 'Erreur lors de la création du compte' };
    }
  }

  async login(email: string, password: string): Promise<{ success: boolean; message?: string; user?: User }> {
    try {
      if (!email.trim() || !password.trim()) {
        return { success: false, message: 'Email et mot de passe requis' };
      }

      const userData = this.users.get(email.toLowerCase());
      if (!userData) {
        return { success: false, message: 'Aucun compte trouvé avec cette adresse email' };
      }

      const hashedPassword = this.hashPassword(password);
      if (userData.password !== hashedPassword) {
        return { success: false, message: 'Mot de passe incorrect' };
      }

      // Créer l'objet utilisateur public
      const user: User = {
        id: userData.id,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        createdAt: userData.createdAt,
        isVerified: userData.isVerified,
      };

      // Sauvegarder la session
      await this.secureSetItem('current_user', JSON.stringify(user));
      this.currentUser = user;

      // Initialiser la base de données pour cet utilisateur
      await databaseService.initialize();

      this.notifyListeners();

      return { success: true, user };
    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
      return { success: false, message: 'Erreur lors de la connexion' };
    }
  }

  async logout(): Promise<void> {
    try {
      await this.secureDeleteItem('current_user');
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
      const storedUser = await this.secureGetItem('current_user');
      if (storedUser) {
        this.currentUser = JSON.parse(storedUser);
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
      const userData = this.users.get(email.toLowerCase());
      if (!userData) {
        return { success: false, message: 'Aucun compte trouvé avec cette adresse email' };
      }

      // En production, envoyer un email de réinitialisation
      // Pour la démo, on simule juste le succès
      return { success: true, message: 'Un email de réinitialisation a été envoyé' };
    } catch (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      return { success: false, message: 'Erreur lors de la réinitialisation' };
    }
  }

  async updateProfile(updates: Partial<Pick<User, 'firstName' | 'lastName'>>): Promise<{ success: boolean; message?: string }> {
    try {
      if (!this.currentUser) {
        return { success: false, message: 'Utilisateur non connecté' };
      }

      const userData = this.users.get(this.currentUser.email);
      if (!userData) {
        return { success: false, message: 'Utilisateur introuvable' };
      }

      // Mettre à jour les données
      if (updates.firstName !== undefined) {
        userData.firstName = updates.firstName.trim();
        this.currentUser.firstName = userData.firstName;
      }
      if (updates.lastName !== undefined) {
        userData.lastName = updates.lastName.trim();
        this.currentUser.lastName = userData.lastName;
      }

      this.users.set(this.currentUser.email, userData);
      await this.saveUsers();
      await this.secureSetItem('current_user', JSON.stringify(this.currentUser));

      this.notifyListeners();

      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour du profil:', error);
      return { success: false, message: 'Erreur lors de la mise à jour' };
    }
  }
}

export const authService = new AuthService();