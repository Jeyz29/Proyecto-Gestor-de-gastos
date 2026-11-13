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
  Download,
  ShieldCheck,
  Plus,
  ArrowUpRight,
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
  formatCurrency,
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
  const [selectedDateFilter, setSelectedDateFilter] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('g_budget_sidebar_collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('g_budget_sidebar_collapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

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
    setSelectedDateFilter(null);
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

  // Desglose por Categoría y Subcategoría
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

  const activeDaysCount = useMemo(() => {
    return new Set(expenses.map((e) => e.expense_date)).size;
  }, [expenses]);

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

  const handleExportCsv = () => {
    if (expenses.length === 0) return;
    const headers = [
      'Fecha',
      'Concepto',
      'Categoria',
      'Subcategoria',
      'Monto_USD',
      'Monto_EUR',
      'Monto_VES',
      'Tasa_BCV_USD',
      'Tasa_BCV_EUR',
    ];
    const rows = expenses.map((e) => [
      e.expense_date,
      `"${(e.description || '').replace(/"/g, '""')}"`,
      `"${(e.category_name || '').replace(/"/g, '""')}"`,
      `"${(e.subcategory_name || 'General').replace(/"/g, '""')}"`,
      e.amount.toFixed(2),
      (e.amount_eur || 0).toFixed(2),
      (e.amount_ves || 0).toFixed(2),
      (e.exchange_rate || 0).toFixed(4),
      (e.exchange_rate_eur || 0).toFixed(4),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `g-budget-${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFocusNewExpense = () => {
    const input = document.getElementById('expense-description-input');
    if (input) {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => input.focus(), 250);
    }
  };

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
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center mx-auto animate-pulse">
            <WalletCards className="w-5 h-5" />
          </div>
          <p className="text-xs font-mono text-on-surface-variant">
            Verificando sesión segura en G-Budget...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex">
      {/* Barra Lateral Izquierda Fija (Desktop) */}
      <aside
        className={`hidden lg:flex ${isSidebarCollapsed ? 'w-28' : 'w-64'
          } shrink-0 border-r border-slate-200/60 bg-surface flex-col fixed inset-y-0 left-0 z-40 transition-all duration-200 ease-in-out`}
      >
        <div className={`${isSidebarCollapsed ? 'px-2.5 py-6' : 'p-6'} flex flex-col h-full transition-all duration-200`}>
          {/* Brand Header: G-Budget / G-B con botón para desplegar/minimizar al mismo nivel */}
          <div className="flex items-center justify-between gap-1 mb-8 px-0.5">
            <div className={`flex items-center ${isSidebarCollapsed ? 'gap-1.5' : 'gap-3'} min-w-0 shrink-0`}>
              <div
                className={`${isSidebarCollapsed ? 'w-8 h-8 rounded-lg' : 'w-9 h-9 rounded-lg'
                  } overflow-hidden shadow-xs shrink-0 ${isSidebarCollapsed ? 'cursor-pointer hover:opacity-90' : ''
                  }`}
                onClick={() => isSidebarCollapsed && setIsSidebarCollapsed(false)}
                title={isSidebarCollapsed ? 'G-B - Clic para desplegar' : undefined}
              >
                <img
                  src="/icon.jpg"
                  alt="G-Budget"
                  className="w-full h-full object-cover"
                />
              </div>
              <h1
                className={`font-extrabold tracking-tight text-on-surface leading-none ${isSidebarCollapsed ? 'text-xs font-black shrink-0 whitespace-nowrap' : 'text-lg truncate'
                  }`}
              >
                {isSidebarCollapsed ? 'G-B' : 'G-Budget'}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1 rounded-lg text-slate-400 hover:text-on-surface hover:bg-slate-200/60 transition-colors cursor-pointer shrink-0"
              title={isSidebarCollapsed ? 'Desplegar barra lateral' : 'Minimizar barra lateral'}
              aria-label={isSidebarCollapsed ? 'Desplegar barra lateral' : 'Minimizar barra lateral'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navegación Principal */}
          <nav className="space-y-1 flex-1">
            {!isSidebarCollapsed ? (
              <p className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
                Módulos Contables
              </p>
            ) : (
              <div className="my-1 border-t border-slate-200/40" />
            )}

            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } rounded-lg text-sm transition-all cursor-pointer ${activeTab === 'monthly'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/50 font-medium'
                }`}
              title={isSidebarCollapsed ? 'Gastos del Mes' : undefined}
            >
              <ListPlus
                className={`w-4 h-4 shrink-0 ${activeTab === 'monthly' ? 'text-secondary' : 'text-slate-500'
                  }`}
              />
              {!isSidebarCollapsed && <span>Gastos del Mes</span>}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('subscriptions')}
              className={`w-full flex items-center ${isSidebarCollapsed
                  ? 'justify-center px-2 py-2.5 relative'
                  : 'justify-between px-3 py-2.5'
                } rounded-lg text-sm transition-all cursor-pointer ${activeTab === 'subscriptions'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/50 font-medium'
                }`}
              title={isSidebarCollapsed ? `Suscripciones (${subscriptions.length})` : undefined}
            >
              <span className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
                <Repeat
                  className={`w-4 h-4 shrink-0 ${activeTab === 'subscriptions' ? 'text-secondary' : 'text-slate-500'
                    }`}
                />
                {!isSidebarCollapsed && <span>Suscripciones</span>}
              </span>
              {subscriptions.length > 0 &&
                (isSidebarCollapsed ? (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary" />
                ) : (
                  <span className="px-1.5 py-0.2 bg-secondary-container/60 text-on-secondary-container rounded-full text-[11px] font-mono font-bold">
                    {subscriptions.length}
                  </span>
                ))}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('comparison')}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } rounded-lg text-sm transition-all cursor-pointer ${activeTab === 'comparison'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/50 font-medium'
                }`}
              title={isSidebarCollapsed ? 'Comparativa Mensual' : undefined}
            >
              <BarChart3
                className={`w-4 h-4 shrink-0 ${activeTab === 'comparison' ? 'text-secondary' : 'text-slate-500'
                  }`}
              />
              {!isSidebarCollapsed && <span>Comparativa Mensual</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedYear(Number(selectedMonth.slice(0, 4)));
                setActiveTab('annual');
              }}
              className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                } rounded-lg text-sm transition-all cursor-pointer ${activeTab === 'annual'
                  ? 'bg-surface-container-high text-on-surface font-semibold'
                  : 'text-slate-600 hover:bg-slate-200/50 font-medium'
                }`}
              title={isSidebarCollapsed ? 'Resumen Anual' : undefined}
            >
              <Calendar
                className={`w-4 h-4 shrink-0 ${activeTab === 'annual' ? 'text-secondary' : 'text-slate-500'
                  }`}
              />
              {!isSidebarCollapsed && <span>Resumen Anual</span>}
            </button>

            <div className="pt-4">
              {!isSidebarCollapsed ? (
                <p className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
                  Configuración
                </p>
              ) : (
                <div className="my-2 border-t border-slate-200/40" />
              )}
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                  } rounded-lg text-sm text-slate-600 hover:bg-slate-200/50 font-medium transition-all cursor-pointer`}
                title={isSidebarCollapsed ? 'Categorías y Subcategorías' : undefined}
              >
                <Tags className="w-4 h-4 shrink-0 text-secondary" />
                {!isSidebarCollapsed && <span>Categorías y Subcategorías</span>}
              </button>
            </div>
          </nav>

          {/* Tarjeta inferior de seguridad y estado */}
          <div className="mt-auto pt-4 border-t border-slate-200/60 space-y-3">
            {!isSidebarCollapsed ? (
              <div className="p-3.5 rounded-xl bg-surface-container-low">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-secondary" />
                  <span className="text-xs font-bold text-on-surface">
                    RLS Activo
                  </span>
                </div>
                <p className="text-[11px] text-on-surface-variant leading-relaxed">
                  Libro contable protegido en Supabase con tasas históricas BCV.
                </p>
              </div>
            ) : (
              <div
                className="flex justify-center"
                title="Fiscal Safe · RLS Activo (Protegido en Supabase con tasas BCV)"
              >
                <div className="p-2 rounded-lg bg-surface-container-low text-secondary">
                  <ShieldCheck className="w-4 h-4" />
                </div>
              </div>
            )}

            <div
              className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-2'
                } text-xs text-on-surface-variant`}
            >
              {!isSidebarCollapsed && (
                <span className="truncate max-w-40" title={session.user.email}>
                  {session.user.email}
                </span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="p-1.5 text-slate-500 hover:text-error hover:bg-error-container/40 rounded-lg transition-colors cursor-pointer"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Contenedor Derecho Principal */}
      <div
        className={`flex-1 ${isSidebarCollapsed ? 'lg:pl-28' : 'lg:pl-64'
          } min-w-0 flex flex-col transition-all duration-200 ease-in-out`}
      >
        {/* Top Header Fijo */}
        <header className="sticky top-0 z-30 h-16 bg-surface/85 backdrop-blur-md border-b border-slate-200/60 px-4 sm:px-8 flex items-center justify-between gap-3">
          {/* Izquierda: Logo móvil + Selector de Período Mensual */}
          <div className="flex items-center gap-3">
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 shadow-xs">
                <img src="/icon.jpg" alt="G-Budget" className="w-full h-full object-cover" />
              </div>
              <span className="font-extrabold text-sm text-on-surface">G-Budget</span>
            </div>

            {/* Selector de Mes estilo Stitch */}
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-slate-200/50">
              <button
                onClick={() => setSelectedMonth((m) => shiftMonth(m, -1))}
                className="p-1.5 hover:bg-surface-container-lowest rounded-lg transition-all text-slate-600 cursor-pointer"
                title="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 text-xs sm:text-sm font-bold text-on-surface min-w-34 text-center">
                {formatMonthLabel(selectedMonth)}
              </span>
              <button
                onClick={() => setSelectedMonth((m) => shiftMonth(m, 1))}
                className="p-1.5 hover:bg-surface-container-lowest rounded-lg transition-all text-slate-600 cursor-pointer"
                title="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {isDemoUser && (
              <span className="hidden md:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                <Sparkles className="w-3 h-3" />
                DEMO
              </span>
            )}
          </div>

          {/* Derecha: Widget de Tasas BCV + Acciones Móviles */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-secondary-container/35 border border-secondary/20 text-xs">
              <span className="font-mono font-bold text-secondary hidden sm:inline">
                BCV:
              </span>
              {isEditingRate ? (
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-secondary font-bold">$:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={manualUsdInput}
                    onChange={(e) => setManualUsdInput(e.target.value)}
                    className="w-18 px-1.5 py-0.5 bg-white border border-secondary/40 rounded text-xs text-on-surface focus:outline-none"
                    autoFocus
                  />
                  <span className="text-secondary font-bold">€:</span>
                  <input
                    type="number"
                    step="0.01"
                    value={manualEurInput}
                    onChange={(e) => setManualEurInput(e.target.value)}
                    className="w-18 px-1.5 py-0.5 bg-white border border-secondary/40 rounded text-xs text-on-surface focus:outline-none"
                  />
                  <button
                    onClick={handleSaveManualRate}
                    className="p-0.5 text-secondary hover:bg-secondary/10 rounded cursor-pointer"
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
                  <span className="font-mono font-bold text-on-surface font-tabular">
                    $: {bcvInfo.rate > 0 ? formatBolivares(bcvInfo.rate) : '...'}
                  </span>
                  <span className="text-secondary/30 hidden sm:inline">|</span>
                  <span className="font-mono font-bold text-on-surface font-tabular hidden sm:inline">
                    €: {bcvInfo.eurRate > 0 ? formatBolivares(bcvInfo.eurRate) : '...'}
                  </span>
                  <button
                    onClick={() => loadBcvRate(true)}
                    disabled={refreshingBcv}
                    className="p-1 text-secondary hover:bg-secondary/15 rounded-md transition-colors cursor-pointer"
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
                    className="p-1 text-secondary hover:bg-secondary/15 rounded-md transition-colors cursor-pointer"
                    title="Ajustar tasas manualmente"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <button
              onClick={() => setIsCategoryModalOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-xs font-semibold text-on-surface cursor-pointer"
              title="Categorías"
            >
              <Tags className="w-3.5 h-3.5 text-secondary" />
            </button>

            <button
              onClick={handleSignOut}
              className="lg:hidden inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low text-xs font-semibold text-slate-600 hover:text-error cursor-pointer"
              title="Cerrar sesión"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Barra de Navegación Móvil (< lg) */}
        <div className="lg:hidden px-4 pt-3 flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('monthly')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${activeTab === 'monthly'
              ? 'bg-primary text-white'
              : 'bg-surface-container-low text-on-surface-variant'
              }`}
          >
            Gastos del Mes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('subscriptions')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${activeTab === 'subscriptions'
              ? 'bg-primary text-white'
              : 'bg-surface-container-low text-on-surface-variant'
              }`}
          >
            Suscripciones ({subscriptions.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('comparison')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${activeTab === 'comparison'
              ? 'bg-primary text-white'
              : 'bg-surface-container-low text-on-surface-variant'
              }`}
          >
            Comparativa
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedYear(Number(selectedMonth.slice(0, 4)));
              setActiveTab('annual');
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 cursor-pointer ${activeTab === 'annual'
              ? 'bg-primary text-white'
              : 'bg-surface-container-low text-on-surface-variant'
              }`}
          >
            Resumen Anual
          </button>
        </div>

        {/* Contenido Principal */}
        <main className="p-4 sm:p-8 max-w-7xl w-full mx-auto space-y-6 pb-16">
          {backendError && (
            <div className="bg-error-container/50 border border-error/20 text-on-error-container px-4 py-3 rounded-xl text-xs sm:text-sm flex items-center justify-between gap-4">
              <span>
                <strong>No se pudo conectar con Supabase.</strong> Verifica tu conexión a internet o las credenciales del proyecto.
              </span>
            </div>
          )}

          {!backendError &&
            expenses.length === 0 &&
            latestMonthWithExpenses &&
            activeTab === 'monthly' && (
              <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl text-xs sm:text-sm flex flex-wrap items-center justify-between gap-3">
                <span>
                  Estás viendo <strong>{formatMonthLabel(selectedMonth)}</strong> (aún sin gastos puntuales este mes). Tienes{' '}
                  <strong>{latestMonthWithExpenses.count} movimientos</strong> guardados en{' '}
                  <strong>{formatMonthLabel(latestMonthWithExpenses.month)}</strong>.
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMonth(latestMonthWithExpenses.month)}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Ir a {formatMonthLabel(latestMonthWithExpenses.month)}
                </button>
              </div>
            )}

          {activeTab === 'monthly' ? (
            <>
              {/* Sub-header Controller Bar (Adaptado de Stitch Monthly Expense Manager) */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-xl shadow-[0_8px_24px_rgba(11,28,48,0.03)] border border-slate-100">
                <div className="flex flex-wrap items-center gap-4">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-secondary font-bold block">
                      Período Contable Activo
                    </span>
                    <h2 className="text-xl font-extrabold text-on-surface tracking-tight capitalize">
                      {formatMonthLabel(selectedMonth)}
                    </h2>
                  </div>
                  <div className="hidden sm:block h-8 w-[1px] bg-slate-200 mx-1" />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container/40 text-on-secondary-container text-xs font-mono font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                    {activeDaysCount} {activeDaysCount === 1 ? 'Día' : 'Días'} con Actividad
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    disabled={expenses.length === 0}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-on-surface hover:bg-surface-container-low disabled:opacity-40 transition-all cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-secondary" />
                    Exportar CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleFocusNewExpense}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary hover:bg-on-secondary-container text-white text-xs font-semibold shadow-xs transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    Registrar Gasto
                  </button>
                </div>
              </div>

              {/* Resumen del Mes: 4 KPI Cards + 60/40 Cadencia Diaria & Categorías */}
              <MonthlySummary
                selectedMonth={selectedMonth}
                expenses={expenses}
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
                selectedDateFilter={selectedDateFilter}
                onSelectDateFilter={setSelectedDateFilter}
                onOpenSubscriptionsTab={() => setActiveTab('subscriptions')}
                onOpenCategories={() => setIsCategoryModalOpen(true)}
              />

              {/* Formulario de Registro con Autocompletado y Tasas Históricas */}
              <ExpenseForm
                categories={categories}
                subcategories={subcategories}
                selectedMonth={selectedMonth}
                currentBcvRate={bcvInfo.rate}
                currentBcvEurRate={bcvInfo.eurRate}
                onAddExpense={handleAddExpense}
                onOpenCategories={() => setIsCategoryModalOpen(true)}
              />

              {/* Sección Inferior 12 Columnas: Libro Mayor (8 cols) + Suscripciones Activas (4 cols) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8">
                  {loading ? (
                    <div className="bg-surface-container-lowest rounded-xl border border-slate-100 p-12 text-center text-sm font-mono text-on-surface-variant">
                      Sincronizando libro mayor con Supabase...
                    </div>
                  ) : (
                    <ExpenseList
                      expenses={filteredExpenses}
                      categories={categories}
                      subcategories={subcategories}
                      currentBcvRate={bcvInfo.rate}
                      currentBcvEurRate={bcvInfo.eurRate}
                      selectedDateFilter={selectedDateFilter}
                      onClearDateFilter={() => setSelectedDateFilter(null)}
                      activeCategoryFilter={activeCategoryFilter}
                      onClearCategoryFilter={() => setActiveCategoryFilter(null)}
                      onUpdateExpense={handleUpdateExpense}
                      onDeleteExpense={handleDeleteExpense}
                    />
                  )}
                </div>

                {/* Columna Derecha (4 cols): Tarjeta de Suscripciones Recurrentes (Estilo Stitch) */}
                <div className="xl:col-span-4 bg-surface-container-lowest p-6 rounded-xl shadow-[0_8px_24px_rgba(11,28,48,0.03)] border border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-on-surface">
                        Cargos Recurrentes
                      </h3>
                      <p className="text-xs text-on-surface-variant">
                        Suscripciones mensuales y anuales
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('subscriptions')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-secondary hover:underline cursor-pointer"
                    >
                      Gestionar
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {subscriptions.length === 0 ? (
                    <div className="p-6 rounded-xl bg-surface-container-low/60 text-center space-y-2">
                      <Repeat className="w-6 h-6 text-secondary mx-auto opacity-75" />
                      <p className="text-xs font-semibold text-on-surface">
                        Sin suscripciones registradas
                      </p>
                      <p className="text-[11px] text-on-surface-variant">
                        Agrega pagos fijos (Internet, Streaming, Gimnasio) para proyectar tu obligación mensual.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab('subscriptions')}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-white text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Configurar Suscripciones
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2.5 max-h-88 overflow-y-auto pr-1">
                        {subscriptions.map((sub) => {
                          const monthlyEq =
                            sub.billing_cycle === 'annual'
                              ? sub.amount / 12
                              : sub.amount;
                          const isIncluded = sub.include_in_monthly === 1;
                          return (
                            <div
                              key={sub.id}
                              className="p-3 rounded-lg bg-surface-container-low/60 hover:bg-surface-container-low transition-all flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 font-mono text-xs font-bold"
                                  style={{
                                    backgroundColor: `${sub.category_color}20`,
                                    color: sub.category_color,
                                  }}
                                >
                                  D{sub.billing_day}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-on-surface truncate">
                                    {sub.name}
                                  </p>
                                  <p className="text-[10px] font-mono text-on-surface-variant">
                                    {sub.billing_cycle === 'annual'
                                      ? `Anual (${formatCurrency(sub.amount)}/año)`
                                      : 'Ciclo Mensual'}{' '}
                                    · {isIncluded ? 'En mes' : 'En anual'}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right font-tabular shrink-0">
                                <p className="text-xs font-mono font-bold text-on-surface">
                                  {formatCurrency(monthlyEq)}/m
                                </p>
                                {bcvInfo.rate > 0 && (
                                  <p className="text-[10px] font-mono text-on-surface-variant">
                                    {formatBolivares(monthlyEq * bcvInfo.rate)}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-on-surface-variant font-medium">
                            Obligación Mensual Incluida
                          </span>
                          <span className="text-sm font-mono font-bold text-on-surface font-tabular">
                            {formatCurrency(subscriptionsMonthlyUsd)}
                          </span>
                        </div>
                        {separatedAnnualUsd > 0 && (
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-on-surface-variant">
                              Reserva Anual Separada
                            </span>
                            <span className="font-mono font-semibold text-secondary font-tabular">
                              {formatCurrency(separatedAnnualUsd)}/año
                            </span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
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
      </div>

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
