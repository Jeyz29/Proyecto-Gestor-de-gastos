import type {
  BcvRateInfo,
  HistoricalBcvRate,
  Category,
  Subcategory,
  Expense,
  CreateCategoryInput,
  CreateSubcategoryInput,
  CreateExpenseInput,
  MonthlyCategoryHistory,
  Subscription,
  CreateSubscriptionInput,
} from '../types/index.ts';
import { supabase } from './supabaseClient.ts';

interface HistoricalEntry {
  fecha: string;
  promedio: number;
}

let historyCache: {
  fetchedAt: number;
  usd: HistoricalEntry[];
  eur: HistoricalEntry[];
} | null = null;

async function getHistoricalBcvLists() {
  const now = Date.now();
  if (historyCache && now - historyCache.fetchedAt < 30 * 60 * 1000) {
    return historyCache;
  }

  const [usdRes, eurRes] = await Promise.all([
    fetch('https://ve.dolarapi.com/v1/historicos/dolares/oficial', {
      signal: AbortSignal.timeout(8000),
    }),
    fetch('https://ve.dolarapi.com/v1/historicos/euros/oficial', {
      signal: AbortSignal.timeout(8000),
    }),
  ]);

  if (!usdRes.ok || !eurRes.ok) {
    throw new Error('No se pudo consultar el historial del BCV');
  }

  const usdList = (await usdRes.json()) as HistoricalEntry[];
  const eurList = (await eurRes.json()) as HistoricalEntry[];

  historyCache = {
    fetchedAt: now,
    usd: usdList.filter((i) => i.fecha && typeof i.promedio === 'number'),
    eur: eurList.filter((i) => i.fecha && typeof i.promedio === 'number'),
  };

  return historyCache;
}

function findRateForDate(
  list: HistoricalEntry[],
  targetDate: string
): {
  valueDateEntry: HistoricalEntry | null;
  publicationEntry: HistoricalEntry | null;
} {
  if (list.length === 0) return { valueDateEntry: null, publicationEntry: null };

  const sorted = [...list].sort((a, b) => a.fecha.localeCompare(b.fecha));

  let valueIdx = -1;
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].fecha <= targetDate) {
      valueIdx = i;
    } else {
      break;
    }
  }

  const valueDateEntry = valueIdx >= 0 ? sorted[valueIdx] : null;
  const publicationEntry =
    valueIdx >= 0 && valueIdx + 1 < sorted.length
      ? sorted[valueIdx + 1]
      : valueDateEntry;

  return { valueDateEntry, publicationEntry };
}

async function getSavedBcvRateFromSupabase(): Promise<BcvRateInfo | null> {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'bcv_rate')
      .maybeSingle();

    if (error || !data) return null;
    const parsed = JSON.parse(data.value);
    return {
      rate: Number(parsed.rate) || 0,
      eurRate: Number(parsed.eurRate) || 0,
      updatedAt: parsed.updatedAt || data.updated_at,
      source: parsed.source || 'cache',
    };
  } catch {
    return null;
  }
}

async function saveBcvRateToSupabase(info: BcvRateInfo): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('settings').upsert(
      {
        user_id: session.user.id,
        key: 'bcv_rate',
        value: JSON.stringify(info),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,key' }
    );
  } catch {
    // Ignorar errores de caché en segundo plano
  }
}

function mapExpenseRow(row: Record<string, unknown>): Expense {
  const cat = (row.categories || {}) as Record<string, unknown>;
  const sub = (row.subcategories || null) as Record<string, unknown> | null;
  return {
    id: String(row.id),
    category_id: String(row.category_id),
    subcategory_id: row.subcategory_id ? String(row.subcategory_id) : null,
    amount: Number(row.amount) || 0,
    exchange_rate: Number(row.exchange_rate) || 0,
    exchange_rate_eur: Number(row.exchange_rate_eur) || 0,
    amount_ves: Number(row.amount_ves) || 0,
    amount_eur: Number(row.amount_eur) || 0,
    description: String(row.description || ''),
    expense_date: String(row.expense_date || ''),
    created_at: String(row.created_at || ''),
    category_name: String(cat.name || 'Sin categoría'),
    category_color: String(cat.color || '#64748B'),
    category_icon: String(cat.icon || 'tag'),
    subcategory_name: sub && sub.name ? String(sub.name) : null,
  };
}

function mapSubscriptionRow(row: Record<string, unknown>): Subscription {
  const cat = (row.categories || {}) as Record<string, unknown>;
  const sub = (row.subcategories || null) as Record<string, unknown> | null;
  return {
    id: String(row.id),
    name: String(row.name || ''),
    category_id: String(row.category_id),
    subcategory_id: row.subcategory_id ? String(row.subcategory_id) : null,
    amount: Number(row.amount) || 0,
    currency: row.currency === 'EUR' ? 'EUR' : 'USD',
    billing_cycle: row.billing_cycle === 'annual' ? 'annual' : 'monthly',
    include_in_monthly: row.include_in_monthly ? 1 : 0,
    billing_day: Number(row.billing_day) || 1,
    active: row.active ? 1 : 0,
    created_at: String(row.created_at || ''),
    category_name: String(cat.name || 'Sin categoría'),
    category_color: String(cat.color || '#64748B'),
    category_icon: String(cat.icon || 'tag'),
    subcategory_name: sub && sub.name ? String(sub.name) : null,
  };
}

let seedingCategoriesPromise: Promise<Category[]> | null = null;

export const api = {
  // ---- Tasas BCV (USD y EUR) ----
  async getBcvRate(forceRefresh = false): Promise<BcvRateInfo> {
    try {
      if (!forceRefresh) {
        const saved = await getSavedBcvRateFromSupabase();
        if (saved && saved.source === 'manual' && saved.eurRate > 0) {
          return saved;
        }
      }

      const [usdRes, eurRes] = await Promise.all([
        fetch('https://ve.dolarapi.com/v1/dolares/oficial', {
          signal: AbortSignal.timeout(6000),
        }),
        fetch('https://ve.dolarapi.com/v1/euros/oficial', {
          signal: AbortSignal.timeout(6000),
        }),
      ]);

      if (!usdRes.ok || !eurRes.ok) {
        throw new Error('Error HTTP al consultar API BCV');
      }

      const usdData = (await usdRes.json()) as {
        promedio?: number;
        fechaActualizacion?: string;
      };
      const eurData = (await eurRes.json()) as {
        promedio?: number;
        fechaActualizacion?: string;
      };

      if (!usdData.promedio || typeof usdData.promedio !== 'number') {
        throw new Error('Respuesta inválida de Dólar BCV');
      }

      const info: BcvRateInfo = {
        rate: Number(usdData.promedio.toFixed(4)),
        eurRate:
          eurData.promedio && typeof eurData.promedio === 'number'
            ? Number(eurData.promedio.toFixed(4))
            : 0,
        updatedAt: usdData.fechaActualizacion || new Date().toISOString(),
        source: 'bcv-api',
      };

      await saveBcvRateToSupabase(info);
      return info;
    } catch {
      const cached = await getSavedBcvRateFromSupabase();
      if (cached) {
        return { ...cached, source: 'cache' };
      }
      throw new Error('No se pudo obtener las tasas del BCV');
    }
  },

  async getHistoricalBcvRate(date: string): Promise<HistoricalBcvRate> {
    try {
      const { usd, eur } = await getHistoricalBcvLists();
      const usdMatches = findRateForDate(usd, date);
      const eurMatches = findRateForDate(eur, date);

      const primaryUsd = usdMatches.publicationEntry || usdMatches.valueDateEntry;
      const primaryEur = eurMatches.publicationEntry || eurMatches.valueDateEntry;

      if (!primaryUsd) {
        const fallback = await getSavedBcvRateFromSupabase();
        return {
          date,
          effectiveDate: date,
          rate: fallback?.rate || 0,
          eurRate: fallback?.eurRate || 0,
          valueDateRate: fallback?.rate || 0,
          valueDateEurRate: fallback?.eurRate || 0,
          source: 'fallback',
        };
      }

      return {
        date,
        effectiveDate: primaryUsd.fecha,
        rate: Number(primaryUsd.promedio.toFixed(4)),
        eurRate: primaryEur ? Number(primaryEur.promedio.toFixed(4)) : 0,
        valueDateRate: usdMatches.valueDateEntry
          ? Number(usdMatches.valueDateEntry.promedio.toFixed(4))
          : Number(primaryUsd.promedio.toFixed(4)),
        valueDateEurRate: eurMatches.valueDateEntry
          ? Number(eurMatches.valueDateEntry.promedio.toFixed(4))
          : 0,
        source: 'bcv-history',
      };
    } catch {
      const fallback = await getSavedBcvRateFromSupabase();
      return {
        date,
        effectiveDate: date,
        rate: fallback?.rate || 0,
        eurRate: fallback?.eurRate || 0,
        valueDateRate: fallback?.rate || 0,
        valueDateEurRate: fallback?.eurRate || 0,
        source: 'fallback',
      };
    }
  },

  async setManualBcvRate(rate: number, eurRate: number): Promise<BcvRateInfo> {
    const info: BcvRateInfo = {
      rate: Number(Number(rate).toFixed(4)),
      eurRate: Number(Number(eurRate).toFixed(4)),
      updatedAt: new Date().toISOString(),
      source: 'manual',
    };
    await saveBcvRateToSupabase(info);
    return info;
  },

  // ---- Categorías ----
  async getCategories(): Promise<Category[]> {
    const { data, error } = await supabase
      .from('categories')
      .select('id, name, color, icon, created_at')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message || 'Error al cargar categorías');

    if (data && data.length > 0) {
      return data as Category[];
    }

    // Si es un usuario recién creado sin categorías, sembrar categorías por defecto una sola vez
    if (!seedingCategoriesPromise) {
      seedingCategoriesPromise = (async () => {
        try {
          const initialCategories = [
            { name: 'Supermercado', color: '#10B981', icon: 'shopping-cart' },
            { name: 'Vivienda y Servicios', color: '#3B82F6', icon: 'home' },
            { name: 'Transporte', color: '#F59E0B', icon: 'car' },
            { name: 'Ocio y Salidas', color: '#8B5CF6', icon: 'coffee' },
            { name: 'Salud', color: '#EF4444', icon: 'heart' },
          ];

          const { data: insertedCats, error: insertErr } = await supabase
            .from('categories')
            .insert(initialCategories)
            .select('id, name, color, icon, created_at');

          if (insertErr || !insertedCats) return [];

          const superCat = insertedCats.find((c) => c.name === 'Supermercado');
          if (superCat) {
            const defaultSubs = [
              'Proteína',
              'Verduras',
              'Frutas',
              'Víveres y Despensa',
              'Limpieza y Aseo',
            ];
            await supabase.from('subcategories').insert(
              defaultSubs.map((name) => ({
                category_id: superCat.id,
                name,
              }))
            );
          }

          return insertedCats as Category[];
        } finally {
          seedingCategoriesPromise = null;
        }
      })();
    }

    return seedingCategoriesPromise;
  },

  async createCategory(input: CreateCategoryInput): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name: input.name.trim(),
        color: input.color,
        icon: input.icon || 'tag',
      })
      .select('id, name, color, icon, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al crear la categoría');
    }
    return data as Category;
  },

  async updateCategory(id: string, input: CreateCategoryInput): Promise<Category> {
    const { data, error } = await supabase
      .from('categories')
      .update({
        name: input.name.trim(),
        color: input.color,
        icon: input.icon || 'tag',
      })
      .eq('id', id)
      .select('id, name, color, icon, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al actualizar la categoría');
    }
    return data as Category;
  },

  async deleteCategory(id: string): Promise<void> {
    const [{ count: expCount }, { count: subCount }] = await Promise.all([
      supabase
        .from('expenses')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id),
      supabase
        .from('subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', id),
    ]);

    if ((expCount || 0) > 0 || (subCount || 0) > 0) {
      throw new Error(
        `No se puede eliminar porque tiene ${expCount || 0} gasto(s) y ${
          subCount || 0
        } suscripción(es) asociada(s).`
      );
    }

    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) {
      throw new Error(error.message || 'Error al eliminar la categoría');
    }
  },

  // ---- Subcategorías ----
  async getSubcategories(): Promise<Subcategory[]> {
    const { data, error } = await supabase
      .from('subcategories')
      .select('id, category_id, name, created_at')
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message || 'Error al cargar subcategorías');
    return (data || []) as Subcategory[];
  },

  async createSubcategory(input: CreateSubcategoryInput): Promise<Subcategory> {
    const { data, error } = await supabase
      .from('subcategories')
      .insert({
        category_id: input.category_id,
        name: input.name.trim(),
      })
      .select('id, category_id, name, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al crear la subcategoría');
    }
    return data as Subcategory;
  },

  async updateSubcategory(id: string, name: string): Promise<Subcategory> {
    const { data, error } = await supabase
      .from('subcategories')
      .update({ name: name.trim() })
      .eq('id', id)
      .select('id, category_id, name, created_at')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al actualizar la subcategoría');
    }
    return data as Subcategory;
  },

  async deleteSubcategory(id: string): Promise<void> {
    const { error } = await supabase.from('subcategories').delete().eq('id', id);
    if (error) {
      throw new Error(error.message || 'Error al eliminar la subcategoría');
    }
  },

  // ---- Suscripciones ----
  async getSubscriptions(): Promise<Subscription[]> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(
        '*, categories(name, color, icon), subcategories(name)'
      )
      .order('billing_cycle', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message || 'Error al cargar las suscripciones');
    return (data || []).map((row) =>
      mapSubscriptionRow(row as Record<string, unknown>)
    );
  },

  async createSubscription(input: CreateSubscriptionInput): Promise<Subscription> {
    const normalizedSubId =
      typeof input.subcategory_id === 'string' && input.subcategory_id.trim() !== ''
        ? input.subcategory_id.trim()
        : null;

    const { data, error } = await supabase
      .from('subscriptions')
      .insert({
        name: input.name.trim(),
        category_id: input.category_id,
        subcategory_id: normalizedSubId,
        amount: Number(Number(input.amount).toFixed(2)),
        currency: input.currency === 'EUR' ? 'EUR' : 'USD',
        billing_cycle: input.billing_cycle === 'annual' ? 'annual' : 'monthly',
        include_in_monthly: Boolean(input.include_in_monthly),
        billing_day: Math.min(31, Math.max(1, Number(input.billing_day) || 1)),
        active: true,
      })
      .select('*, categories(name, color, icon), subcategories(name)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al crear la suscripción');
    }
    return mapSubscriptionRow(data as Record<string, unknown>);
  },

  async toggleSubscriptionMonthly(
    id: string,
    includeInMonthly: boolean
  ): Promise<Subscription> {
    const { data, error } = await supabase
      .from('subscriptions')
      .update({ include_in_monthly: Boolean(includeInMonthly) })
      .eq('id', id)
      .select('*, categories(name, color, icon), subcategories(name)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al actualizar la suscripción');
    }
    return mapSubscriptionRow(data as Record<string, unknown>);
  },

  async deleteSubscription(id: string): Promise<void> {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id);
    if (error) {
      throw new Error(error.message || 'Error al eliminar la suscripción');
    }
  },

  // ---- Gastos ----
  async getExpenses(month?: string): Promise<Expense[]> {
    let query = supabase
      .from('expenses')
      .select('*, categories(name, color, icon), subcategories(name)');

    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const m = Number(monthStr);
      const lastDay = new Date(year, m, 0).getDate();
      query = query
        .gte('expense_date', `${month}-01`)
        .lte('expense_date', `${month}-${String(lastDay).padStart(2, '0')}`);
    }

    const { data, error } = await query
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message || 'Error al cargar los gastos');
    return (data || []).map((row) => mapExpenseRow(row as Record<string, unknown>));
  },

  async getAnalytics(): Promise<MonthlyCategoryHistory[]> {
    const { data, error } = await supabase
      .from('monthly_expenses_analytics')
      .select('*')
      .order('month', { ascending: true });

    if (error) {
      throw new Error(error.message || 'Error al cargar el historial comparativo');
    }

    return (data || []).map((row: Record<string, unknown>) => ({
      month: String(row.month || ''),
      category_id: String(row.category_id || ''),
      category_name: String(row.category_name || ''),
      category_color: String(row.category_color || '#64748B'),
      subcategory_id: row.subcategory_id ? String(row.subcategory_id) : null,
      subcategory_name: row.subcategory_name ? String(row.subcategory_name) : null,
      total_usd: Number(row.total_usd) || 0,
      total_eur: Number(row.total_eur) || 0,
      total_ves: Number(row.total_ves) || 0,
      expense_count: Number(row.expense_count) || 0,
    }));
  },

  async createExpense(input: CreateExpenseInput): Promise<Expense> {
    const normalizedSubId =
      typeof input.subcategory_id === 'string' && input.subcategory_id.trim() !== ''
        ? input.subcategory_id.trim()
        : null;

    const amountUsd = Number(Number(input.amount).toFixed(2));
    const rateUsd = Number(Number(input.exchange_rate || 0).toFixed(4));
    const rateEur = Number(Number(input.exchange_rate_eur || 0).toFixed(4));
    const amountVes =
      input.amount_ves !== undefined && Number(input.amount_ves) > 0
        ? Number(Number(input.amount_ves).toFixed(2))
        : Number((amountUsd * rateUsd).toFixed(2));
    const amountEur =
      input.amount_eur !== undefined && Number(input.amount_eur) > 0
        ? Number(Number(input.amount_eur).toFixed(2))
        : rateEur > 0
        ? Number((amountVes / rateEur).toFixed(2))
        : 0;

    const { data, error } = await supabase
      .from('expenses')
      .insert({
        category_id: input.category_id,
        subcategory_id: normalizedSubId,
        amount: amountUsd,
        exchange_rate: rateUsd,
        exchange_rate_eur: rateEur,
        amount_ves: amountVes,
        amount_eur: amountEur,
        description: input.description.trim(),
        expense_date: input.expense_date,
      })
      .select('*, categories(name, color, icon), subcategories(name)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al registrar el gasto');
    }
    return mapExpenseRow(data as Record<string, unknown>);
  },

  async updateExpense(id: string, input: CreateExpenseInput): Promise<Expense> {
    const normalizedSubId =
      typeof input.subcategory_id === 'string' && input.subcategory_id.trim() !== ''
        ? input.subcategory_id.trim()
        : null;

    const amountUsd = Number(Number(input.amount).toFixed(2));
    const rateUsd = Number(Number(input.exchange_rate || 0).toFixed(4));
    const rateEur = Number(Number(input.exchange_rate_eur || 0).toFixed(4));
    const amountVes =
      input.amount_ves !== undefined && Number(input.amount_ves) > 0
        ? Number(Number(input.amount_ves).toFixed(2))
        : Number((amountUsd * rateUsd).toFixed(2));
    const amountEur =
      input.amount_eur !== undefined && Number(input.amount_eur) > 0
        ? Number(Number(input.amount_eur).toFixed(2))
        : rateEur > 0
        ? Number((amountVes / rateEur).toFixed(2))
        : 0;

    const { data, error } = await supabase
      .from('expenses')
      .update({
        category_id: input.category_id,
        subcategory_id: normalizedSubId,
        amount: amountUsd,
        exchange_rate: rateUsd,
        exchange_rate_eur: rateEur,
        amount_ves: amountVes,
        amount_eur: amountEur,
        description: input.description.trim(),
        expense_date: input.expense_date,
      })
      .eq('id', id)
      .select('*, categories(name, color, icon), subcategories(name)')
      .single();

    if (error || !data) {
      throw new Error(error?.message || 'Error al actualizar el gasto');
    }
    return mapExpenseRow(data as Record<string, unknown>);
  },

  async deleteExpense(id: string): Promise<void> {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
      throw new Error(error.message || 'Error al eliminar el gasto');
    }
  },
};
