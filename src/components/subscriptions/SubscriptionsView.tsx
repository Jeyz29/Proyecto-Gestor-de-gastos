import React, { useState, useEffect, useMemo } from 'react';
import {
  Repeat,
  CalendarCheck,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Layers,
  ArrowUpDown,
  Info,
} from 'lucide-react';
import type {
  Category,
  Subcategory,
  Subscription,
  CreateSubscriptionInput,
} from '../../types/index.ts';
import {
  formatCurrency,
  formatEuros,
  formatBolivares,
} from '../../utils/formatters.ts';

interface SubscriptionsViewProps {
  categories: Category[];
  subcategories: Subcategory[];
  subscriptions: Subscription[];
  currentBcvRate: number;
  currentBcvEurRate: number;
  includeAnnualInMonthlyGlobal: boolean;
  onToggleGlobalAnnualInMonthly: () => void;
  onCreateSubscription: (data: CreateSubscriptionInput) => Promise<void>;
  onToggleSubscriptionMonthly: (id: string, includeInMonthly: boolean) => Promise<void>;
  onDeleteSubscription: (id: string) => Promise<void>;
  onOpenCategories: () => void;
}

export const SubscriptionsView: React.FC<SubscriptionsViewProps> = ({
  categories,
  subcategories,
  subscriptions,
  currentBcvRate,
  currentBcvEurRate,
  includeAnnualInMonthlyGlobal,
  onToggleGlobalAnnualInMonthly,
  onCreateSubscription,
  onToggleSubscriptionMonthly,
  onDeleteSubscription,
  onOpenCategories,
}) => {
  const [name, setName] = useState('');
  const [rawAmount, setRawAmount] = useState('');
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'EUR' | 'VES'>('USD');
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'annual'>('monthly');
  const [includeInMonthly, setIncludeInMonthly] = useState<boolean>(true);
  const [billingDay, setBillingDay] = useState<string>('1');
  const [categoryId, setCategoryId] = useState<string>('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const availableSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId]
  );

  useEffect(() => {
    setSubcategoryId('');
  }, [categoryId]);

  useEffect(() => {
    if (billingCycle === 'monthly') {
      setIncludeInMonthly(true);
    } else {
      setIncludeInMonthly(includeAnnualInMonthlyGlobal);
    }
  }, [billingCycle, includeAnnualInMonthlyGlobal]);

  const parsedValue = parseFloat(rawAmount);
  const hasValidAmount = !isNaN(parsedValue) && parsedValue > 0;

  let calculatedUsd = 0;
  if (hasValidAmount) {
    if (inputCurrency === 'USD') {
      calculatedUsd = parsedValue;
    } else if (inputCurrency === 'EUR') {
      const ves = currentBcvEurRate > 0 ? parsedValue * currentBcvEurRate : 0;
      calculatedUsd = currentBcvRate > 0 ? ves / currentBcvRate : parsedValue;
    } else {
      calculatedUsd = currentBcvRate > 0 ? parsedValue / currentBcvRate : 0;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !hasValidAmount || !categoryId) {
      setError('Completa el nombre, monto y categoría');
      return;
    }
    if (inputCurrency !== 'USD' && currentBcvRate <= 0) {
      setError('No hay tasa BCV disponible para convertir a USD');
      return;
    }

    setSubmitting(true);
    try {
      await onCreateSubscription({
        name: name.trim(),
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        amount: Number(calculatedUsd.toFixed(2)),
        currency: 'USD',
        billing_cycle: billingCycle,
        include_in_monthly: includeInMonthly,
        billing_day: Math.min(31, Math.max(1, parseInt(billingDay, 10) || 1)),
      });
      setName('');
      setRawAmount('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear suscripción');
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    let monthlyImpactUsd = 0;
    let separatedAnnualUsd = 0;
    let totalAnnualizedUsd = 0;
    let monthlyCount = 0;
    let annualCount = 0;

    for (const sub of subscriptions) {
      const isIncluded = sub.include_in_monthly === 1;
      if (sub.billing_cycle === 'monthly') {
        monthlyCount += 1;
        totalAnnualizedUsd += sub.amount * 12;
        if (isIncluded) {
          monthlyImpactUsd += sub.amount;
        } else {
          separatedAnnualUsd += sub.amount * 12;
        }
      } else {
        annualCount += 1;
        totalAnnualizedUsd += sub.amount;
        if (isIncluded) {
          monthlyImpactUsd += sub.amount / 12;
        } else {
          separatedAnnualUsd += sub.amount;
        }
      }
    }

    return {
      monthlyImpactUsd,
      separatedAnnualUsd,
      totalAnnualizedUsd,
      monthlyCount,
      annualCount,
    };
  }, [subscriptions]);

  const toVes = (usd: number) => (currentBcvRate > 0 ? usd * currentBcvRate : 0);
  const toEur = (usd: number) => {
    const ves = toVes(usd);
    return currentBcvEurRate > 0 && ves > 0 ? ves / currentBcvEurRate : 0;
  };

  return (
    <div className="space-y-6 pb-8">
      {/* 1. Cabecera de Página (Estilo Stitch Gestión de Suscripciones) */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-primary-container border border-slate-800 flex items-center justify-center text-secondary-fixed shrink-0 shadow-xs">
            <Repeat className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-on-surface tracking-tight">
              Gestión de Suscripciones y Pagos Recurrentes
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Control de compromisos periódicos, periodicidad de facturación e impacto en el gasto mensual vs. anual.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-mono text-xs font-semibold bg-secondary-container/40 text-on-secondary-container border border-secondary/20">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
            Moneda Base: USD ($) | Tasa BCV Activa
          </span>
        </div>
      </section>

      {/* 2. Tarjetas KPI de Resumen (3 Columnas) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* KPI Card 1: Sumado al Gasto Mensual (Hero Oscuro) */}
        <div className="bg-primary-container text-on-primary rounded-2xl p-6 shadow-md flex flex-col justify-between relative overflow-hidden transition-transform hover:-translate-y-0.5 duration-200 border border-slate-800">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-secondary-fixed" />
                <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-on-primary-container">
                  Sumado al Gasto Mensual
                </span>
              </div>
              <div className="p-1 text-on-primary-container">
                <ArrowUpDown className="w-4 h-4" />
              </div>
            </div>

            <div className="font-mono text-3xl font-extrabold tracking-tight mb-1 text-white font-tabular">
              {formatCurrency(stats.monthlyImpactUsd)}{' '}
              <span className="text-base font-medium text-on-primary-container">/ mes</span>
            </div>
            <p className="font-mono text-xs font-semibold text-on-primary-container tracking-wide font-tabular">
              {toEur(stats.monthlyImpactUsd) > 0
                ? `${formatEuros(toEur(stats.monthlyImpactUsd))} • `
                : ''}
              {formatBolivares(toVes(stats.monthlyImpactUsd))}
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
            <p className="text-[11px] text-on-primary-container leading-relaxed">
              Se agrega automáticamente al resumen mensual.
            </p>
            <span className="font-mono text-[10px] font-bold text-secondary-fixed bg-secondary/25 px-2.5 py-0.5 rounded-full border border-secondary-fixed/25 shrink-0">
              Activo
            </span>
          </div>
        </div>

        {/* KPI Card 2: Separado en Gasto Anual */}
        <div className="bg-surface-container-lowest border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                Separado en Gasto Anual
              </span>
              <div className="p-1 text-amber-500">
                <CalendarCheck className="w-4 h-4" />
              </div>
            </div>

            <div className="font-mono text-3xl font-extrabold tracking-tight mb-1 text-on-surface font-tabular">
              {formatCurrency(stats.separatedAnnualUsd)}{' '}
              <span className="text-base font-medium text-outline">/ año</span>
            </div>
            <p className="font-mono text-xs font-medium text-on-surface-variant tracking-wide font-tabular">
              {toEur(stats.separatedAnnualUsd) > 0
                ? `${formatEuros(toEur(stats.separatedAnnualUsd))} • `
                : ''}
              {formatBolivares(toVes(stats.separatedAnnualUsd))}
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100">
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Pagos anuales o recurrentes que elegiste mantener fuera del mes a mes.
            </p>
          </div>
        </div>

        {/* KPI Card 3: Costo Total Anualizado + Toggle Global */}
        <div className="bg-surface-container-lowest border border-slate-200/80 rounded-2xl p-6 shadow-xs flex flex-col justify-between transition-transform hover:-translate-y-0.5 duration-200">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-on-surface-variant">
                Costo Total Anualizado
              </span>
              <div className="p-1 text-secondary">
                <Layers className="w-4 h-4" />
              </div>
            </div>

            <div className="font-mono text-3xl font-extrabold tracking-tight mb-1 text-on-surface font-tabular">
              {formatCurrency(stats.totalAnnualizedUsd)}{' '}
              <span className="text-base font-medium text-outline">/ año</span>
            </div>
            <p className="font-mono text-xs font-medium text-on-surface-variant tracking-wide font-tabular">
              {formatBolivares(toVes(stats.totalAnnualizedUsd))}
            </p>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onToggleGlobalAnnualInMonthly}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                includeAnnualInMonthlyGlobal
                  ? 'bg-secondary-container/40 text-on-secondary-container border-secondary/25 hover:bg-secondary-container/60'
                  : 'bg-surface-container-low text-on-surface border-slate-200/80 hover:bg-surface-container'
              }`}
            >
              <span className="truncate">
                {includeAnnualInMonthlyGlobal
                  ? 'Pagos anuales: Sumados al mes (÷12)'
                  : 'Pagos anuales: Separados del mes'}
              </span>
              {includeAnnualInMonthlyGlobal ? (
                <ToggleRight className="w-5 h-5 text-secondary shrink-0 ml-2" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-outline shrink-0 ml-2" />
              )}
            </button>
          </div>
        </div>
      </section>

      {/* 3. Tarjeta de Formulario: Nueva Suscripción o Pago Recurrente */}
      <section className="bg-surface-container-lowest border border-slate-200/80 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-primary-container flex items-center justify-center text-white shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-base font-bold text-on-surface tracking-tight">
              Nueva Suscripción o Pago Recurrente
            </h2>
          </div>

          {/* Selector de Moneda */}
          <div className="w-full sm:w-auto inline-flex p-1 bg-surface-container-low rounded-xl gap-1 font-mono text-xs font-semibold">
            {([
              { id: 'USD', label: 'USD ($)' },
              { id: 'EUR', label: 'EUR (€ BCV)' },
              { id: 'VES', label: 'Bs. (BCV)' },
            ] as const).map((curr) => {
              const active = inputCurrency === curr.id;
              return (
                <button
                  key={curr.id}
                  type="button"
                  onClick={() => setInputCurrency(curr.id)}
                  className={`flex-1 sm:flex-none px-3 py-1 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-surface-container-lowest text-on-surface font-bold shadow-2xs border border-slate-200/80'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {curr.label}
                </button>
              );
            })}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-6 xl:grid-cols-12 gap-4">
            {/* Servicio / Suscripción */}
            <div className="sm:col-span-6 xl:col-span-4">
              <label
                htmlFor="subscription-name"
                className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5"
              >
                Servicio / Suscripción
              </label>
              <input
                id="subscription-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Netflix, Spotify, Dominio Web..."
                required
                className="w-full text-sm font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-3.5 text-on-surface placeholder:text-outline transition-all"
              />
            </div>

            {/* Monto */}
            <div className="sm:col-span-3 xl:col-span-2">
              <label
                htmlFor="subscription-amount"
                className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5"
              >
                Monto ({inputCurrency === 'USD' ? '$' : inputCurrency === 'EUR' ? '€' : 'Bs.'})
              </label>
              <input
                id="subscription-amount"
                type="number"
                step="0.01"
                min="0.01"
                value={rawAmount}
                onChange={(e) => setRawAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full text-sm font-mono font-semibold font-tabular rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-3.5 text-on-surface placeholder:text-outline transition-all"
              />
            </div>

            {/* Ciclo de Cobro */}
            <div className="sm:col-span-3 xl:col-span-2">
              <label
                htmlFor="subscription-cycle"
                className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5"
              >
                Ciclo de Cobro
              </label>
              <select
                id="subscription-cycle"
                value={billingCycle}
                onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
                className="w-full text-sm font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-3 text-on-surface transition-all"
              >
                <option value="monthly">Mensual</option>
                <option value="annual">Anual</option>
              </select>
            </div>

            {/* Categoría */}
            <div className="sm:col-span-2 xl:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="subscription-category"
                  className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant"
                >
                  Categoría
                </label>
                <button
                  type="button"
                  onClick={onOpenCategories}
                  className="text-[11px] font-semibold text-secondary hover:underline cursor-pointer"
                >
                  + Editar
                </button>
              </div>
              <select
                id="subscription-category"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full text-sm font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-3 text-on-surface transition-all"
              >
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subcategoría */}
            <div className="sm:col-span-2 xl:col-span-1">
              <label
                htmlFor="subscription-subcategory"
                className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5 truncate"
              >
                Subcat.
              </label>
              <select
                id="subscription-subcategory"
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                className="w-full text-sm font-medium rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-2.5 text-on-surface transition-all"
              >
                <option value="">General</option>
                {availableSubcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Día de cobro */}
            <div className="sm:col-span-2 xl:col-span-1">
              <label
                htmlFor="subscription-day"
                className="block font-mono text-[11px] uppercase tracking-wider font-semibold text-on-surface-variant mb-1.5"
              >
                Día
              </label>
              <input
                id="subscription-day"
                type="number"
                min="1"
                max="31"
                value={billingDay}
                onChange={(e) => setBillingDay(e.target.value)}
                className="w-full text-sm font-mono font-semibold text-center rounded-xl bg-surface-container-low border border-transparent focus:border-secondary/40 focus:bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-secondary/20 py-2.5 px-2 text-on-surface transition-all"
              />
            </div>
          </div>

          {/* Fila Inferior: Modo + Botón Guardar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIncludeInMonthly((v) => !v)}
              className={`inline-flex items-center gap-2 font-semibold text-xs px-3.5 py-2 rounded-xl border transition-colors cursor-pointer text-left ${
                includeInMonthly
                  ? 'bg-secondary-container/35 border-secondary/25 text-on-secondary-container hover:bg-secondary-container/55'
                  : 'bg-amber-50 border-amber-200/80 text-amber-800 hover:bg-amber-100/70'
              }`}
            >
              {includeInMonthly ? (
                <>
                  <ToggleRight className="w-4 h-4 text-secondary shrink-0" />
                  <span>
                    Modo: <strong className="underline">Sumar al Gasto Mensual</strong>{' '}
                    {billingCycle === 'annual' ? '(prorrateado ÷ 12)' : ''}
                  </span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Modo: <strong className="underline">Mantener separado en Gasto Anual</strong>
                  </span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="bg-primary-container hover:bg-on-surface disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-all w-full sm:w-auto justify-center cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{submitting ? 'Guardando...' : 'Guardar Suscripción'}</span>
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-3 text-xs text-on-error-container bg-error-container/60 px-3.5 py-2 rounded-lg border border-error/20">
            {error}
          </p>
        )}
      </section>

      {/* 4. Listado de Suscripciones Activas */}
      <section className="bg-surface-container-lowest border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-on-surface tracking-tight">
              Mis Suscripciones y Pagos Recurrentes ({subscriptions.length})
            </h3>
            <span className="font-mono text-xs font-semibold text-on-surface-variant bg-surface-container-low px-2.5 py-1 rounded-lg">
              Total activo: {subscriptions.length}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Usa el botón de cada suscripción para elegir si se suma al gasto mensual o queda separada en el gasto anual
          </p>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">
            No tienes suscripciones registradas. Añade tus pagos mensuales o anuales arriba.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {subscriptions.map((sub) => {
              const isIncluded = sub.include_in_monthly === 1;
              const isAnnual = sub.billing_cycle === 'annual';
              const monthlyEquivalentUsd = isAnnual ? sub.amount / 12 : sub.amount;

              return (
                <div
                  key={sub.id}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-surface-container-low/50 transition-colors"
                >
                  {/* Izquierda: Pill Periodicidad + Nombre + Categoría */}
                  <div className="flex items-center gap-4 min-w-0">
                    <span
                      className={`inline-flex items-center justify-center px-3 py-1 rounded-xl font-mono text-xs font-bold border min-w-[78px] shrink-0 ${
                        isAnnual
                          ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                          : 'bg-surface-container-low text-on-surface border-slate-200/80'
                      }`}
                    >
                      {isAnnual ? 'Anual' : 'Mensual'}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-on-surface truncate">
                          {sub.name}
                        </h4>
                        <span className="font-mono text-xs font-medium text-outline">
                          (Día {sub.billing_day})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${sub.category_color}18`,
                            color: sub.category_color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: sub.category_color }}
                          />
                          <span>{sub.category_name}</span>
                          {sub.subcategory_name && (
                            <>
                              <ChevronRight className="w-3 h-3 opacity-70" />
                              <span className="font-semibold">{sub.subcategory_name}</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Derecha: Botón Toggle + Monto Tabular + Eliminar */}
                  <div className="flex items-center justify-between md:justify-end gap-4 sm:gap-6">
                    <button
                      type="button"
                      onClick={() => onToggleSubscriptionMonthly(sub.id, !isIncluded)}
                      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors cursor-pointer ${
                        isIncluded
                          ? 'text-on-secondary-container bg-secondary-container/35 border-secondary/25 hover:bg-secondary-container/55'
                          : 'text-amber-800 bg-amber-50/90 border-amber-300 hover:bg-amber-100'
                      }`}
                      title="Haz clic para cambiar entre sumar al gasto mensual o separar en gasto anual"
                    >
                      {isIncluded ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-secondary shrink-0" />
                          <span>En Gasto Mensual</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Solo en Gasto Anual</span>
                        </>
                      )}
                    </button>

                    <div className="text-right min-w-28 font-tabular">
                      <div className="font-mono text-sm font-bold text-on-surface">
                        {formatCurrency(sub.amount)}{' '}
                        <span className="text-xs font-medium text-outline">
                          /{isAnnual ? 'año' : 'mes'}
                        </span>
                      </div>
                      {isAnnual && isIncluded && (
                        <div className="font-mono text-[11px] font-semibold text-secondary">
                          Suma {formatCurrency(monthlyEquivalentUsd)}/mes
                        </div>
                      )}
                      <div className="font-mono text-[11px] font-medium text-on-surface-variant">
                        {formatBolivares(toVes(sub.amount))}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteSubscription(sub.id)}
                      className="p-2 text-slate-300 hover:text-error hover:bg-error-container/40 rounded-xl transition-colors cursor-pointer shrink-0"
                      title="Eliminar Suscripción"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pie informativo de la tarjeta */}
        <div className="p-4 bg-surface-container-low/50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-secondary shrink-0" />
            <span>
              Las suscripciones activas en gasto mensual se reflejan automáticamente en tu resumen del mes y balance anual.
            </span>
          </div>
          <span className="font-mono text-xs font-semibold text-on-surface">
            {stats.monthlyCount} mensuales · {stats.annualCount} anuales
          </span>
        </div>
      </section>
    </div>
  );
};
