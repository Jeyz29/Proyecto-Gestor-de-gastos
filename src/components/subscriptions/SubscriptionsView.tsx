import React, { useState, useEffect, useMemo } from 'react';
import {
  Repeat,
  CalendarCheck,
  PlusCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronRight,
  Layers,
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

  // Cuando el usuario cambia entre ciclo mensual y anual, sugerir el modo por defecto:
  // Mensual -> incluido en el mes (true), Anual -> separado en gasto anual (false) o según preferencia
  useEffect(() => {
    if (billingCycle === 'monthly') {
      setIncludeInMonthly(true);
    } else {
      setIncludeInMonthly(includeAnnualInMonthlyGlobal);
    }
  }, [billingCycle, includeAnnualInMonthlyGlobal]);

  const parsedValue = parseFloat(rawAmount);
  const hasValidAmount = !isNaN(parsedValue) && parsedValue > 0;

  // Convertir monto ingresado a USD base
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

  // Cálculos de resumen de suscripciones
  const stats = useMemo(() => {
    // 1. Lo que se suma al gasto mensual cada mes
    let monthlyImpactUsd = 0;
    // 2. Lo que está separado exclusivamente como gasto anual (no sumado al mes)
    let separatedAnnualUsd = 0;
    // 3. Costo total anualizado de absolutamente todas las suscripciones (mensuales*12 + anuales)
    let totalAnnualizedUsd = 0;

    for (const sub of subscriptions) {
      const isIncluded = sub.include_in_monthly === 1;
      if (sub.billing_cycle === 'monthly') {
        totalAnnualizedUsd += sub.amount * 12;
        if (isIncluded) {
          monthlyImpactUsd += sub.amount;
        } else {
          separatedAnnualUsd += sub.amount * 12;
        }
      } else {
        // Anual
        totalAnnualizedUsd += sub.amount;
        if (isIncluded) {
          // Si una suscripción anual se incluye en el gasto mensual, aporta su cuota mensual (monto / 12)
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
    };
  }, [subscriptions]);

  const toVes = (usd: number) => (currentBcvRate > 0 ? usd * currentBcvRate : 0);
  const toEur = (usd: number) => {
    const ves = toVes(usd);
    return currentBcvEurRate > 0 && ves > 0 ? ves / currentBcvEurRate : 0;
  };

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Resumen y Botón Maestro Mensual vs Anual */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Impacto sumado al Gasto Mensual */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">
              Sumado al Gasto Mensual
            </span>
            <Repeat className="w-5 h-5 text-indigo-200" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold">{formatCurrency(stats.monthlyImpactUsd)} / mes</div>
            <div className="text-xs text-indigo-100 mt-1">
              {toEur(stats.monthlyImpactUsd) > 0
                ? `${formatEuros(toEur(stats.monthlyImpactUsd))} · `
                : ''}
              {formatBolivares(toVes(stats.monthlyImpactUsd))}
            </div>
          </div>
          <p className="text-[11px] text-indigo-200">
            Se agrega automáticamente al resumen y comparativa de cada mes.
          </p>
        </div>

        {/* Apartado Separado: Gasto Anual */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Separado en Gasto Anual
            </span>
            <CalendarCheck className="w-5 h-5 text-amber-500" />
          </div>
          <div className="my-3">
            <div className="text-2xl font-bold text-slate-900">
              {formatCurrency(stats.separatedAnnualUsd)} / año
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {toEur(stats.separatedAnnualUsd) > 0
                ? `${formatEuros(toEur(stats.separatedAnnualUsd))} · `
                : ''}
              {formatBolivares(toVes(stats.separatedAnnualUsd))}
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            Pagos anuales o recurrentes que elegiste mantener fuera del mes a mes.
          </p>
        </div>

        {/* Total Anualizado + Botón de Cambio Rápido */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Costo Total Anualizado
              </span>
              <Layers className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-slate-800 mt-2">
              {formatCurrency(stats.totalAnnualizedUsd)} / año
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              {formatBolivares(toVes(stats.totalAnnualizedUsd))}
            </div>
          </div>

          {/* Botón para el usuario: incluir o separar pagos anuales en el gasto mensual */}
          <div className="mt-4 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onToggleGlobalAnnualInMonthly}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${
                includeAnnualInMonthlyGlobal
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
              }`}
            >
              <span>
                {includeAnnualInMonthlyGlobal
                  ? 'Pagos anuales: Sumados al mes (÷12)'
                  : 'Pagos anuales: Separados en gasto anual'}
              </span>
              {includeAnnualInMonthlyGlobal ? (
                <ToggleRight className="w-5 h-5 text-indigo-600 shrink-0" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-slate-400 shrink-0" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Formulario para Añadir Suscripción Recurrente o Anual */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-indigo-600" />
            Nueva Suscripción o Pago Recurrente
          </h2>

          {/* Selector de moneda */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setInputCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                inputCurrency === 'USD'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              USD ($)
            </button>
            <button
              type="button"
              onClick={() => setInputCurrency('EUR')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                inputCurrency === 'EUR'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              EUR (€ BCV)
            </button>
            <button
              type="button"
              onClick={() => setInputCurrency('VES')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                inputCurrency === 'VES'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600'
              }`}
            >
              Bs. (BCV)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
          {/* Nombre del servicio */}
          <div className="sm:col-span-3">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Servicio / Suscripción
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Netflix, Spotify, Dominio Web..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Monto */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Monto ({inputCurrency === 'USD' ? '$' : inputCurrency === 'EUR' ? '€' : 'Bs.'})
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={rawAmount}
              onChange={(e) => setRawAmount(e.target.value)}
              placeholder="0.00"
              required
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Frecuencia: Mensual o Anual */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Ciclo de Cobro
            </label>
            <select
              value={billingCycle}
              onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'annual')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="monthly">Mensual</option>
              <option value="annual">Anual</option>
            </select>
          </div>

          {/* Categoría */}
          <div className="sm:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium text-slate-500">Categoría</label>
              <button
                type="button"
                onClick={onOpenCategories}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                + Editar
              </button>
            </div>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subcategoría */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Subcategoría
            </label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
          <div className="sm:col-span-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Día
            </label>
            <input
              type="number"
              min="1"
              max="31"
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Botón de modo (Sumar al gasto mensual vs Separar en gasto anual) + Botón Guardar */}
          <div className="sm:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIncludeInMonthly((v) => !v)}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                includeInMonthly
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {includeInMonthly ? (
                <>
                  <ToggleRight className="w-4 h-4 text-indigo-600" />
                  <span>
                    Modo: <strong>Sumar al Gasto Mensual</strong>{' '}
                    {billingCycle === 'annual' ? '(se prorratea ÷ 12 cada mes)' : ''}
                  </span>
                </>
              ) : (
                <>
                  <ToggleLeft className="w-4 h-4 text-amber-600" />
                  <span>
                    Modo: <strong>Mantener separado en Gasto Anual</strong> (no afecta el total mensual)
                  </span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
            >
              {submitting ? 'Guardando...' : '+ Guardar Suscripción'}
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
            {error}
          </p>
        )}
      </div>

      {/* 3. Listado de Suscripciones con Botón Individual para Sumar al Mes o Separar al Año */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">
              Mis Suscripciones y Pagos Recurrentes ({subscriptions.length})
            </h3>
            <p className="text-xs text-slate-400">
              Usa el botón de cada suscripción para elegir si se suma al gasto mensual o queda separada en el gasto anual
            </p>
          </div>
        </div>

        {subscriptions.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
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
                  className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/80 transition-colors"
                >
                  {/* Info de la suscripción */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 ${
                        isAnnual
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {isAnnual ? 'Anual' : 'Mensual'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-800 truncate">
                          {sub.name}
                        </p>
                        <span className="text-xs text-slate-400">
                          (Día {sub.billing_day})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${sub.category_color}18`,
                            color: sub.category_color,
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full"
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

                  {/* Controles: Botón de inclusión mensual vs anual + Monto + Eliminar */}
                  <div className="flex items-center gap-4 ml-auto">
                    {/* Botón interactivo para el usuario */}
                    <button
                      type="button"
                      onClick={() => onToggleSubscriptionMonthly(sub.id, !isIncluded)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        isIncluded
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                      }`}
                      title="Haz clic para cambiar entre sumar al gasto mensual o separar en gasto anual"
                    >
                      {isIncluded ? (
                        <>
                          <ToggleRight className="w-4 h-4 text-indigo-600" />
                          <span>En Gasto Mensual</span>
                        </>
                      ) : (
                        <>
                          <ToggleLeft className="w-4 h-4 text-amber-600" />
                          <span>Solo en Gasto Anual</span>
                        </>
                      )}
                    </button>

                    {/* Montos */}
                    <div className="text-right min-w-28">
                      <span className="block text-sm font-bold text-slate-900">
                        {formatCurrency(sub.amount)}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          /{isAnnual ? 'año' : 'mes'}
                        </span>
                      </span>
                      {isAnnual && isIncluded && (
                        <span className="block text-[11px] font-medium text-indigo-600">
                          Suma {formatCurrency(monthlyEquivalentUsd)}/mes
                        </span>
                      )}
                      <span className="block text-[11px] text-slate-400">
                        {formatBolivares(toVes(sub.amount))}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteSubscription(sub.id)}
                      className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar suscripción"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
