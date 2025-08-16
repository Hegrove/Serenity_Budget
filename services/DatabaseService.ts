import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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
  includedInBudget?: number; // 1 = inclus dans le budget, 0 = hors budget
  isLocked?: number;         // 1/0
  weight?: number;           // >=0
  isBuffer?: number;         // 1/0
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

  async initialize() {
    if (this.isInitialized && this.db) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = this.performInitialization();
    try { await this.initializationPromise; }
    finally { this.initializationPromise = null; }
  }

  private async performInitialization() {
    try {
      const db = await SQLite.openDatabaseAsync('serenite_budget.db');
      this.db = db;

      // (optionnel) quelques pragmas tolérés
      // await db.execAsync('PRAGMA journal_mode = WAL');

      await this.createSchema(db);
      this.isInitialized = true;
      console.log('Database initialized');
    } catch (error: any) {
      console.error('Database init failed →', error);
      throw new Error(`DB init error: ${error?.message || 'unknown'}`);
    }
  }

  private async getDb(): Promise<SQLite.SQLiteDatabase> {
    // ⚠️ getDb ne doit JAMAIS être appelé depuis createSchema/insertDefaults
    await this.initialize();
    if (!this.db) throw new Error('Database unavailable');
    return this.db;
  }

  // Tout ce qui suit est appelé UNIQUEMENT depuis performInitialization(db)
  private async createSchema(db: SQLite.SQLiteDatabase) {
    // 1) CREATE TABLE (une par une)
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
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS budget_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        allocated REAL NOT NULL,
        spent REAL DEFAULT 0,
        color TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        includedInBudget INTEGER DEFAULT 1, -- colonnes "nouvelles" déjà là pour new installs
        isLocked INTEGER DEFAULT 0,
        weight REAL DEFAULT 1,
        isBuffer INTEGER DEFAULT 0
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS savings_goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        targetAmount REAL NOT NULL,
        currentAmount REAL DEFAULT 0,
        targetDate TEXT NOT NULL,
        isActive INTEGER DEFAULT 1,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS user_settings (
        id INTEGER PRIMARY KEY,
        budgetMethod TEXT DEFAULT 'thirds',
        currency TEXT DEFAULT 'EUR',
        notifications INTEGER DEFAULT 1,
        biometricEnabled INTEGER DEFAULT 0,
        monthlyBudget REAL
      );
    `);

    // 2) Migrations "safe" (anciennes installs) → une par une
    try { await db.execAsync(`ALTER TABLE budget_categories ADD COLUMN includedInBudget INTEGER DEFAULT 1`); } catch {}
    try { await db.execAsync(`ALTER TABLE budget_categories ADD COLUMN isLocked INTEGER DEFAULT 0`); } catch {}
    try { await db.execAsync(`ALTER TABLE budget_categories ADD COLUMN weight REAL DEFAULT 1`); } catch {}
    try { await db.execAsync(`ALTER TABLE budget_categories ADD COLUMN isBuffer INTEGER DEFAULT 0`); } catch {}
    try { await db.execAsync(`ALTER TABLE user_settings ADD COLUMN monthlyBudget REAL`); } catch {}

    // 3) Données par défaut (toujours via ce db)
    await this.insertDefaultCategories(db);
    await this.insertDefaultSettings(db);

    // 4) Backfill monthlyBudget si vide
    await db.execAsync(`
      UPDATE user_settings SET monthlyBudget = (
        SELECT IFNULL(SUM(allocated), 0)
        FROM budget_categories
        WHERE isActive = 1 AND includedInBudget = 1
      )
      WHERE monthlyBudget IS NULL OR monthlyBudget = 0
    `);
  }

  private async insertDefaultCategories(db: SQLite.SQLiteDatabase) {
    const defaults = [
      { name: 'Alimentation', allocated: 400, color: '#059669', included: 1 },
      { name: 'Transport',    allocated: 200, color: '#0891b2', included: 1 },
      { name: 'Sorties',      allocated: 150, color: '#7c3aed', included: 1 },
      { name: 'Shopping',     allocated: 100, color: '#dc2626', included: 1 },
      { name: 'Santé',        allocated:  80, color: '#f59e0b', included: 1 },
      { name: 'Logement',     allocated:  0,  color: '#3b82f6', included: 1 },
      { name: 'Revenus',      allocated:  0,  color: '#10b981', included: 1 },
      { name: 'Epargne',      allocated: 200, color: '#10b981', included: 1 },
      { name: 'Imprévus',     allocated:   0, color: '#64748b', included: 1 }, // tampon
      { name: 'Autres',       allocated:   0, color: '#94a3b8', included: 0 }, // hors budget
    ];

    for (const c of defaults) {
      await db.runAsync(
        `INSERT OR IGNORE INTO budget_categories
         (name, allocated, spent, color, isActive, includedInBudget, isLocked, weight, isBuffer)
         VALUES (?, ?, 0, ?, 1, ?, 0, 1, ?)`,
        c.name, c.allocated, c.color, c.included, c.name === 'Imprévus' ? 1 : 0
      );
    }

    // Normalisations utiles
    await db.runAsync(`UPDATE budget_categories SET includedInBudget = 0, allocated = 0 WHERE name = 'Autres'`);
    await db.runAsync(`UPDATE budget_categories SET isBuffer = 1 WHERE name = 'Imprévus'`);
  }

  private async insertDefaultSettings(db: SQLite.SQLiteDatabase) {
    // si pas de settings → en créer un
    const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) as count FROM user_settings`);
    if (!row || row.count === 0) {
      await db.runAsync(
        `INSERT INTO user_settings (id, budgetMethod, currency, notifications, biometricEnabled, monthlyBudget)
         VALUES (1, ?, ?, ?, ?, NULL)`,
        'thirds', 'EUR', 1, 0
      );
    }
  }

  /* ----- Helpers budget total ----- */

  async getMonthlyBudget(): Promise<number> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ monthlyBudget: number }>(
      'SELECT monthlyBudget FROM user_settings WHERE id = 1'
    );
    return row?.monthlyBudget ?? 0;
  }

  async setMonthlyBudget(v: number): Promise<void> {
    const db = await this.getDb();
    await db.runAsync('UPDATE user_settings SET monthlyBudget = ? WHERE id = 1', v);
  }

  /* ----- Répartition proportionnelle ----- */

  /**
   * Ré-étale allocations pour garder Σ(allocations budgétées) = monthlyBudget.
   * @param protectedId id de la catégorie modifiée
   * @param delta newAllocated - oldAllocated ; >0 on doit "trouver" de l'argent, <0 on "libère"
   * Règles :
   *  - on puise/dépose d'abord dans le tampon (isBuffer=1, ≠ protected)
   *  - sinon on répartit sur catégories non verrouillées (isLocked=0, isBuffer=0) au prorata de weight
   *  - locked (isLocked=1) et le tampon ne bougent pas (hors étape tampon)
   */
  async rebalanceAllocationsV2(protectedId: number, delta: number): Promise<void> {
    const db = await this.getDb();
    const B = await this.getMonthlyBudget();

    const cats = await db.getAllAsync<{
      id: number; name: string; allocated: number;
      includedInBudget: number; isLocked: number; weight: number; isBuffer: number;
    }>(
      `SELECT id, name, allocated, includedInBudget, isLocked, weight, isBuffer
       FROM budget_categories WHERE isActive = 1 AND includedInBudget = 1`
    );

    const prot = cats.find(c => c.id === protectedId);
    if (!prot) return;

    const buffer = cats.find(c => c.isBuffer === 1 && c.id !== protectedId);
    const adjustable = cats.filter(c => c.id !== protectedId && c.isLocked !== 1 && c.isBuffer !== 1);

    // On va collecter seulement les lignes à MAJ
    const updates: Array<{ id: number; allocated: number }> = [];
    // Besoin d'argent (delta > 0)
    if (delta > 0) {
      let remaining = +delta.toFixed(2);

      if (buffer && buffer.allocated > 0) {
        const take = Math.min(remaining, buffer.allocated);
        buffer.allocated = +(buffer.allocated - take).toFixed(2);
        remaining = +(remaining - take).toFixed(2);
        updates.push({ id: buffer.id, allocated: buffer.allocated });
      }

      if (remaining > 0 && adjustable.length > 0) {
        const totalWeight = adjustable.reduce((s, c) => s + (c.weight || 1), 0) || 1;
        let acc = 0;
        adjustable.forEach((c, i) => {
          const raw = (remaining * (c.weight || 1)) / totalWeight;
          let give = i === adjustable.length - 1 ? +(remaining - acc).toFixed(2) : +raw.toFixed(2);
          give = Math.min(give, c.allocated); // ne pas passer < 0
          c.allocated = +(c.allocated - give).toFixed(2);
          acc = +(acc + give).toFixed(2);
          updates.push({ id: c.id, allocated: c.allocated });
        });
      }
    }

    // On libère de l'argent (delta < 0)
    if (delta < 0) {
      const freed = +(-delta).toFixed(2);
      if (buffer) {
        buffer.allocated = +(buffer.allocated + freed).toFixed(2);
        updates.push({ id: buffer.id, allocated: buffer.allocated });
      } else if (adjustable.length > 0) {
        const totalWeight = adjustable.reduce((s, c) => s + (c.weight || 1), 0) || 1;
        let acc = 0;
        adjustable.forEach((c, i) => {
          const raw = (freed * (c.weight || 1)) / totalWeight;
          const add = i === adjustable.length - 1 ? +(freed - acc).toFixed(2) : +raw.toFixed(2);
          c.allocated = +(c.allocated + add).toFixed(2);
          acc = +(acc + add).toFixed(2);
          updates.push({ id: c.id, allocated: c.allocated });
        });
      }
    }

    // Écrire en transaction (db.*, pas tx.*)
    if (updates.length) {
      await db.withTransactionAsync(async () => {
        for (const u of updates) {
          if (u.id == null || !Number.isFinite(u.allocated)) {
            throw new Error(`Rebalance: invalid update payload id=${u.id} allocated=${u.allocated}`);
          }
          console.log('SQL UPDATE budget_categories SET allocated = ? WHERE id = ?', u.allocated, u.id);
          await db.runAsync('UPDATE budget_categories SET allocated = ? WHERE id = ?', u.allocated, u.id);
        }
      });
    }

    // Correction arrondis → forcer Σ = B (en favorisant le tampon, sinon la protégée)
    const row = await db.getFirstAsync<{ s: number }>(
      `SELECT IFNULL(SUM(allocated),0) as s
       FROM budget_categories WHERE isActive=1 AND includedInBudget=1`
    );
    const total = row?.s ?? 0;
    const diff = +(B - total).toFixed(2);
    if (Math.abs(diff) >= 0.01) {
      const target = buffer ?? prot;
      const newAlloc = +(target.allocated + diff).toFixed(2);
      console.log('SQL FIX SUM → UPDATE budget_categories SET allocated = ? WHERE id = ?', newAlloc, target.id);
      await db.runAsync('UPDATE budget_categories SET allocated = ? WHERE id = ?', newAlloc, target.id);
    }
  }

  /* ----- Helper pour garantir l'existence d'une catégorie ----- */

  private async ensureCategory(name: string): Promise<void> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM budget_categories WHERE name = ?', name
    );
    if (rows.length === 0) {
      const included = (name === 'Autres' || name === 'Revenus') ? 0 : 1;
      const color = name === 'Autres' ? '#94a3b8' : 
                   name === 'Revenus' ? '#059669' : '#0891b2';
      await db.runAsync(
        `INSERT INTO budget_categories (name, allocated, spent, color, isActive, includedInBudget)
         VALUES (?, 0, 0, ?, 1, ?)`,
        name, color, included
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
      
      // S'assurer que la catégorie existe avant de mettre à jour les dépenses
      await this.ensureCategory(t.category);
      
      // Mettre à jour le budget de la catégorie si c'est une dépense
      if (t.amount < 0) {
        console.log('Mise à jour du budget pour la catégorie:', t.category);
        const spentAmount = Math.abs(t.amount);
        console.log('Montant à ajouter aux dépenses:', spentAmount);
        
        await this.updateCategorySpent(t.category, spentAmount);
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
      await this.ensureCategory(transaction.category);
      await this.updateCategorySpent(transaction.category, -Math.abs(transaction.amount));
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
        await this.ensureCategory(oldCategory);
        await this.updateCategorySpent(oldCategory, -Math.abs(oldAmount));
      }

      // Ajouter le nouveau montant à la nouvelle catégorie (si c'est une dépense)
      if (newAmount < 0) {
        await this.ensureCategory(newCategory);
        await this.updateCategorySpent(newCategory, Math.abs(newAmount));
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
      `INSERT INTO budget_categories
       (name, allocated, spent, color, isActive, includedInBudget, isLocked, weight, isBuffer)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      c.name,
      c.allocated ?? 0,
      c.spent ?? 0,
      c.color ?? '#0891b2',
      c.isActive ? 1 : 0,
      (c.includedInBudget ?? 1) ? 1 : 0,
      (c.isLocked ?? 0) ? 1 : 0,
      c.weight ?? 1,
      (c.isBuffer ?? 0) ? 1 : 0
    );
    
    const id = res.lastInsertRowId!;
    
    // Répartition V2 si catégorie budgétée avec allocation > 0
    if (((c.includedInBudget ?? 1) !== 0) && (c.allocated ?? 0) !== 0) {
      await this.rebalanceAllocationsV2(id, c.allocated ?? 0); // old=0 → delta = allocated
    }
    
    return id;
  }

  async updateBudgetCategory(id: number, up: Partial<BudgetCategory>): Promise<void> {
    const db = await this.getDb();
    
    const before = await db.getFirstAsync<{ allocated:number; includedInBudget:number }>(
      'SELECT allocated, includedInBudget FROM budget_categories WHERE id = ?', id
    );

    const fields: string[] = [];
    const values: any[] = [];

    if (up.name       !== undefined) { fields.push('name = ?');       values.push(up.name);       }
    if (up.allocated  !== undefined) { fields.push('allocated = ?');  values.push(up.allocated);  }
    if (up.spent      !== undefined) { fields.push('spent = ?');      values.push(up.spent);      }
    if (up.color      !== undefined) { fields.push('color = ?');      values.push(up.color);      }
    if (up.isActive   !== undefined) { fields.push('isActive = ?');   values.push(up.isActive ? 1 : 0); }
    if (up.includedInBudget !== undefined) { fields.push('includedInBudget = ?'); values.push(up.includedInBudget ? 1 : 0); }
    if (up.isLocked   !== undefined) { fields.push('isLocked = ?');   values.push(up.isLocked ? 1 : 0); }
    if (up.weight     !== undefined) { fields.push('weight = ?');     values.push(up.weight ?? 1); }
    if (up.isBuffer   !== undefined) { fields.push('isBuffer = ?');   values.push(up.isBuffer ? 1 : 0); }

    if (fields.length === 0) return;   // rien à mettre à jour

    // ⚠️ AJOUTE L'ID
    values.push(id);

    // 🔒 Log utile
    console.log('SQL UPDATE budget_categories SET', fields.join(', '), 'WHERE id = ?', values);

    await db.runAsync(
      `UPDATE budget_categories SET ${fields.join(', ')} WHERE id = ?`,
      ...values
    );
    
    const after = await db.getFirstAsync<{ allocated:number; includedInBudget:number }>(
      'SELECT allocated, includedInBudget FROM budget_categories WHERE id = ?', id
    );

    if (after?.includedInBudget) {
      // si la cat vient d'entrer dans le budget, oldAllocated = 0
      const oldAlloc = before?.includedInBudget ? (before.allocated ?? 0) : 0;
      const delta = (after.allocated ?? 0) - oldAlloc;
      if (delta !== 0) {
        await this.rebalanceAllocationsV2(id, delta);
      }
    }
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

  /* ----- Recalculer les budgets basés sur les transactions réelles ----- */

  async recalculateBudgetSpending(): Promise<void> {
    const db = await this.getDb();
    
    // Remettre à zéro tous les montants dépensés
    await db.runAsync('UPDATE budget_categories SET spent = 0 WHERE isActive = 1');
    
    // Recalculer basé sur les transactions réelles
    const transactions = await this.getTransactions();
    
    for (const transaction of transactions) {
      if (transaction.amount < 0) {
        await this.ensureCategory(transaction.category);
        await this.updateCategorySpent(transaction.category, Math.abs(transaction.amount));
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

  async encryptAndStore(key: string, value: string): Promise<void> {
    await this.secureSetItem(key, value);
  }
  async getSecureItem(key: string): Promise<string | null> {
    return this.secureGetItem(key);
  }
  async deleteSecureItem(key: string): Promise<void> {
    await this.secureDeleteItem(key);
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

  /* ----- Helper pour récupérer les noms de catégories ----- */

  async getCategoryNames(): Promise<string[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<{ name: string }>(
      'SELECT name FROM budget_categories WHERE isActive = 1 ORDER BY name ASC'
    );
    return rows.map(r => r.name);
  }
}

export const databaseService = new DatabaseService();