import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Tags,
  WalletCards,
  RefreshCw,
  Edit3,
  Check,
  X,
  ListPlus,
  BarChart3,
  Repeat,
  Calendar,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import { supabase, DEMO_CREDENTIALS } from './services/supabaseClient.ts';
import { api } from './services/api.ts';
import { AuthView } from './components/auth/AuthView.tsx';
import type {
  BcvRateInfo,
  Category,
  Subcategory,
  Expense,
  Subscription,
  CreateCategoryInput,
  CreateSubcategoryInput,
  CreateExpenseInput,
  CreateSubscriptionInput,
  CategoryBreakdown,
  SubcategoryBreakdownItem,
  MonthlyCategoryHistory,
} from './types/index.ts';
import {
  formatMonthLabel,
  formatBolivares,
  getCurrentYearMonth,
  shiftMonth,
} from './utils/formatters.ts';
import { MonthlySummary } from './components/expenses/MonthlySummary.tsx';
import { ExpenseForm } from './components/expenses/ExpenseForm.tsx';
import { ExpenseList } from './components/expenses/ExpenseList.tsx';
import { MonthlyComparisonView } from './components/expenses/MonthlyComparisonView.tsx';
import { AnnualSummaryView } from './components/expenses/AnnualSummaryView.tsx';
import { SubscriptionsView } from './components/subscriptions/SubscriptionsView.tsx';
import { CategoryManagerModal } from './components/categories/CategoryManagerModal.tsx';

export const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);

  const [activeTab, setActiveTab] = useState<
    'monthly' | 'subscriptions' | 'comparison' | 'annual'
  >('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentYearMonth());
  const [selectedYear, setSelectedYear] = useState<number>(
    Number(getCurrentYearMonth().slice(0, 4))
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [analyticsHistory, setAnalyticsHistory] = useState<MonthlyCategoryHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [backendError, setBackendError] = useState<boolean>(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState<boolean>(false);
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);

  // Estado de las tasas BCV (Dólar y Euro)
  const [bcvInfo, setBcvInfo] = useState<BcvRateInfo>({
    rate: 0,
    eurRate: 0,
    updatedAt: '',
    source: 'bcv-api',
  });
  const [refreshingBcv, setRefreshingBcv] = useState<boolean>(false);
  const [isEditingRate, setIsEditingRate] = useState<boolean>(false);
  const [manualUsdInput, setManualUsdInput] = useState<string>('');
  const [manualEurInput, setManualEurInput] = useState<string>('');

  // Escuchar cambios de sesión de Supabase Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setAuthChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthChecking(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadBcvRate = useCallback(async (forceRefresh = false) => {
    setRefreshingBcv(true);
    try {
      const data = await api.getBcvRate(forceRefresh);
      setBcvInfo(data);
      setManualUsdInput(String(data.rate));
      setManualEurInput(String(data.eurRate));
    } catch (err) {
      console.error('Error al obtener tasas BCV:', err);
    } finally {
      setRefreshingBcv(false);
    }
  }, []);

  const loadCategoriesAndSubs = useCallback(async () => {
    const [cats, subs, recurring] = await Promise.all([
      api.getCategories(),
      api.getSubcategories(),
      api.getSubscriptions(),
    ]);
    setCategories(cats);
    setSubcategories(subs);
    setSubscriptions(recurring);
  }, []);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await api.getAnalytics();
      setAnalyticsHistory(data);
    } catch (err) {
      console.error('Error al cargar analíticas:', err);
    }
  }, []);

  const loadExpenses = useCallback(async (month: string) => {
    setLoading(true);
    setBackendError(false);
    try {
      const data = await api.getExpenses(month);
      setExpenses(data);
    } catch (err) {
      console.error('Error al cargar gastos:', err);
      setBackendError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadBcvRate(false);
    loadCategoriesAndSubs();
    loadAnalytics();
  }, [session?.user?.id, loadBcvRate, loadCategoriesAndSubs, loadAnalytics]);

  useEffect(() => {
    if (!session?.user?.id) return;
    loadExpenses(selectedMonth);
    setActiveCategoryFilter(null);
  }, [session?.user?.id, selectedMonth, loadExpenses]);

  const handleSaveManualRate = async () => {
    const parsedUsd = parseFloat(manualUsdInput);
    const parsedEur = parseFloat(manualEurInput);
    if (isNaN(parsedUsd) || parsedUsd <= 0 || isNaN(parsedEur) || parsedEur <= 0) return;
    try {
      const updated = await api.setManualBcvRate(parsedUsd, parsedEur);
      setBcvInfo(updated);
      setIsEditingRate(false);
    } catch (err) {
      console.error(err);
    }
  };

  // ---- Gestión de Categorías ----
  const handleCreateCategory = async (input: CreateCategoryInput) => {
    const created = await api.createCategory(input);
    setCategories((prev) => [...prev, created]);
  };

  const handleUpdateCategory = async (id: string, input: CreateCategoryInput) => {
    const updated = await api.updateCategory(id, input);
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
    );
    await Promise.all([
      loadExpenses(selectedMonth),
      loadAnalytics(),
      loadCategoriesAndSubs(),
    ]);
  };

  const handleDeleteCategory = async (id: string) => {
    await api.deleteCategory(id);
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setSubcategories((prev) => prev.filter((s) => s.category_id !== id));
    if (activeCategoryFilter === id) {
      setActiveCategoryFilter(null);
    }
  };

  // ---- Gestión de Subcategorías ----
  const handleCreateSubcategory = async (input: CreateSubcategoryInput) => {
    const created = await api.createSubcategory(input);
    setSubcategories((prev) => [...prev, created]);
  };

  const handleUpdateSubcategory = async (id: string, name: string) => {
    const updated = await api.updateSubcategory(id, name);
    setSubcategories((prev) => prev.map((s) => (s.id === id ? updated : s)));
    await Promise.all([
      loadExpenses(selectedMonth),
      loadAnalytics(),
      loadCategoriesAndSubs(),
    ]);
  };

  const handleDeleteSubcategory = async (id: string) => {
    await api.deleteSubcategory(id);
    setSubcategories((prev) => prev.filter((s) => s.id !== id));
    await Promise.all([
      loadExpenses(selectedMonth),
      loadAnalytics(),
      loadCategoriesAndSubs(),
    ]);
  };

  // ---- Gestión de Suscripciones ----
  const handleCreateSubscription = async (input: CreateSubscriptionInput) => {
    const created = await api.createSubscription(input);
    setSubscriptions((prev) => [created, ...prev]);
  };

  const handleToggleSubscriptionMonthly = async (
    id: string,
    includeInMonthly: boolean
  ) => {
    const updated = await api.toggleSubscriptionMonthly(id, includeInMonthly);
    setSubscriptions((prev) => prev.map((s) => (s.id === id ? updated : s)));
  };

  const handleDeleteSubscription = async (id: string) => {
    await api.deleteSubscription(id);
    setSubscriptions((prev) => prev.filter((s) => s.id !== id));
  };

  // Determinar si las suscripciones anuales están globalmente activadas en el gasto mensual
  const includeAnnualInMonthlyGlobal = useMemo(() => {
    const annuals = subscriptions.filter((s) => s.billing_cycle === 'annual');
    if (annuals.length === 0) return false;
    return annuals.every((s) => s.include_in_monthly === 1);
  }, [subscriptions]);

  const handleToggleGlobalAnnualInMonthly = async () => {
    const targetState = !includeAnnualInMonthlyGlobal;
    const annuals = subscriptions.filter((s) => s.billing_cycle === 'annual');
    const updatedList = await Promise.all(
      annuals.map((s) => api.toggleSubscriptionMonthly(s.id, targetState))
    );
    const updatedMap = new Map(updatedList.map((u) => [u.id, u]));
    setSubscriptions((prev) =>
      prev.map((s) => updatedMap.get(s.id) || s)
    );
  };

  // ---- Gestión de Gastos ----
  const handleAddExpense = async (input: CreateExpenseInput) => {
    const created = await api.createExpense(input);
    await loadAnalytics();
    if (created.expense_date.startsWith(selectedMonth)) {
      setExpenses((prev) =>
        [created, ...prev].sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      );
    } else {
      setSelectedMonth(created.expense_date.slice(0, 7));
    }
  };

  const handleUpdateExpense = async (id: string, input: CreateExpenseInput) => {
    const updated = await api.updateExpense(id, input);
    await loadAnalytics();
    if (updated.expense_date.startsWith(selectedMonth)) {
      setExpenses((prev) =>
        prev
          .map((e) => (e.id === id ? updated : e))
          .sort((a, b) => b.expense_date.localeCompare(a.expense_date))
      );
    } else {
      // Si la nueva fecha corresponde a otro mes, quitamos de este mes y vamos al nuevo
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      setSelectedMonth(updated.expense_date.slice(0, 7));
    }
  };

  const handleDeleteExpense = async (id: string) => {
    await api.deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    await loadAnalytics();
  };

  // Cálculos de Suscripciones incluidas vs separadas en gasto anual
  const subscriptionsMonthlyUsd = useMemo(() => {
    return subscriptions.reduce((sum, sub) => {
      if (sub.include_in_monthly !== 1) return sum;
      const monthlyShare =
        sub.billing_cycle === 'annual' ? sub.amount / 12 : sub.amount;
      return sum + monthlyShare;
    }, 0);
  }, [subscriptions]);

  const separatedAnnualUsd = useMemo(() => {
    return subscriptions.reduce((sum, sub) => {
      if (sub.include_in_monthly === 1) return sum;
      const annualShare =
        sub.billing_cycle === 'annual' ? sub.amount : sub.amount * 12;
      return sum + annualShare;
    }, 0);
  }, [subscriptions]);

  // Cálculos del mes actual (Gastos puntuales + Suscripciones marcadas para sumarse al mes)
  const baseExpensesUsd = useMemo(
    () => expenses.reduce((sum, item) => sum + item.amount, 0),
    [expenses]
  );

  const totalAmount = baseExpensesUsd + subscriptionsMonthlyUsd;

  const historicalPunctualVes = useMemo(() => {
    return expenses.reduce((sum, item) => {
      const ves =
        item.amount_ves > 0
          ? item.amount_ves
          : bcvInfo.rate > 0
            ? item.amount * bcvInfo.rate
            : 0;
      return sum + ves;
    }, 0);
  }, [expenses, bcvInfo.rate]);

  const totalAmountVes = useMemo(() => {
    const subsVes = bcvInfo.rate > 0 ? subscriptionsMonthlyUsd * bcvInfo.rate : 0;
    return historicalPunctualVes + subsVes;
  }, [historicalPunctualVes, bcvInfo.rate, subscriptionsMonthlyUsd]);

  const totalAmountEur = useMemo(() => {
    const punctualEur = expenses.reduce((sum, item) => {
      if (item.amount_eur > 0) return sum + item.amount_eur;
      const ves =
        item.amount_ves > 0
          ? item.amount_ves
          : bcvInfo.rate > 0
            ? item.amount * bcvInfo.rate
            : 0;
      const eur = bcvInfo.eurRate > 0 ? ves / bcvInfo.eurRate : 0;
      return sum + eur;
    }, 0);
    const subsVes = bcvInfo.rate > 0 ? subscriptionsMonthlyUsd * bcvInfo.rate : 0;
    const subsEur = bcvInfo.eurRate > 0 ? subsVes / bcvInfo.eurRate : 0;
    return punctualEur + subsEur;
  }, [expenses, bcvInfo.rate, bcvInfo.eurRate, subscriptionsMonthlyUsd]);

  // Desglose por Categoría y Subcategoría (incluyendo las suscripciones activas en el mes)
  const breakdown = useMemo<CategoryBreakdown[]>(() => {
    const map = new Map<
      string,
      CategoryBreakdown & { subMap: Map<string, SubcategoryBreakdownItem> }
    >();

    const addItemToBreakdown = (params: {
      category_id: string;
      category_name: string;
      category_color: string;
      subcategory_id: string | null;
      subcategory_name: string | null;
      usd: number;
      eur: number;
      ves: number;
    }) => {
      let catEntry = map.get(params.category_id);
      if (!catEntry) {
        catEntry = {
          category_id: params.category_id,
          name: params.category_name,
          color: params.category_color,
          total: 0,
          totalEur: 0,
          totalVes: 0,
          percentage: 0,
          count: 0,
          subcategories: [],
          subMap: new Map(),
        };
        map.set(params.category_id, catEntry);
      }

      catEntry.total += params.usd;
      catEntry.totalEur += params.eur;
      catEntry.totalVes += params.ves;
      catEntry.count += 1;

      const subKey = params.subcategory_id || '__general__';
      const subName = params.subcategory_name || 'General';
      const existingSub = catEntry.subMap.get(subKey);
      if (existingSub) {
        existingSub.total += params.usd;
        existingSub.totalEur += params.eur;
        existingSub.totalVes += params.ves;
        existingSub.count += 1;
      } else {
        catEntry.subMap.set(subKey, {
          subcategory_id: params.subcategory_id,
          name: subName,
          total: params.usd,
          totalEur: params.eur,
          totalVes: params.ves,
          percentageOfCategory: 0,
          count: 1,
        });
      }
    };

    // 1. Gastos puntuales del mes
    for (const exp of expenses) {
      const ves =
        exp.amount_ves > 0
          ? exp.amount_ves
          : bcvInfo.rate > 0
            ? exp.amount * bcvInfo.rate
            : 0;
      const eur =
        exp.amount_eur > 0
          ? exp.amount_eur
          : bcvInfo.eurRate > 0 && ves > 0
            ? ves / bcvInfo.eurRate
            : 0;

      addItemToBreakdown({
        category_id: exp.category_id,
        category_name: exp.category_name,
        category_color: exp.category_color,
        subcategory_id: exp.subcategory_id,
        subcategory_name: exp.subcategory_name,
        usd: exp.amount,
        eur,
        ves,
      });
    }

    // 2. Suscripciones que el usuario eligió incluir en el gasto mensual
    for (const sub of subscriptions) {
      if (sub.include_in_monthly !== 1) continue;
      const monthlyUsd =
        sub.billing_cycle === 'annual' ? sub.amount / 12 : sub.amount;
      const ves = bcvInfo.rate > 0 ? monthlyUsd * bcvInfo.rate : 0;
      const eur = bcvInfo.eurRate > 0 && ves > 0 ? ves / bcvInfo.eurRate : 0;

      addItemToBreakdown({
        category_id: sub.category_id,
        category_name: sub.category_name,
        category_color: sub.category_color,
        subcategory_id: sub.subcategory_id,
        subcategory_name: sub.subcategory_name || `Suscripción: ${sub.name}`,
        usd: monthlyUsd,
        eur,
        ves,
      });
    }

    const list: CategoryBreakdown[] = Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .map(({ subMap, ...cat }) => {
        const subs = Array.from(subMap.values())
          .sort((a, b) => b.total - a.total)
          .map((s) => ({
            ...s,
            percentageOfCategory: cat.total > 0 ? (s.total / cat.total) * 100 : 0,
          }));

        return {
          ...cat,
          percentage: totalAmount > 0 ? (cat.total / totalAmount) * 100 : 0,
          subcategories: subs,
        };
      });

    return list;
  }, [expenses, subscriptions, totalAmount, bcvInfo.rate, bcvInfo.eurRate]);

  const filteredExpenses = useMemo(() => {
    if (!activeCategoryFilter) return expenses;
    return expenses.filter((e) => e.category_id === activeCategoryFilter);
  }, [expenses, activeCategoryFilter]);

  // Detectar el último mes que sí tiene gastos registrados (por si hoy cambió el mes y está vacío)
  const latestMonthWithExpenses = useMemo(() => {
    if (analyticsHistory.length === 0) return null;
    let latestMonth = '';
    for (const row of analyticsHistory) {
      if (row.month > latestMonth) {
        latestMonth = row.month;
      }
    }
    if (!latestMonth || latestMonth === selectedMonth) return null;
    const totalCount = analyticsHistory
      .filter((r) => r.month === latestMonth)
      .reduce((acc, r) => acc + r.expense_count, 0);
    return { month: latestMonth, count: totalCount };
  }, [analyticsHistory, selectedMonth]);

  const isDemoUser = session?.user?.email === DEMO_CREDENTIALS.email;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setCategories([]);
    setSubcategories([]);
    setExpenses([]);
    setSubscriptions([]);
    setAnalyticsHistory([]);
  };

  if (authChecking) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center mx-auto animate-pulse">
            <WalletCards className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-500">
            Verificando sesión segura en Supabase...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Barra Superior */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Logo y Título */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-800 leading-tight">
                  Mis Gastos
                </h1>
                {isDemoUser && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                    <Sparkles className="w-3 h-3" />
                    Modo Demo
                  </span>
                )}
              </div>
              <span className="text-xs text-slate-400 hidden sm:inline">
                {session.user.email}
              </span>
            </div>
          </div>

          {/* Selector de Mes */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Mes anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-sm font-semibold text-slate-700 min-w-36 text-center">
              {formatMonthLabel(selectedMonth)}
            </span>
            <button
              onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Mes siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Indicador Tasas BCV ($ y €) + Botón Categorías + Cerrar Sesión */}
          <div className="flex items-center gap-2">
            {/* Widget de Tasas BCV */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-xs">
              <span className="font-semibold text-emerald-800">BCV:</span>
              {isEditingRate ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-emerald-700 font-medium">$:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={manualUsdInput}
                    onChange={(e) => setManualUsdInput(e.target.value)}
                    className="w-18 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-xs text-slate-800 focus:outline-none"
                    autoFocus
                  />
                  <span className="text-emerald-700 font-medium">€:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={manualEurInput}
                    onChange={(e) => setManualEurInput(e.target.value)}
                    className="w-18 px-1.5 py-0.5 bg-white border border-emerald-300 rounded text-xs text-slate-800 focus:outline-none"
                  />
                  <button
                    onClick={handleSaveManualRate}
                    className="p-0.5 text-emerald-700 hover:bg-emerald-100 rounded cursor-pointer"
                    title="Guardar tasas manuales"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditingRate(false)}
                    className="p-0.5 text-slate-500 hover:bg-slate-200 rounded cursor-pointer"
                    title="Cancelar"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <span className="font-bold text-emerald-900">
                    $: {bcvInfo.rate > 0 ? formatBolivares(bcvInfo.rate) : '...'}
                  </span>
                  <span className="text-emerald-300">|</span>
                  <span className="font-bold text-emerald-900">
                    €: {bcvInfo.eurRate > 0 ? formatBolivares(bcvInfo.eurRate) : '...'}
                  </span>
                  <button
                    onClick={() => loadBcvRate(true)}
                    disabled={refreshingBcv}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                    title="Sincronizar tasas oficiales ($ y €) del BCV"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${refreshingBcv ? 'animate-spin' : ''}`}
                    />
                  </button>
                  <button
                    onClick={() => {
                      setManualUsdInput(String(bcvInfo.rate || ''));
                      setManualEurInput(String(bcvInfo.eurRate || ''));
                      setIsEditingRate(true);
                    }}
                    className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                    title="Ajustar tasas manualmente"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Botón Categorías y Subcategorías */}
            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs sm:text-sm font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <Tags className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Categorías</span>
            </button>

            {/* Botón Cerrar Sesión */}
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-xs sm:text-sm font-medium text-slate-600 transition-colors cursor-pointer"
              title={`Cerrar sesión (${session.user.email})`}
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden md:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Pestañas de Navegación: Gastos del Mes | Suscripciones (Mensual/Anual) | Comparativa Mensual */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-200/70 p-1 rounded-2xl w-fit">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'monthly'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <ListPlus className="w-4 h-4" />
            Registro y Gastos del Mes
          </button>

          <button
            onClick={() => setActiveTab('subscriptions')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'subscriptions'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Repeat className="w-4 h-4" />
            Suscripciones anuales
            {subscriptions.length > 0 && (
              <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-xs">
                {subscriptions.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('comparison')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'comparison'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            Desglose y Comparativa Mensual
          </button>

          <button
            onClick={() => {
              setSelectedYear(Number(selectedMonth.slice(0, 4)));
              setActiveTab('annual');
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${activeTab === 'annual'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
              }`}
          >
            <Calendar className="w-4 h-4" />
            Resumen Anual y Cambiario
          </button>
        </div>

        {backendError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-2xl text-xs sm:text-sm flex items-center justify-between gap-4">
            <span>
              <strong>No se pudo conectar con Supabase.</strong> Verifica tu conexión a internet o las variables de entorno <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> y <code className="bg-red-100 px-1.5 py-0.5 rounded font-mono">VITE_SUPABASE_PUBLISHABLE_KEY</code>.
            </span>
          </div>
        )}

        {!backendError &&
          expenses.length === 0 &&
          latestMonthWithExpenses &&
          activeTab === 'monthly' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-2xl text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3">
              <span>
                Estás viendo <strong>{formatMonthLabel(selectedMonth)}</strong> (aún sin gastos puntuales este mes). Tienes{' '}
                <strong>{latestMonthWithExpenses.count} movimientos</strong> guardados en{' '}
                <strong>{formatMonthLabel(latestMonthWithExpenses.month)}</strong>.
              </span>
              <button
                type="button"
                onClick={() => setSelectedMonth(latestMonthWithExpenses.month)}
                className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                Ir a {formatMonthLabel(latestMonthWithExpenses.month)}
              </button>
            </div>
          )}

        {activeTab === 'monthly' ? (
          <>
            {/* Resumen del Mes y Barras por Categoría / Subcategoría */}
            <MonthlySummary
              totalAmount={totalAmount}
              punctualUsdAmount={baseExpensesUsd}
              totalAmountEur={totalAmountEur}
              totalAmountVes={totalAmountVes}
              historicalPunctualVes={historicalPunctualVes}
              subscriptionsMonthlyUsd={subscriptionsMonthlyUsd}
              separatedAnnualUsd={separatedAnnualUsd}
              currentBcvRate={bcvInfo.rate}
              currentBcvEurRate={bcvInfo.eurRate}
              expenseCount={expenses.length}
              breakdown={breakdown}
              activeCategoryFilter={activeCategoryFilter}
              onSelectCategoryFilter={setActiveCategoryFilter}
              onOpenSubscriptionsTab={() => setActiveTab('subscriptions')}
            />

            {/* Formulario Rápido para Nuevo Gasto */}
            <ExpenseForm
              categories={categories}
              subcategories={subcategories}
              selectedMonth={selectedMonth}
              currentBcvRate={bcvInfo.rate}
              currentBcvEurRate={bcvInfo.eurRate}
              onAddExpense={handleAddExpense}
              onOpenCategories={() => setIsCategoryModalOpen(true)}
            />

            {/* Listado de Gastos del Mes */}
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-sm text-slate-400">
                Cargando gastos...
              </div>
            ) : (
              <ExpenseList
                expenses={filteredExpenses}
                categories={categories}
                subcategories={subcategories}
                currentBcvRate={bcvInfo.rate}
                currentBcvEurRate={bcvInfo.eurRate}
                onUpdateExpense={handleUpdateExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}
          </>
        ) : activeTab === 'subscriptions' ? (
          <SubscriptionsView
            categories={categories}
            subcategories={subcategories}
            subscriptions={subscriptions}
            currentBcvRate={bcvInfo.rate}
            currentBcvEurRate={bcvInfo.eurRate}
            includeAnnualInMonthlyGlobal={includeAnnualInMonthlyGlobal}
            onToggleGlobalAnnualInMonthly={handleToggleGlobalAnnualInMonthly}
            onCreateSubscription={handleCreateSubscription}
            onToggleSubscriptionMonthly={handleToggleSubscriptionMonthly}
            onDeleteSubscription={handleDeleteSubscription}
            onOpenCategories={() => setIsCategoryModalOpen(true)}
          />
        ) : activeTab === 'comparison' ? (
          <MonthlyComparisonView
            selectedMonth={selectedMonth}
            onSelectMonth={setSelectedMonth}
            categories={categories}
            subcategories={subcategories}
            history={analyticsHistory}
            currentBcvRate={bcvInfo.rate}
            currentBcvEurRate={bcvInfo.eurRate}
          />
        ) : (
          <AnnualSummaryView
            selectedYear={selectedYear}
            onSelectYear={setSelectedYear}
            onSelectMonthAndGoToMonthly={(ym) => {
              setSelectedMonth(ym);
              setActiveTab('monthly');
            }}
            categories={categories}
            subcategories={subcategories}
            history={analyticsHistory}
            subscriptions={subscriptions}
            currentBcvRate={bcvInfo.rate}
            currentBcvEurRate={bcvInfo.eurRate}
          />
        )}
      </main>

      {/* Modal de Gestión de Categorías y Subcategorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        categories={categories}
        subcategories={subcategories}
        onCreateCategory={handleCreateCategory}
        onUpdateCategory={handleUpdateCategory}
        onDeleteCategory={handleDeleteCategory}
        onCreateSubcategory={handleCreateSubcategory}
        onUpdateSubcategory={handleUpdateSubcategory}
        onDeleteSubcategory={handleDeleteSubcategory}
      />
    </div>
  );
};

export default App;
