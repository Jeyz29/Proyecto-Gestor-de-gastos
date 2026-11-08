import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'gastos.sqlite');
export const db = new DatabaseSync(dbPath);

// Habilitar claves foráneas en SQLite
db.exec('PRAGMA foreign_keys = ON;');

// Crear tablas si no existen
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'tag',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subcategories (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL,
    subcategory_id TEXT,
    amount REAL NOT NULL,
    exchange_rate REAL NOT NULL DEFAULT 0,
    exchange_rate_eur REAL NOT NULL DEFAULT 0,
    amount_ves REAL NOT NULL DEFAULT 0,
    amount_eur REAL NOT NULL DEFAULT 0,
    description TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    subcategory_id TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    billing_cycle TEXT NOT NULL DEFAULT 'monthly', -- 'monthly' | 'annual'
    include_in_monthly INTEGER NOT NULL DEFAULT 1, -- 1 = se suma al mes, 0 = separado (gasto anual)
    billing_day INTEGER NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
  );
`);

// Migraciones seguras por si la tabla expenses ya existía sin las nuevas columnas
const expenseColumns = db.prepare("PRAGMA table_info('expenses')").all() as Array<{ name: string }>;
const colNames = new Set(expenseColumns.map((c) => c.name));
if (!colNames.has('exchange_rate')) {
  db.exec('ALTER TABLE expenses ADD COLUMN exchange_rate REAL NOT NULL DEFAULT 0;');
}
if (!colNames.has('exchange_rate_eur')) {
  db.exec('ALTER TABLE expenses ADD COLUMN exchange_rate_eur REAL NOT NULL DEFAULT 0;');
}
if (!colNames.has('amount_ves')) {
  db.exec('ALTER TABLE expenses ADD COLUMN amount_ves REAL NOT NULL DEFAULT 0;');
}
if (!colNames.has('amount_eur')) {
  db.exec('ALTER TABLE expenses ADD COLUMN amount_eur REAL NOT NULL DEFAULT 0;');
}
if (!colNames.has('subcategory_id')) {
  db.exec('ALTER TABLE expenses ADD COLUMN subcategory_id TEXT REFERENCES subcategories(id) ON DELETE SET NULL;');
}

// Insertar categorías iniciales por defecto si la tabla está vacía
const countStmt = db.prepare('SELECT COUNT(*) as total FROM categories');
const result = countStmt.get() as { total: number };

if (result.total === 0) {
  const now = new Date().toISOString();
  const initialCategories = [
    { name: 'Supermercado', color: '#10B981', icon: 'shopping-cart' },
    { name: 'Vivienda y Servicios', color: '#3B82F6', icon: 'home' },
    { name: 'Transporte', color: '#F59E0B', icon: 'car' },
    { name: 'Ocio y Salidas', color: '#8B5CF6', icon: 'coffee' },
    { name: 'Salud', color: '#EF4444', icon: 'heart' },
  ];

  const insertCat = db.prepare(
    'INSERT INTO categories (id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  for (const cat of initialCategories) {
    insertCat.run(crypto.randomUUID(), cat.name, cat.color, cat.icon, now);
  }
}

// Insertar subcategorías iniciales para Supermercado si aún no hay ninguna subcategoría creada
const subCountStmt = db.prepare('SELECT COUNT(*) as total FROM subcategories');
const subResult = subCountStmt.get() as { total: number };

if (subResult.total === 0) {
  const superCat = db
    .prepare("SELECT id FROM categories WHERE name LIKE 'Supermercado%' LIMIT 1")
    .get() as { id: string } | undefined;

  if (superCat) {
    const now = new Date().toISOString();
    const defaultSubs = ['Proteína', 'Verduras', 'Frutas', 'Víveres y Despensa', 'Limpieza y Aseo'];
    const insertSub = db.prepare(
      'INSERT INTO subcategories (id, category_id, name, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const subName of defaultSubs) {
      insertSub.run(crypto.randomUUID(), superCat.id, subName, now);
    }
  }
}
