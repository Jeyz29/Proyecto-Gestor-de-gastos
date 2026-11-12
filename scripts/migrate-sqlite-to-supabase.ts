import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sqlitePath = path.join(__dirname, '..', 'backend', 'gastos.sqlite');

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || 'https://yacfwgdbtojuzdnpqfdm.supabase.co';
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_wBRMcwxiMXfyPOYcyFuLMA_0-3yVFWV';

const email = process.env.MIGRATE_EMAIL || process.argv[2];
const password = process.env.MIGRATE_PASSWORD || process.argv[3];

if (!email || !password) {
  console.error(
    'Uso: npx tsx scripts/migrate-sqlite-to-supabase.ts <tu-correo> <tu-contraseña>'
  );
  process.exit(1);
}

async function runMigration() {
  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log(`Autenticando usuario ${email} en Supabase...`);
  const { data: authData, error: authErr } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    });

  if (authErr || !authData.user) {
    console.error('Error al iniciar sesión en Supabase:', authErr?.message);
    process.exit(1);
  }

  const userId = authData.user.id;
  console.log(`Sesión iniciada correctamente (user_id: ${userId}).`);

  const db = new DatabaseSync(sqlitePath);

  // 1. Limpiar posibles categorías por defecto vacías si el usuario recién se registró
  const existingExps = await supabase
    .from('expenses')
    .select('id', { count: 'exact', head: true });
  if ((existingExps.count || 0) === 0) {
    await supabase.from('subcategories').delete().eq('user_id', userId);
    await supabase.from('categories').delete().eq('user_id', userId);
  }

  // 2. Migrar Categorías
  const categories = db.prepare('SELECT * FROM categories').all() as Array<{
    id: string;
    name: string;
    color: string;
    icon: string;
    created_at: string;
  }>;

  if (categories.length > 0) {
    const { error: catErr } = await supabase.from('categories').upsert(
      categories.map((c) => ({
        id: c.id,
        user_id: userId,
        name: c.name,
        color: c.color,
        icon: c.icon || 'tag',
        created_at: c.created_at,
      }))
    );
    if (catErr) throw new Error(`Error migrando categorías: ${catErr.message}`);
    console.log(`✔ ${categories.length} categorías migradas.`);
  }

  // 3. Migrar Subcategorías
  const subcategories = db.prepare('SELECT * FROM subcategories').all() as Array<{
    id: string;
    category_id: string;
    name: string;
    created_at: string;
  }>;

  if (subcategories.length > 0) {
    const { error: subErr } = await supabase.from('subcategories').upsert(
      subcategories.map((s) => ({
        id: s.id,
        user_id: userId,
        category_id: s.category_id,
        name: s.name,
        created_at: s.created_at,
      }))
    );
    if (subErr) throw new Error(`Error migrando subcategorías: ${subErr.message}`);
    console.log(`✔ ${subcategories.length} subcategorías migradas.`);
  }

  // 4. Migrar Suscripciones
  const subscriptions = db.prepare('SELECT * FROM subscriptions').all() as Array<{
    id: string;
    name: string;
    category_id: string;
    subcategory_id: string | null;
    amount: number;
    currency: string;
    billing_cycle: string;
    include_in_monthly: number;
    billing_day: number;
    active: number;
    created_at: string;
  }>;

  if (subscriptions.length > 0) {
    const { error: subsErr } = await supabase.from('subscriptions').upsert(
      subscriptions.map((s) => ({
        id: s.id,
        user_id: userId,
        name: s.name,
        category_id: s.category_id,
        subcategory_id: s.subcategory_id || null,
        amount: s.amount,
        currency: s.currency || 'USD',
        billing_cycle: s.billing_cycle || 'monthly',
        include_in_monthly: Boolean(s.include_in_monthly),
        billing_day: s.billing_day || 1,
        active: Boolean(s.active),
        created_at: s.created_at,
      }))
    );
    if (subsErr) throw new Error(`Error migrando suscripciones: ${subsErr.message}`);
    console.log(`✔ ${subscriptions.length} suscripciones migradas.`);
  }

  // 5. Migrar Gastos
  const expenses = db.prepare('SELECT * FROM expenses').all() as Array<{
    id: string;
    category_id: string;
    subcategory_id: string | null;
    amount: number;
    exchange_rate: number;
    exchange_rate_eur: number;
    amount_ves: number;
    amount_eur: number;
    description: string;
    expense_date: string;
    created_at: string;
  }>;

  if (expenses.length > 0) {
    const { error: expErr } = await supabase.from('expenses').upsert(
      expenses.map((e) => ({
        id: e.id,
        user_id: userId,
        category_id: e.category_id,
        subcategory_id: e.subcategory_id || null,
        amount: e.amount,
        exchange_rate: e.exchange_rate || 0,
        exchange_rate_eur: e.exchange_rate_eur || 0,
        amount_ves: e.amount_ves || 0,
        amount_eur: e.amount_eur || 0,
        description: e.description,
        expense_date: e.expense_date,
        created_at: e.created_at,
      }))
    );
    if (expErr) throw new Error(`Error migrando gastos: ${expErr.message}`);
    console.log(`✔ ${expenses.length} movimientos de gastos migrados.`);
  }

  console.log('🎉 ¡Migración de SQLite a Supabase completada con éxito!');
}

runMigration().catch((err) => {
  console.error('Fallo en la migración:', err);
  process.exit(1);
});
