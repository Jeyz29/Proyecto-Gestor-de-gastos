export interface BcvRateInfo {
  rate: number;    // Tasa BCV USD -> Bs.
  eurRate: number; // Tasa BCV EUR -> Bs.
  updatedAt: string;
  source: 'bcv-api' | 'cache' | 'manual';
}

export interface HistoricalBcvRate {
  date: string;
  effectiveDate: string;
  rate: number;
  eurRate: number;
  valueDateRate?: number;
  valueDateEurRate?: number;
  source: 'bcv-history' | 'fallback';
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon: string;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  created_at: string;
}

export interface Expense {
  id: string;
  category_id: string;
  subcategory_id: string | null;
  amount: number;            // Monto base en USD ($)
  exchange_rate: number;     // Tasa BCV USD usada en este gasto
  exchange_rate_eur: number; // Tasa BCV EUR usada en este gasto
  amount_ves: number;        // Equivalente en Bolívares (Bs.)
  amount_eur: number;        // Equivalente en Euros (€)
  description: string;
  expense_date: string;      // YYYY-MM-DD
  created_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  subcategory_name: string | null;
}

export interface CreateCategoryInput {
  name: string;
  color: string;
  icon?: string;
}

export interface CreateSubcategoryInput {
  category_id: string;
  name: string;
}

export interface CreateExpenseInput {
  category_id: string;
  subcategory_id?: string | null;
  amount: number;
  exchange_rate?: number;
  exchange_rate_eur?: number;
  amount_ves?: number;
  amount_eur?: number;
  description: string;
  expense_date: string;
}

export interface SubcategoryBreakdownItem {
  subcategory_id: string | null;
  name: string;
  total: number;
  totalEur: number;
  totalVes: number;
  percentageOfCategory: number;
  count: number;
}

export interface CategoryBreakdown {
  category_id: string;
  name: string;
  color: string;
  total: number;
  totalEur: number;
  totalVes: number;
  percentage: number;
  count: number;
  subcategories: SubcategoryBreakdownItem[];
}

export interface MonthlyCategoryHistory {
  month: string; // YYYY-MM
  category_id: string;
  category_name: string;
  category_color: string;
  subcategory_id: string | null;
  subcategory_name: string | null;
  total_usd: number;
  total_eur: number;
  total_ves: number;
  expense_count: number;
}

export interface Subscription {
  id: string;
  name: string;
  category_id: string;
  subcategory_id: string | null;
  amount: number;        // Monto base en USD ($)
  currency: 'USD' | 'EUR';
  billing_cycle: 'monthly' | 'annual';
  include_in_monthly: number; // 1 = incluido en el gasto mensual, 0 = separado para gasto anual
  billing_day: number;
  active: number;
  created_at: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  subcategory_name: string | null;
}

export interface CreateSubscriptionInput {
  name: string;
  category_id: string;
  subcategory_id?: string | null;
  amount: number;
  currency?: 'USD' | 'EUR';
  billing_cycle: 'monthly' | 'annual';
  include_in_monthly: boolean;
  billing_day: number;
}
