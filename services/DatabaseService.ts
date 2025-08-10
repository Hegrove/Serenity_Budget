import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

/* ---------- Types ---------- */

export interface Transaction {
  id?: number;
  title: string;
  amount: number;
  category: string;
  date: string;
  description?: string | null;
  isShared?: boolean;
  createdAt?: string;
}

export interface BudgetCategory {
  id?: number;
  name: string;
  allocated: number;
  spent: number;
  color: string;
  isActive: boolean;
}

export interface SavingsGoal {
  id?: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string;
  isActive: boolean;
  createdAt?: string;
}

/* ---------- Service ---------- */

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;
  private initializationPromise: Promise<void> | null = null;
  private isInitialized = false;

  /* ----- Init ----- */

  async initialize() {
    if (this.isInitialized && this.db) return;          // déjà prêt
    if (this.initializationPromise) return this.initializationPromise;  // en cours

    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization() {
    try {
      this.db = await SQLite.openDatabaseAsync('serenite_budget.db');
      await this.createTables();
      this.isInitialized = true;
      console.log('Database initialized');
    } catch (error: any) {
      console.error('Database init failed →', error.message, error.code, error);
      throw new Error(`DB init error: ${error.message || 'unknown'}`);
    }
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    await this.initialize();
    if (!this.db) throw new Error('Database unavailable');
    return this.db;
  }

  /* ----- Schema ----- */

  private async createTables() {
    if (!this.db) throw new Error('Database not opened');
    const db = this.db;

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        description TEXT,
        isShared INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        allocated REAL NOT NULL,
        spent REAL DEFAULT 0,
        color TEXT NOT NULL,
        isActive INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        targetAmount REAL NOT NULL,
        currentAmount REAL DEFAULT 0,
        targetDate TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY,
        budgetMethod TEXT DEFAULT 'thirds',
        currency TEXT DEFAULT 'EUR',
        notifications INTEGER DEFAULT 1,
        biometricEnabled INTEGER DEFAULT 0
      );
    `);

    await this.insertDefaultCategories();
    await this.insertDefaultSettings();
  }

  private async insertDefaultCategories() {
    if (!this.db) throw new Error('Database not opened');
    const db = this.db;
    const [{ count }] = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM budget_categories'
    );

    if (count === 0) {
      const defaults = [
        { name: 'Alimentation', allocated: 400, color: '#059669' },
        { name: 'Transport',    allocated: 200, color: '#0891b2' },
        { name: 'Sorties',      allocated: 150, color: '#7c3aed' },
        { name: 'Shopping',     allocated: 100, color: '#dc2626' },
        { name: 'Santé',        allocated:  80, color: '#f59e0b' },
        { name: 'Épargne',      allocated: 300, color: '#10b981' },
      ];

      for (const c of defaults) {
        await db.runAsync(
          'INSERT INTO budget_categories (name, allocated, color) VALUES (?,?,?)',
          c.name, c.allocated, c.color
        );
      }
    }
  }

  private async insertDefaultSettings() {
    if (!this.db) throw new Error('Database not opened');
    const db = this.db;
    const [{ count }] = await db.getAllAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM user_settings'
    );

    if (count === 0) {
      await db.runAsync(
        'INSERT INTO user_settings (id, budgetMethod, currency, notifications, biometricEnabled) VALUES (1, ?, ?, ?, ?)',
        'thirds', 'EUR', 1, 0
      );
    }
  }

  /* ----- Transactions ----- */

  async addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>): Promise<number> {
    console.log('DatabaseService.addTransaction appelé avec:', t);
    
    try {
      await this.initialize();
      
      if (!this.db) {
        throw new Error('Database not available after initialization');
      }

      console.log('Base de données initialisée, ajout de la transaction...');
      
      const result = await this.db.runAsync(
        'INSERT INTO transactions (title, amount, category, date, description, isShared) VALUES (?, ?, ?, ?, ?, ?)',
        t.title,
        t.amount,
        t.category,
        t.date,
        t.description || null,
        t.isShared ? 1 : 0
      );

      console.log('Transaction insérée avec ID:', result.lastInsertRowId);
      
      // Mettre à jour le budget de la catégorie si c'est une dépense
      if (t.amount < 0) {
        console.log('Mise à jour du budget pour la catégorie:', t.category);
        const spentAmount = Math.abs(t.amount);
        console.log('Montant à ajouter aux dépenses:', spentAmount);
        
        await this.ensureCategoryExistsAndUpdate(t.category, spentAmount);
      }

      console.log('Transaction ajoutée avec succès, ID:', result.lastInsertRowId);
      return result.lastInsertRowId!;
    } catch (error: any) {
      console.error('Erreur dans addTransaction:', error);
      throw new Error(`Failed to add transaction: ${error.message || 'Unknown error'}`);
    }
  }

  async getTransactions(limit?: number): Promise<Transaction[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<Transaction>(
      `SELECT * FROM transactions
       ORDER BY date DESC, createdAt DESC
       ${limit ? `LIMIT ${limit}` : ''}`
    );
    return rows;
  }

  async deleteTransaction(id: number): Promise<void> {
    const db = await this.getDb();
    
    // Récupérer la transaction avant de la supprimer pour ajuster le budget
    const [transaction] = await db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE id = ?', id
    );
    
    if (transaction && transaction.amount < 0) {
      // Retirer le montant dépensé du budget de la catégorie
      await this.ensureCategoryExistsAndUpdate(transaction.category, -Math.abs(transaction.amount));
    }
    
    await db.runAsync('DELETE FROM transactions WHERE id = ?', id);
  }

  async updateTransaction(id: number, updates: Partial<Transaction>): Promise<void> {
    const db = await this.getDb();

    // Récupérer l'ancienne transaction pour ajuster les budgets
    const [oldTransaction] = await db.getAllAsync<Transaction>(
      'SELECT * FROM transactions WHERE id = ?', id
    );

    const fields: string[] = [];
    const values: any[] = [];

    if (updates.title !== undefined) { fields.push('title = ?'); values.push(updates.title); }
    if (updates.amount !== undefined) { fields.push('amount = ?'); values.push(updates.amount); }
    if (updates.category !== undefined) { fields.push('category = ?'); values.push(updates.category); }
    if (updates.description !== undefined) { fields.push('description = ?'); values.push(updates.description); }
    if (updates.isShared !== undefined) { fields.push('isShared = ?'); values.push(updates.isShared ? 1 : 0); }

    if (fields.length === 0) return;

    values.push(id);
    await db.runAsync(
      `UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );

    // Ajuster les budgets si nécessaire
    if (oldTransaction && (updates.amount !== undefined || updates.category !== undefined)) {
      const oldAmount = oldTransaction.amount;
      const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;
      const oldCategory = oldTransaction.category;
      const newCategory = updates.category !== undefined ? updates.category : oldCategory;

      // Retirer l'ancien montant de l'ancienne catégorie (si c'était une dépense)
      if (oldAmount < 0) {
        await this.ensureCategoryExistsAndUpdate(oldCategory, -Math.abs(oldAmount));
      }

      // Ajouter le nouveau montant à la nouvelle catégorie (si c'est une dépense)
      if (newAmount < 0) {
        await this.ensureCategoryExistsAndUpdate(newCategory, Math.abs(newAmount));
      }
    }
  }

  /* ----- Budget categories ----- */

  async getBudgetCategories(): Promise<BudgetCategory[]> {
    const db = await this.getDb();
    return await db.getAllAsync<BudgetCategory>(
      'SELECT * FROM budget_categories WHERE isActive = 1'
    );
  }

  async addBudgetCategory(c: Omit<BudgetCategory, 'id'>): Promise<number> {
    const db = await this.getDb();
    const res = await db.runAsync(
      'INSERT INTO budget_categories (name, allocated, spent, color, isActive) VALUES (?,?,?,?,?)',
      c.name, c.allocated, c.spent ?? 0, c.color, c.isActive ? 1 : 0
    );
    return res.lastInsertRowId!;
  }

  async updateBudgetCategory(id: number, up: Partial<BudgetCategory>): Promise<void> {
    const db = await this.getDb();

    const fields: string[] = [];
    const values: any[] = [];

    if (up.name       !== undefined) { fields.push('name = ?');       values.push(up.name);       }
    if (up.allocated  !== undefined) { fields.push('allocated = ?');  values.push(up.allocated);  }
    if (up.spent      !== undefined) { fields.push('spent = ?');      values.push(up.spent);      }
    if (up.color      !== undefined) { fields.push('color = ?');      values.push(up.color);      }
    if (up.isActive   !== undefined) { fields.push('isActive = ?');   values.push(up.isActive ? 1 : 0); }

    if (fields.length === 0) return;   // rien à mettre à jour

    values.push(id);
    await db.runAsync(
      `UPDATE budget_categories SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );
  }

  async resetBudgetCategories(): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('DELETE FROM budget_categories');
  }

  async updateCategorySpent(name: string, amount: number): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      'UPDATE budget_categories SET spent = spent + ? WHERE name = ?',
      amount, name
    );
  }

  /* ----- Helper pour gérer les catégories automatiquement ----- */

  private async ensureCategoryExistsAndUpdate(categoryName: string, spentAmount: number): Promise<void> {
    const db = await this.getDb();
    
    // Vérifier si la catégorie existe
    const [existingCategory] = await db.getAllAsync<BudgetCategory>(
      'SELECT * FROM budget_categories WHERE name = ? AND isActive = 1',
      categoryName
    );
    
    if (!existingCategory) {
      console.log('Catégorie inexistante, création automatique:', categoryName);
      // Créer la catégorie avec un budget par défaut
      await db.runAsync(
        'INSERT INTO budget_categories (name, allocated, spent, color, isActive) VALUES (?, ?, ?, ?, ?)',
        categoryName, 200, Math.max(0, spentAmount), '#64748b', 1
      );
    } else {
      console.log('Mise à jour de la catégorie existante:', categoryName, 'montant:', spentAmount);
      // Mettre à jour le montant dépensé
      await db.runAsync(
        'UPDATE budget_categories SET spent = spent + ? WHERE name = ? AND isActive = 1',
        spentAmount, categoryName
      );
      
      // S'assurer que spent ne devient jamais négatif
      await db.runAsync(
        'UPDATE budget_categories SET spent = MAX(0, spent) WHERE name = ? AND isActive = 1',
        categoryName
      );
    }
  }

  /* ----- Recalculer les budgets basés sur les transactions réelles ----- */

  async recalculateBudgetSpending(): Promise<void> {
    const db = await this.getDb();
    
    // Remettre à zéro tous les montants dépensés
    await db.runAsync('UPDATE budget_categories SET spent = 0 WHERE isActive = 1');
    
    // Recalculer basé sur les transactions réelles
    const transactions = await this.getTransactions();
    
    for (const transaction of transactions) {
      if (transaction.amount < 0) {
        await this.ensureCategoryExistsAndUpdate(transaction.category, Math.abs(transaction.amount));
      }
    }
  }

  /* ----- Savings goals ----- */

  async addSavingsGoal(g: Omit<SavingsGoal, 'id' | 'createdAt'>): Promise<number> {
    const db = await this.getDb();
    const res = await db.runAsync(
      `INSERT INTO savings_goals
       (name, targetAmount, currentAmount, targetDate, isActive)
       VALUES (?,?,?,?,?)`,
      g.name, g.targetAmount, g.currentAmount, g.targetDate, g.isActive ? 1 : 0
    );
    return res.lastInsertRowId!;
  }

  async getSavingsGoals(): Promise<SavingsGoal[]> {
    const db = await this.getDb();
    return await db.getAllAsync<SavingsGoal>(
      'SELECT * FROM savings_goals WHERE isActive = 1 ORDER BY createdAt DESC'
    );
  }

  /* ----- Secure storage ----- */

  async encryptAndStore(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  }
  async getSecureItem(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  }
  async deleteSecureItem(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  }

  /* ----- Reset complet ----- */

  async resetAllData(): Promise<void> {
    const db = await this.getDb();
    await db.execAsync(`
      DELETE FROM transactions;
      DELETE FROM budget_categories;
      DELETE FROM savings_goals;
      DELETE FROM user_settings;
    `);
    await this.insertDefaultCategories();
    await this.insertDefaultSettings();
  }
}

export const databaseService = new DatabaseService();