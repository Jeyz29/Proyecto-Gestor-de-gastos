import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Trash2,
  Receipt,
  ChevronRight,
  Edit3,
  Check,
  X,
  ArrowLeftRight,
  CalendarClock,
  Search,
  Globe,
} from 'lucide-react';
import type {
  Expense,
  Category,
  Subcategory,
  CreateExpenseInput,
} from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  formatCurrency,
  formatEuros,
  formatBolivares,
  formatShortDate,
  formatMonthLabel,
  getTodayISO,
} from '../../utils/formatters.ts';

// Normaliza texto quitando tildes y pasando a minúsculas para búsquedas flexibles
const normalizeText = (text: string): string =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

interface ExpenseListProps {
  expenses: Expense[];
  categories: Category[];
  subcategories: Subcategory[];
  currentBcvRate: number;
  currentBcvEurRate: number;
  onUpdateExpense: (id: string, data: CreateExpenseInput) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  categories,
  subcategories,
  currentBcvRate,
  currentBcvEurRate,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  // Estado del buscador y alcance global ("Todos los meses")
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchAllMonths, setSearchAllMonths] = useState<boolean>(false);
  const [allMonthsExpenses, setAllMonthsExpenses] = useState<Expense[]>([]);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCurrency, setEditCurrency] = useState<'USD' | 'EUR' | 'VES'>('USD');
  const [editRawAmount, setEditRawAmount] = useState<string>('');
  const [editCategoryId, setEditCategoryId] = useState<string>('');
  const [editSubcategoryId, setEditSubcategoryId] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editUsdRate, setEditUsdRate] = useState<number>(0);
  const [editEurRate, setEditEurRate] = useState<number>(0);
  const [loadingRate, setLoadingRate] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchAllExpenses = useCallback(async () => {
    try {
      const data = await api.getExpenses();
      setAllMonthsExpenses(data);
    } catch (err) {
      console.error('Error al cargar todos los meses para búsqueda:', err);
    }
  }, []);

  // Precargar en segundo plano para que alternar "Buscar en todos los meses" sea instantáneo y sin saltos de scroll
  useEffect(() => {
    fetchAllExpenses();
  }, [expenses, fetchAllExpenses]);

  // Fuente de datos activa (mes actual vs todos los meses, sin vaciar la lista mientras carga)
  const sourceExpenses =
    searchAllMonths && allMonthsExpenses.length > 0 ? allMonthsExpenses : expenses;

  // Filtrado instantáneo por descripción, categoría, subcategoría, monto o fecha
  const displayedExpenses = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    if (!q) return sourceExpenses;

    return sourceExpenses.filter((exp) => {
      const desc = normalizeText(exp.description || '');
      const cat = normalizeText(exp.category_name || '');
      const sub = normalizeText(exp.subcategory_name || '');
      const dateIso = normalizeText(exp.expense_date || '');
      const dateShort = normalizeText(formatShortDate(exp.expense_date));
      const monthLabel = normalizeText(formatMonthLabel(exp.expense_date.slice(0, 7)));
      const amountUsd = exp.amount.toFixed(2);
      const amountVes = exp.amount_ves > 0 ? exp.amount_ves.toFixed(2) : '';
      const amountEur = exp.amount_eur > 0 ? exp.amount_eur.toFixed(2) : '';

      return (
        desc.includes(q) ||
        cat.includes(q) ||
        sub.includes(q) ||
        dateIso.includes(q) ||
        dateShort.includes(q) ||
        monthLabel.includes(q) ||
        amountUsd.includes(q) ||
        amountVes.includes(q) ||
        amountEur.includes(q)
      );
    });
  }, [sourceExpenses, searchQuery]);

  // Subtotales de los movimientos filtrados
  const filteredTotals = useMemo(() => {
    let usd = 0;
    let eur = 0;
    let ves = 0;

    for (const exp of displayedExpenses) {
      usd += exp.amount;
      const itemVes =
        exp.amount_ves > 0
          ? exp.amount_ves
          : currentBcvRate > 0
          ? exp.amount * currentBcvRate
          : 0;
      ves += itemVes;

      const rateEurUsed =
        exp.exchange_rate_eur > 0 ? exp.exchange_rate_eur : currentBcvEurRate;
      const itemEur =
        exp.amount_eur > 0
          ? exp.amount_eur
          : rateEurUsed > 0 && itemVes > 0
          ? itemVes / rateEurUsed
          : 0;
      eur += itemEur;
    }

    return { usd, eur, ves };
  }, [displayedExpenses, currentBcvRate, currentBcvEurRate]);

  const availableSubcategories = useMemo(
    () => subcategories.filter((s) => s.category_id === editCategoryId),
    [subcategories, editCategoryId]
  );

  const startEditing = (expense: Expense) => {
    setEditingId(expense.id);
    setEditDescription(expense.description);
    setEditCurrency('USD');
    setEditRawAmount(String(expense.amount));
    setEditCategoryId(expense.category_id);
    setEditSubcategoryId(expense.subcategory_id || '');
    setEditDate(expense.expense_date);
    setEditUsdRate(expense.exchange_rate > 0 ? expense.exchange_rate : currentBcvRate);
    setEditEurRate(
      expense.exchange_rate_eur > 0 ? expense.exchange_rate_eur : currentBcvEurRate
    );
    setError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setError('');
  };

  // Cuando el usuario cambia la fecha en la edición, consultar la tasa histórica del BCV de ese día
  const handleDateChange = async (newDate: string) => {
    setEditDate(newDate);
    if (!newDate) return;

    const today = getTodayISO();
    if (newDate >= today) {
      setEditUsdRate(currentBcvRate);
      setEditEurRate(currentBcvEurRate);
      return;
    }

    setLoadingRate(true);
    try {
      const hist = await api.getHistoricalBcvRate(newDate);
      if (hist.rate > 0) {
        setEditUsdRate(hist.rate);
        setEditEurRate(hist.eurRate > 0 ? hist.eurRate : currentBcvEurRate);
      }
    } catch {
      // Mantener la tasa que tenía si falla la red
    } finally {
      setLoadingRate(false);
    }
  };

  const parsedVal = parseFloat(editRawAmount);
  const hasValidAmount = !isNaN(parsedVal) && parsedVal > 0;
  const activeUsdRate = editUsdRate > 0 ? editUsdRate : currentBcvRate;
  const activeEurRate = editEurRate > 0 ? editEurRate : currentBcvEurRate;

  let previewUsd = 0;
  let previewEur = 0;
  let previewVes = 0;

  if (hasValidAmount) {
    if (editCurrency === 'USD') {
      previewUsd = parsedVal;
      previewVes = activeUsdRate > 0 ? parsedVal * activeUsdRate : 0;
      previewEur = activeEurRate > 0 ? previewVes / activeEurRate : 0;
    } else if (editCurrency === 'EUR') {
      previewEur = parsedVal;
      previewVes = activeEurRate > 0 ? parsedVal * activeEurRate : 0;
      previewUsd = activeUsdRate > 0 ? previewVes / activeUsdRate : 0;
    } else {
      previewVes = parsedVal;
      previewUsd = activeUsdRate > 0 ? parsedVal / activeUsdRate : 0;
      previewEur = activeEurRate > 0 ? parsedVal / activeEurRate : 0;
    }
  }

  const handleSaveEdit = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    if (!editDescription.trim() || !hasValidAmount || !editCategoryId || !editDate) {
      setError('Por favor completa todos los campos correctamente.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onUpdateExpense(id, {
        description: editDescription.trim(),
        amount: Number(previewUsd.toFixed(2)),
        exchange_rate: activeUsdRate,
        exchange_rate_eur: activeEurRate,
        amount_ves: Number(previewVes.toFixed(2)),
        amount_eur: Number(previewEur.toFixed(2)),
        category_id: editCategoryId,
        subcategory_id: editSubcategoryId || null,
        expense_date: editDate,
      });
      setEditingId(null);
      if (searchAllMonths) {
        await fetchAllExpenses();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  const isFiltering = searchQuery.trim().length > 0 || searchAllMonths;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      {/* Cabecera con título y buscador rápido (altura fija sin saltos de layout) */}
      <div className="px-6 py-4 border-b border-slate-100 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-800">Detalle de Movimientos</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
              {isFiltering
                ? `${displayedExpenses.length} de ${sourceExpenses.length}`
                : `${expenses.length} registros`}
            </span>
            {isFiltering && displayedExpenses.length > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium">
                Subtotal: <strong>{formatCurrency(filteredTotals.usd)}</strong>
                {filteredTotals.eur > 0 ? ` · ${formatEuros(filteredTotals.eur)}` : ''}
                {filteredTotals.ves > 0 ? ` · ${formatBolivares(filteredTotals.ves)}` : ''}
              </span>
            )}
          </div>

          {/* Botón para alternar búsqueda en todos los meses */}
          <button
            type="button"
            onClick={() => setSearchAllMonths((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              searchAllMonths
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
            title="Buscar movimientos en todo tu historial de meses"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Buscar en todos los meses</span>
          </button>
        </div>

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchAllMonths
                ? 'Buscar en todos los meses por descripción, categoría, subcategoría, monto o fecha...'
                : 'Buscar en este mes por descripción, categoría, subcategoría, monto o fecha...'
            }
            className="w-full pl-9 pr-9 py-2 bg-slate-50 hover:bg-slate-100/70 focus:bg-white rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {displayedExpenses.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
            <Receipt className="w-6 h-6" />
          </div>
          {searchQuery.trim() ? (
            <>
              <h3 className="text-sm font-semibold text-slate-700">
                No se encontraron movimientos para "{searchQuery}"
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {!searchAllMonths
                  ? 'Prueba buscando con otro término o activa "Buscar en todos los meses".'
                  : 'No hay coincidencias en ningún mes registrado.'}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Limpiar filtro
                </button>
                {!searchAllMonths && (
                  <button
                    type="button"
                    onClick={() => setSearchAllMonths(true)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    Buscar en todos los meses
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-slate-700">Sin gastos registrados</h3>
              <p className="text-xs text-slate-400 mt-1">
                Usa el formulario superior para añadir tu primer gasto de este mes o activa "Buscar en todos los meses".
              </p>
            </>
          )}
        </div>
      ) : (
      <div className="divide-y divide-slate-100">
        {displayedExpenses.map((expense) => {
          const isEditing = editingId === expense.id;

          if (isEditing) {
            return (
              <form
                key={expense.id}
                onSubmit={(e) => handleSaveEdit(e, expense.id)}
                className="p-5 bg-indigo-50/40 space-y-3.5 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-indigo-700 uppercase tracking-wider">
                    Modificando Movimiento
                  </span>

                  {/* Selector de moneda para editar el monto */}
                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditCurrency('USD');
                        setEditRawAmount(
                          previewUsd > 0 ? previewUsd.toFixed(2) : String(expense.amount)
                        );
                      }}
                      className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                        editCurrency === 'USD'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      USD ($)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCurrency('EUR');
                        setEditRawAmount(
                          previewEur > 0 ? previewEur.toFixed(2) : ''
                        );
                      }}
                      className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                        editCurrency === 'EUR'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      EUR (€)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditCurrency('VES');
                        setEditRawAmount(
                          previewVes > 0 ? previewVes.toFixed(2) : ''
                        );
                      }}
                      className={`px-2 py-0.5 rounded-lg font-medium cursor-pointer ${
                        editCurrency === 'VES'
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bs. (BCV)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Descripción */}
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Descripción
                    </label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Monto */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Monto ({editCurrency === 'USD' ? '$' : editCurrency === 'EUR' ? '€' : 'Bs.'})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={editRawAmount}
                      onChange={(e) => setEditRawAmount(e.target.value)}
                      required
                      className="w-full px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Categoría */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Categoría
                    </label>
                    <select
                      value={editCategoryId}
                      onChange={(e) => {
                        setEditCategoryId(e.target.value);
                        setEditSubcategoryId('');
                      }}
                      className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Subcategoría
                    </label>
                    <select
                      value={editSubcategoryId}
                      onChange={(e) => setEditSubcategoryId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">General</option>
                      {availableSubcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Fecha */}
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => handleDateChange(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 bg-white rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Botones Guardar / Cancelar */}
                  <div className="sm:col-span-1 flex items-end justify-end gap-1.5">
                    <button
                      type="submit"
                      disabled={saving || loadingRate}
                      className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition-colors cursor-pointer"
                      title="Guardar cambios"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Resumen de conversión y tasa aplicada al editar */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 bg-white/80 px-3 py-2 rounded-xl border border-indigo-100">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 font-medium text-indigo-700">
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Nuevo valor:
                    </span>
                    <span>
                      USD: <strong>{formatCurrency(previewUsd)}</strong>
                    </span>
                    {activeEurRate > 0 && (
                      <span>
                        EUR: <strong>{formatEuros(previewEur)}</strong>
                      </span>
                    )}
                    <span>
                      Bs.: <strong>{formatBolivares(previewVes)}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                    <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                    <span>
                      Tasa BCV ({editDate}): $: Bs. {activeUsdRate.toFixed(4)}
                      {activeEurRate > 0 ? ` · €: Bs. ${activeEurRate.toFixed(4)}` : ''}
                    </span>
                  </div>
                </div>

                {error && (
                  <p className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100">
                    {error}
                  </p>
                )}
              </form>
            );
          }

          const vesAmount =
            expense.amount_ves > 0
              ? expense.amount_ves
              : currentBcvRate > 0
              ? expense.amount * currentBcvRate
              : 0;

          const rateUsdUsed =
            expense.exchange_rate > 0 ? expense.exchange_rate : currentBcvRate;
          const rateEurUsed =
            expense.exchange_rate_eur > 0
              ? expense.exchange_rate_eur
              : currentBcvEurRate;

          const eurAmount =
            expense.amount_eur > 0
              ? expense.amount_eur
              : rateEurUsed > 0 && vesAmount > 0
              ? vesAmount / rateEurUsed
              : 0;

          // Efecto cambiario individual: cuánto equivalen hoy en USD los Bolívares pagados ese día
          const usdTodayEquivalent =
            currentBcvRate > 0 && vesAmount > 0 ? vesAmount / currentBcvRate : expense.amount;
          const itemExchangeDiffUsd = expense.amount - usdTodayEquivalent;
          const hasExchangeDiff = Math.abs(itemExchangeDiffUsd) >= 0.02;

          return (
            <div
              key={expense.id}
              className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50/80 transition-colors group"
            >
              <div className="flex items-center gap-4 min-w-0">
                {/* Fecha corta */}
                <div
                  className="text-xs font-medium text-slate-400 w-14 shrink-0"
                  title={expense.expense_date}
                >
                  {formatShortDate(expense.expense_date)}
                </div>

                {/* Descripción, Categoría y Subcategoría */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {expense.description}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        backgroundColor: `${expense.category_color}18`,
                        color: expense.category_color,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: expense.category_color }}
                      />
                      <span>{expense.category_name}</span>
                      {expense.subcategory_name && (
                        <>
                          <ChevronRight className="w-3 h-3 opacity-70" />
                          <span className="font-semibold">{expense.subcategory_name}</span>
                        </>
                      )}
                    </span>
                    {rateUsdUsed > 0 && (
                      <span className="text-[11px] text-slate-400">
                        BCV $: Bs. {rateUsdUsed.toFixed(2)}
                        {rateEurUsed > 0 ? ` · €: Bs. ${rateEurUsed.toFixed(2)}` : ''}
                      </span>
                    )}
                    {hasExchangeDiff && (
                      <span
                        className={`text-[11px] px-1.5 py-0.2 rounded font-medium ${
                          itemExchangeDiffUsd > 0
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                        title="Valor actual en USD de esos Bolívares a la tasa BCV de hoy"
                      >
                        Hoy equivale a {formatCurrency(usdTodayEquivalent)} (
                        {itemExchangeDiffUsd > 0 ? '+' : ''}
                        {formatCurrency(itemExchangeDiffUsd)})
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Monto en USD + Equivalentes en EUR y Bs. + Acciones de Editar y Eliminar */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="block text-sm font-semibold text-slate-900">
                    {formatCurrency(expense.amount)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {eurAmount > 0 ? `${formatEuros(eurAmount)} · ` : ''}
                    {vesAmount > 0 ? formatBolivares(vesAmount) : ''}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEditing(expense)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Modificar movimiento"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await onDeleteExpense(expense.id);
                      if (searchAllMonths) {
                        await fetchAllExpenses();
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Eliminar movimiento"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
};
