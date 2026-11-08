import React, { useState, useMemo } from 'react';
import {
  Trash2,
  Receipt,
  ChevronRight,
  Edit3,
  Check,
  X,
  ArrowLeftRight,
  CalendarClock,
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
  getTodayISO,
} from '../../utils/formatters.ts';

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
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setError(null);
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
    setError(null);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar el movimiento');
    } finally {
      setSaving(false);
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
          <Receipt className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-700">Sin gastos registrados</h3>
        <p className="text-xs text-slate-400 mt-1">
          Usa el formulario superior para añadir tu primer gasto de este mes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800">Detalle de Movimientos</h3>
        <span className="text-xs text-slate-400">{expenses.length} registros</span>
      </div>

      <div className="divide-y divide-slate-100">
        {expenses.map((expense) => {
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
                <div className="text-xs font-medium text-slate-400 w-14 shrink-0">
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
                    onClick={() => onDeleteExpense(expense.id)}
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
    </div>
  );
};
