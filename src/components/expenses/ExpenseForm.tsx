import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  PlusCircle,
  ArrowLeftRight,
  CalendarClock,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import type {
  Category,
  Subcategory,
  CreateExpenseInput,
  Expense,
} from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  getTodayISO,
  formatCurrency,
  formatEuros,
  formatBolivares,
  formatShortDate,
} from '../../utils/formatters.ts';

const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

interface ExpenseSuggestion {
  description: string;
  category_id: string;
  category_name: string;
  category_color: string;
  subcategory_id: string;
  subcategory_name: string | null;
  lastAmountUsd: number;
  count: number;
  lastDate: string;
}

interface ExpenseFormProps {
  categories: Category[];
  subcategories: Subcategory[];
  selectedMonth: string;
  currentBcvRate: number;
  currentBcvEurRate: number;
  onAddExpense: (data: CreateExpenseInput) => Promise<void>;
  onOpenCategories: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  categories,
  subcategories,
  selectedMonth,
  currentBcvRate,
  currentBcvEurRate,
  onAddExpense,
  onOpenCategories,
}) => {
  const [inputCurrency, setInputCurrency] = useState<'USD' | 'EUR' | 'VES'>('USD');
  const [rawAmount, setRawAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState(getTodayISO());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado para el autocompletado inteligente de gastos
  const [historicalExpenses, setHistoricalExpenses] = useState<Expense[]>([]);
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const suggestionContainerRef = useRef<HTMLDivElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Estado de la tasa BCV específica para la fecha seleccionada en el formulario
  const [dateUsdRate, setDateUsdRate] = useState<number>(currentBcvRate);
  const [dateEurRate, setDateEurRate] = useState<number>(currentBcvEurRate);
  const [altValueUsdRate, setAltValueUsdRate] = useState<number>(0);
  const [altValueEurRate, setAltValueEurRate] = useState<number>(0);
  const [useValueDateMode, setUseValueDateMode] = useState<boolean>(false);
  const [loadingDateRate, setLoadingDateRate] = useState<boolean>(false);
  const [isHistoricalRate, setIsHistoricalRate] = useState<boolean>(false);

  const loadHistoryForAutocomplete = useCallback(async () => {
    try {
      const all = await api.getExpenses();
      setHistoricalExpenses(all);
    } catch {
      // Silencioso si falla
    }
  }, []);

  useEffect(() => {
    loadHistoryForAutocomplete();
  }, [loadHistoryForAutocomplete]);

  // Cerrar el menú de sugerencias al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestionContainerRef.current &&
        !suggestionContainerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Construir catálogo único de sugerencias ordenadas por frecuencia y recencia
  const allSuggestions = useMemo<ExpenseSuggestion[]>(() => {
    const map = new Map<string, ExpenseSuggestion>();

    // historicalExpenses ya viene ordenado por expense_date DESC, created_at DESC
    for (const exp of historicalExpenses) {
      const cleanDesc = (exp.description || '').trim();
      if (!cleanDesc) continue;
      const key = normalizeText(cleanDesc);

      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          description: cleanDesc,
          category_id: exp.category_id,
          category_name: exp.category_name,
          category_color: exp.category_color,
          subcategory_id: exp.subcategory_id || '',
          subcategory_name: exp.subcategory_name || null,
          lastAmountUsd: exp.amount,
          count: 1,
          lastDate: exp.expense_date,
        });
      } else {
        existing.count += 1;
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.lastDate.localeCompare(a.lastDate);
    });
  }, [historicalExpenses]);

  // Filtrar sugerencias según lo que escribe el usuario
  const matchingSuggestions = useMemo<ExpenseSuggestion[]>(() => {
    const q = normalizeText(description.trim());
    if (!q) {
      // Si el campo está vacío, mostrar los 5 gastos más frecuentes
      return allSuggestions.slice(0, 5);
    }
    return allSuggestions
      .filter((s) => {
        const normDesc = normalizeText(s.description);
        const normCat = normalizeText(s.category_name);
        const normSub = normalizeText(s.subcategory_name || '');
        return normDesc.includes(q) || normCat.includes(q) || normSub.includes(q);
      })
      .slice(0, 6);
  }, [allSuggestions, description]);

  const applySuggestion = (suggestion: ExpenseSuggestion, includeAmount = false) => {
    setDescription(suggestion.description);
    // Verificar que la categoría aún exista
    const categoryExists = categories.some((c) => c.id === suggestion.category_id);
    if (categoryExists) {
      setCategoryId(suggestion.category_id);
      const subExists = subcategories.some(
        (s) =>
          s.id === suggestion.subcategory_id &&
          s.category_id === suggestion.category_id
      );
      setSubcategoryId(subExists ? suggestion.subcategory_id : '');
    }

    if (includeAmount && suggestion.lastAmountUsd > 0) {
      if (inputCurrency === 'USD') {
        setRawAmount(suggestion.lastAmountUsd.toFixed(2));
      } else if (inputCurrency === 'VES' && activeUsdRate > 0) {
        setRawAmount((suggestion.lastAmountUsd * activeUsdRate).toFixed(2));
      } else if (inputCurrency === 'EUR' && activeUsdRate > 0 && activeEurRate > 0) {
        setRawAmount(
          ((suggestion.lastAmountUsd * activeUsdRate) / activeEurRate).toFixed(2)
        );
      }
    } else {
      // Enfocar el campo de monto para que el usuario solo escriba el valor
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 10);
    }

    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  // Seleccionar la primera categoría por defecto cuando carguen
  useEffect(() => {
    if (!categoryId && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  // Subcategorías disponibles para la categoría seleccionada
  const availableSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === categoryId),
    [subcategories, categoryId]
  );

  // Ajustar la fecha sugerida si el usuario navega a otro mes distinto al actual
  useEffect(() => {
    const today = getTodayISO();
    if (today.startsWith(selectedMonth)) {
      setExpenseDate(today);
    } else {
      setExpenseDate(`${selectedMonth}-15`);
    }
  }, [selectedMonth]);

  // Consultar automáticamente la tasa oficial del BCV del día elegido cuando cambia la fecha
  useEffect(() => {
    const today = getTodayISO();
    if (!expenseDate || expenseDate >= today) {
      setDateUsdRate(currentBcvRate);
      setDateEurRate(currentBcvEurRate);
      setAltValueUsdRate(0);
      setAltValueEurRate(0);
      setUseValueDateMode(false);
      setIsHistoricalRate(false);
      return;
    }

    let cancelled = false;
    setLoadingDateRate(true);

    api
      .getHistoricalBcvRate(expenseDate)
      .then((hist) => {
        if (cancelled) return;
        if (hist.rate > 0) {
          setDateUsdRate(hist.rate);
          setDateEurRate(hist.eurRate > 0 ? hist.eurRate : currentBcvEurRate);
          setAltValueUsdRate(hist.valueDateRate || hist.rate);
          setAltValueEurRate(hist.valueDateEurRate || hist.eurRate);
          setUseValueDateMode(false);
          setIsHistoricalRate(hist.source === 'bcv-history');
        } else {
          setDateUsdRate(currentBcvRate);
          setDateEurRate(currentBcvEurRate);
          setIsHistoricalRate(false);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setDateUsdRate(currentBcvRate);
        setDateEurRate(currentBcvEurRate);
        setIsHistoricalRate(false);
      })
      .finally(() => {
        if (!cancelled) setLoadingDateRate(false);
      });

    return () => {
      cancelled = true;
    };
  }, [expenseDate, currentBcvRate, currentBcvEurRate]);

  const activeUsdRate = useValueDateMode && altValueUsdRate > 0
    ? altValueUsdRate
    : dateUsdRate > 0
    ? dateUsdRate
    : currentBcvRate;

  const activeEurRate = useValueDateMode && altValueEurRate > 0
    ? altValueEurRate
    : dateEurRate > 0
    ? dateEurRate
    : currentBcvEurRate;

  const parsedValue = parseFloat(rawAmount);
  const hasValidAmount = !isNaN(parsedValue) && parsedValue > 0;

  // Cálculo de equivalencia entre USD ($), EUR (€) y Bolívares (Bs.) según la tasa BCV de la fecha elegida
  let calculatedUsd = 0;
  let calculatedEur = 0;
  let calculatedVes = 0;

  if (hasValidAmount) {
    if (inputCurrency === 'USD') {
      calculatedUsd = parsedValue;
      calculatedVes = activeUsdRate > 0 ? parsedValue * activeUsdRate : 0;
      calculatedEur = activeEurRate > 0 ? calculatedVes / activeEurRate : 0;
    } else if (inputCurrency === 'EUR') {
      calculatedEur = parsedValue;
      calculatedVes = activeEurRate > 0 ? parsedValue * activeEurRate : 0;
      calculatedUsd = activeUsdRate > 0 ? calculatedVes / activeUsdRate : 0;
    } else {
      // VES
      calculatedVes = parsedValue;
      calculatedUsd = activeUsdRate > 0 ? parsedValue / activeUsdRate : 0;
      calculatedEur = activeEurRate > 0 ? parsedValue / activeEurRate : 0;
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasValidAmount) {
      setError('Ingresa un monto válido mayor a 0');
      return;
    }
    if (inputCurrency !== 'USD' && activeUsdRate <= 0) {
      setError('No hay tasa BCV disponible para convertir a Dólares');
      return;
    }
    if (inputCurrency === 'EUR' && activeEurRate <= 0) {
      setError('No hay tasa de Euro BCV disponible');
      return;
    }
    if (!categoryId) {
      setError('Selecciona una categoría');
      return;
    }

    setSubmitting(true);
    try {
      await onAddExpense({
        amount: Number(calculatedUsd.toFixed(2)),
        exchange_rate: activeUsdRate,
        exchange_rate_eur: activeEurRate,
        amount_ves: Number(calculatedVes.toFixed(2)),
        amount_eur: Number(calculatedEur.toFixed(2)),
        description: description.trim(),
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        expense_date: expenseDate,
      });
      setRawAmount('');
      setDescription('');
      setShowSuggestions(false);
      loadHistoryForAutocomplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el gasto');
    } finally {
      setSubmitting(false);
    }
  };

  const currencySymbol =
    inputCurrency === 'USD' ? '$' : inputCurrency === 'EUR' ? '€' : 'Bs.';

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-indigo-600" />
          Registrar Nuevo Gasto
        </h2>

        {/* Selector de moneda de entrada: USD, EUR o VES */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setInputCurrency('USD')}
            className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
              inputCurrency === 'USD'
                ? 'bg-white text-indigo-600 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
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
                : 'text-slate-600 hover:text-slate-900'
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
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Bolívares (Bs.)
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3.5">
        {/* Concepto / Descripción con Autocompletado Inteligente */}
        <div className="sm:col-span-3 relative" ref={suggestionContainerRef}>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Descripción / Concepto
          </label>
          <input
            type="text"
            value={description}
            onFocus={() => setShowSuggestions(true)}
            onChange={(e) => {
              setDescription(e.target.value);
              setShowSuggestions(true);
              setHighlightedIndex(-1);
            }}
            onKeyDown={(e) => {
              if (!showSuggestions || matchingSuggestions.length === 0) return;
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev < matchingSuggestions.length - 1 ? prev + 1 : 0
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlightedIndex((prev) =>
                  prev > 0 ? prev - 1 : matchingSuggestions.length - 1
                );
              } else if (e.key === 'Enter' && highlightedIndex >= 0) {
                e.preventDefault();
                applySuggestion(matchingSuggestions[highlightedIndex], false);
              } else if (e.key === 'Escape') {
                setShowSuggestions(false);
              }
            }}
            placeholder="Ej: Pollo y carne, Verdulería..."
            autoComplete="off"
            required
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          {/* Menú flotante de sugerencias de gastos previos */}
          {showSuggestions && matchingSuggestions.length > 0 && (
            <div className="absolute left-0 top-full mt-1.5 w-full sm:w-84 bg-white rounded-2xl border border-slate-200 shadow-lg z-30 overflow-hidden">
              <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1 font-medium text-indigo-600">
                  <Sparkles className="w-3 h-3" />
                  {description.trim()
                    ? 'Sugerencias de tu historial'
                    : 'Gastos frecuentes'}
                </span>
                <span>Clic para autocompletar</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                {matchingSuggestions.map((item, idx) => {
                  const isHighlighted = idx === highlightedIndex;
                  return (
                    <div
                      key={`${item.description}-${idx}`}
                      onClick={() => applySuggestion(item, false)}
                      className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                        isHighlighted ? 'bg-indigo-50/90' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-800 truncate">
                            {item.description}
                          </span>
                          {item.count > 1 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-500 font-medium shrink-0">
                              {item.count}x
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 text-[11px]">
                          <span
                            className="inline-flex items-center gap-1 font-medium truncate"
                            style={{ color: item.category_color }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.category_color }}
                            />
                            {item.category_name}
                          </span>
                          {item.subcategory_name && (
                            <>
                              <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="text-slate-600 font-medium truncate">
                                {item.subcategory_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Botón rápido opcional para rellenar también el último monto */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          applySuggestion(item, true);
                        }}
                        className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold shrink-0 transition-colors cursor-pointer"
                        title="Autocompletar también con este último monto"
                      >
                        Usar {formatCurrency(item.lastAmountUsd)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Monto (en USD, EUR o Bs.) */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Monto ({currencySymbol})
          </label>
          <input
            ref={amountInputRef}
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

        {/* Categoría Principal */}
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
            onChange={(e) => {
              setCategoryId(e.target.value);
              setSubcategoryId('');
            }}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subcategoría (ej. Proteína, Verduras, Frutas...) */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Subcategoría
          </label>
          <select
            value={subcategoryId}
            onChange={(e) => setSubcategoryId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">General / Sin especificar</option>
            {availableSubcategories.map((sub) => (
              <option key={sub.id} value={sub.id}>
                {sub.name}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Fecha</label>
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            required
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Botón Guardar */}
        <div className="sm:col-span-1 flex items-end">
          <button
            type="submit"
            disabled={submitting || loadingDateRate}
            className="w-full py-2 px-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm rounded-xl transition-colors cursor-pointer"
          >
            {submitting ? '...' : 'Añadir'}
          </button>
        </div>
      </form>

      {/* Aviso de Tasa BCV Histórica cuando se elige una fecha pasada */}
      {isHistoricalRate && activeUsdRate > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs bg-amber-50/90 text-amber-900 px-3.5 py-2 rounded-xl border border-amber-200/80">
          <div className="flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Tasa BCV del <strong>{formatShortDate(expenseDate)}</strong> ({expenseDate}):
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold">
              $: Bs. {activeUsdRate.toFixed(4)}
            </span>
            {activeEurRate > 0 && (
              <span className="font-semibold">
                €: Bs. {activeEurRate.toFixed(4)}
              </span>
            )}
            {altValueUsdRate > 0 && altValueUsdRate !== dateUsdRate && (
              <button
                type="button"
                onClick={() => setUseValueDateMode((v) => !v)}
                className="underline text-amber-700 hover:text-amber-950 cursor-pointer"
                title="Alternar entre tasa publicada ese día vs tasa de fecha valor previa"
              >
                {useValueDateMode
                  ? `Usar tasa publicada (${dateUsdRate.toFixed(2)})`
                  : `Usar tasa previa (${altValueUsdRate.toFixed(2)})`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Previsualización de conversión triple BCV (USD / EUR / Bs.) */}
      {hasValidAmount && activeUsdRate > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            Conversión aplicada:
          </span>
          <span>
            Base USD: <strong className="text-indigo-700">{formatCurrency(calculatedUsd)}</strong>
          </span>
          {activeEurRate > 0 && (
            <span>
              Equiv. Euro: <strong className="text-slate-700">{formatEuros(calculatedEur)}</strong>
            </span>
          )}
          <span>
            Equiv. Bolívares:{' '}
            <strong className="text-slate-700">{formatBolivares(calculatedVes)}</strong>
          </span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg border border-red-100">
          {error}
        </p>
      )}
    </div>
  );
};
