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

const API_BASE = '/api';

export const api = {
  // ---- Tasas BCV (USD y EUR) ----
  async getBcvRate(forceRefresh = false): Promise<BcvRateInfo> {
    const query = forceRefresh ? '?refresh=true' : '';
    const res = await fetch(`${API_BASE}/bcv-rate${query}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al obtener las tasas del BCV');
    }
    return res.json();
  },

  async getHistoricalBcvRate(date: string): Promise<HistoricalBcvRate> {
    const res = await fetch(`${API_BASE}/bcv-rate/history?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      throw new Error('Error al consultar la tasa histórica del BCV');
    }
    return res.json();
  },

  async setManualBcvRate(rate: number, eurRate: number): Promise<BcvRateInfo> {
    const res = await fetch(`${API_BASE}/bcv-rate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rate, eurRate }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar las tasas');
    }
    return res.json();
  },

  // ---- Categorías ----
  async getCategories(): Promise<Category[]> {
    const res = await fetch(`${API_BASE}/categories`);
    if (!res.ok) throw new Error('Error al cargar categorías');
    return res.json();
  },

  async createCategory(data: CreateCategoryInput): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear la categoría');
    }
    return res.json();
  },

  async updateCategory(id: string, data: CreateCategoryInput): Promise<Category> {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar la categoría');
    }
    return res.json();
  },

  async deleteCategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar la categoría');
    }
  },

  // ---- Subcategorías ----
  async getSubcategories(): Promise<Subcategory[]> {
    const res = await fetch(`${API_BASE}/subcategories`);
    if (!res.ok) throw new Error('Error al cargar subcategorías');
    return res.json();
  },

  async createSubcategory(data: CreateSubcategoryInput): Promise<Subcategory> {
    const res = await fetch(`${API_BASE}/subcategories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear la subcategoría');
    }
    return res.json();
  },

  async updateSubcategory(id: string, name: string): Promise<Subcategory> {
    const res = await fetch(`${API_BASE}/subcategories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar la subcategoría');
    }
    return res.json();
  },

  async deleteSubcategory(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/subcategories/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar la subcategoría');
    }
  },

  // ---- Suscripciones ----
  async getSubscriptions(): Promise<Subscription[]> {
    const res = await fetch(`${API_BASE}/subscriptions`);
    if (!res.ok) throw new Error('Error al cargar las suscripciones');
    return res.json();
  },

  async createSubscription(data: CreateSubscriptionInput): Promise<Subscription> {
    const res = await fetch(`${API_BASE}/subscriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear la suscripción');
    }
    return res.json();
  },

  async toggleSubscriptionMonthly(
    id: string,
    includeInMonthly: boolean
  ): Promise<Subscription> {
    const res = await fetch(`${API_BASE}/subscriptions/${id}/toggle-monthly`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ include_in_monthly: includeInMonthly }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar la suscripción');
    }
    return res.json();
  },

  async deleteSubscription(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/subscriptions/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar la suscripción');
    }
  },

  // ---- Gastos ----
  async getExpenses(month?: string): Promise<Expense[]> {
    const query = month ? `?month=${encodeURIComponent(month)}` : '';
    const res = await fetch(`${API_BASE}/expenses${query}`);
    if (!res.ok) throw new Error('Error al cargar los gastos');
    return res.json();
  },

  async getAnalytics(): Promise<MonthlyCategoryHistory[]> {
    const res = await fetch(`${API_BASE}/expenses/analytics`);
    if (!res.ok) throw new Error('Error al cargar el historial comparativo');
    return res.json();
  },

  async createExpense(data: CreateExpenseInput): Promise<Expense> {
    const res = await fetch(`${API_BASE}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al registrar el gasto');
    }
    return res.json();
  },

  async updateExpense(id: string, data: CreateExpenseInput): Promise<Expense> {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar el gasto');
    }
    return res.json();
  },

  async deleteExpense(id: string): Promise<void> {
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al eliminar el gasto');
    }
  },
};
