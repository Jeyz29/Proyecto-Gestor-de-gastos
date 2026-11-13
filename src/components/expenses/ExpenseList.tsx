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
  ArrowUpDown,
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
  selectedDateFilter?: string | null;
  onClearDateFilter?: () => void;
  activeCategoryFilter?: string | null;
  onClearCategoryFilter?: () => void;
  onUpdateExpense: (id: string, data: CreateExpenseInput) => Promise<void>;
  onDeleteExpense: (id: string) => Promise<void>;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({
  expenses,
  categories,
  subcategories,
  currentBcvRate,
  currentBcvEurRate,
  selectedDateFilter = null,
  onClearDateFilter,
  activeCategoryFilter = null,
  onClearCategoryFilter,
  onUpdateExpense,
  onDeleteExpense,
}) => {
  // Estado del buscador, ordenamiento y alcance global ("Todos los meses")
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchAllMonths, setSearchAllMonths] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<'recent' | 'highest' | 'lowest'>('recent');
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

  const sourceExpenses =
    searchAllMonths && allMonthsExpenses.length > 0 ? allMonthsExpenses : expenses;

  // Filtrado instantáneo por descripción, categoría, subcategoría, monto, fecha o filtro de día en gráfica
  const displayedExpenses = useMemo(() => {
    let list = sourceExpenses;

    if (!searchAllMonths && selectedDateFilter) {
      list = list.filter((exp) => exp.expense_date === selectedDateFilter);
    }

    const q = normalizeText(searchQuery.trim());
    if (q) {
      list = list.filter((exp) => {
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
    }

    if (sortOrder === 'highest') {
      return [...list].sort((a, b) => b.amount - a.amount);
    }
    if (sortOrder === 'lowest') {
      return [...list].sort((a, b) => a.amount - b.amount);
    }
    return list;
  }, [sourceExpenses, searchAllMonths, selectedDateFilter, searchQuery, sortOrder]);

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

  const isFiltering =
    searchQuery.trim().length > 0 ||
    searchAllMonths ||
    Boolean(selectedDateFilter) ||
    Boolean(activeCategoryFilter);

  const activeCategoryObj = useMemo(
    () => categories.find((c) => c.id === activeCategoryFilter),
    [categories, activeCategoryFilter]
  );

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_8px_24px_rgba(11,28,48,0.03)] border border-slate-100 overflow-hidden">
      {/* Cabecera estilo Stitch Monthly Expense Ledger */}
      <div className="px-6 py-5 border-b border-slate-100 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-on-surface">
                Libro Mayor de Movimientos
              </h3>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-container-low text-on-surface-variant font-bold">
                {isFiltering
                  ? `${displayedExpenses.length} de ${sourceExpenses.length}`
                  : `${expenses.length} registros`}
              </span>
              {isFiltering && displayedExpenses.length > 0 && (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-secondary-container/40 text-on-secondary-container font-bold">
                  Subtotal: {formatCurrency(filteredTotals.usd)}
                  {filteredTotals.eur > 0 ? ` · ${formatEuros(filteredTotals.eur)}` : ''}
                  {filteredTotals.ves > 0 ? ` · ${formatBolivares(filteredTotals.ves)}` : ''}
                </span>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Registro cronológico con tasa histórica BCV y diferencial cambiario por transacción
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Selector de Ordenamiento */}
            <div className="inline-flex items-center gap-1.5 bg-surface-container-low px-2.5 py-1.5 rounded-lg text-xs text-on-surface">
              <ArrowUpDown className="w-3.5 h-3.5 text-on-surface-variant" />
              <select
                value={sortOrder}
                onChange={(e) =>
                  setSortOrder(e.target.value as 'recent' | 'highest' | 'lowest')
                }
                className="bg-transparent font-medium text-xs text-on-surface focus:outline-none cursor-pointer"
              >
                <option value="recent">Más recientes</option>
                <option value="highest">Mayor monto</option>
                <option value="lowest">Menor monto</option>
              </select>
            </div>

            {/* Botón para alternar búsqueda en todos los meses */}
            <button
              type="button"
              onClick={() => setSearchAllMonths((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                searchAllMonths
                  ? 'bg-secondary text-white shadow-2xs'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              }`}
              title="Buscar movimientos en todo tu historial de meses"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Buscar en todos los meses</span>
            </button>
          </div>
        </div>

        {/* Filtros rápidos activos (Fecha seleccionada en gráfica o Categoría activa) */}
        {(selectedDateFilter || activeCategoryObj) && (
          <div className="flex flex-wrap items-center gap-2">
            {selectedDateFilter && onClearDateFilter && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/10 text-secondary text-xs font-mono font-semibold">
                Día filtrado: {formatShortDate(selectedDateFilter)} ({selectedDateFilter})
                <button
                  type="button"
                  onClick={onClearDateFilter}
                  className="hover:bg-secondary/20 rounded p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {activeCategoryObj && onClearCategoryFilter && (
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{
                  backgroundColor: `${activeCategoryObj.color}18`,
                  color: activeCategoryObj.color,
                }}
              >
                Categoría: {activeCategoryObj.name}
                <button
                  type="button"
                  onClick={onClearCategoryFilter}
                  className="hover:opacity-75 rounded p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Barra de búsqueda */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              searchAllMonths
                ? 'Buscar en todos los meses por concepto, categoría, subcategoría, monto o fecha...'
                : 'Filtrar movimientos de este mes por concepto, categoría, monto o fecha...'
            }
            className="w-full pl-9 pr-9 py-2 bg-surface-container-low hover:bg-surface-container/60 focus:bg-surface-container-lowest rounded-lg border border-transparent focus:border-secondary/30 text-xs sm:text-sm text-on-surface placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-secondary/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="p-1 text-slate-400 hover:text-on-surface absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Cabecera de Columnas estilo Stitch Ledger */}
      {displayedExpenses.length > 0 && (
        <div className="hidden sm:grid sm:grid-cols-12 px-6 py-2.5 bg-surface-container-low/60 border-b border-slate-100 text-[10px] font-mono uppercase tracking-wider text-on-surface-variant font-semibold">
          <div className="col-span-2">Fecha</div>
          <div className="col-span-4">Concepto & Tasa BCV</div>
          <div className="col-span-3">Categoría / Subcategoría</div>
          <div className="col-span-3 text-right">Monto Ledger</div>
        </div>
      )}

      {displayedExpenses.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center mx-auto mb-3 text-on-surface-variant">
            <Receipt className="w-6 h-6" />
          </div>
          {searchQuery.trim() || selectedDateFilter ? (
            <>
              <h3 className="text-sm font-bold text-on-surface">
                No se encontraron movimientos con los filtros actuales
              </h3>
              <p className="text-xs text-on-surface-variant mt-1">
                {!searchAllMonths
                  ? 'Prueba con otro término o activa "Buscar en todos los meses".'
                  : 'No hay coincidencias en ningún mes registrado.'}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    onClearDateFilter?.();
                  }}
                  className="px-3 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-on-surface transition-colors cursor-pointer"
                >
                  Limpiar filtros
                </button>
                {!searchAllMonths && (
                  <button
                    type="button"
                    onClick={() => setSearchAllMonths(true)}
                    className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-on-secondary-container text-xs font-semibold text-white transition-colors cursor-pointer"
                  >
                    Buscar en todos los meses
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-on-surface">Sin gastos registrados</h3>
              <p className="text-xs text-on-surface-variant mt-1">
                Usa el formulario superior para registrar tu primer movimiento o activa "Buscar en todos los meses".
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100/80">
          {displayedExpenses.map((expense) => {
            const isEditing = editingId === expense.id;

            if (isEditing) {
              return (
                <form
                  key={expense.id}
                  onSubmit={(e) => handleSaveEdit(e, expense.id)}
                  className="p-5 bg-surface-container-low/60 space-y-3.5 transition-all"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-mono font-bold text-secondary uppercase tracking-wider">
                      Modificando Movimiento en Ledger
                    </span>

                    <div className="flex items-center gap-1 bg-surface-container-lowest p-1 rounded-lg border border-slate-200 text-xs font-mono">
                      <button
                        type="button"
                        onClick={() => {
                          setEditCurrency('USD');
                          setEditRawAmount(
                            previewUsd > 0 ? previewUsd.toFixed(2) : String(expense.amount)
                          );
                        }}
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                          editCurrency === 'USD'
                            ? 'bg-secondary text-white'
                            : 'text-on-surface-variant hover:text-on-surface'
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
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                          editCurrency === 'EUR'
                            ? 'bg-secondary text-white'
                            : 'text-on-surface-variant hover:text-on-surface'
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
                        className={`px-2 py-0.5 rounded font-bold cursor-pointer ${
                          editCurrency === 'VES'
                            ? 'bg-secondary text-white'
                            : 'text-on-surface-variant hover:text-on-surface'
                        }`}
                      >
                        Bs. (BCV)
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3">
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                        Descripción
                      </label>
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                        Monto ({editCurrency === 'USD' ? '$' : editCurrency === 'EUR' ? '€' : 'Bs.'})
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editRawAmount}
                        onChange={(e) => setEditRawAmount(e.target.value)}
                        required
                        className="w-full px-3 py-1.5 bg-surface-container-lowest rounded-lg border border-slate-200 text-sm font-mono font-semibold focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                        Categoría
                      </label>
                      <select
                        value={editCategoryId}
                        onChange={(e) => {
                          setEditCategoryId(e.target.value);
                          setEditSubcategoryId('');
                        }}
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      >
                        {categories.map((cat) => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                        Subcategoría
                      </label>
                      <select
                        value={editSubcategoryId}
                        onChange={(e) => setEditSubcategoryId(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      >
                        <option value="">General</option>
                        {availableSubcategories.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-mono uppercase text-on-surface-variant mb-1">
                        Fecha
                      </label>
                      <input
                        type="date"
                        value={editDate}
                        onChange={(e) => handleDateChange(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 bg-surface-container-lowest rounded-lg border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-secondary/20"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-end justify-end gap-1.5">
                      <button
                        type="submit"
                        disabled={saving || loadingRate}
                        className="p-2 bg-secondary hover:bg-on-secondary-container disabled:opacity-50 text-white rounded-lg transition-colors cursor-pointer"
                        title="Guardar cambios"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelEditing}
                        className="p-2 bg-surface-container-lowest hover:bg-slate-100 text-on-surface-variant border border-slate-200 rounded-lg transition-colors cursor-pointer"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant bg-surface-container-lowest px-3.5 py-2 rounded-lg border border-slate-200/80">
                    <div className="flex flex-wrap items-center gap-3 font-mono">
                      <span className="inline-flex items-center gap-1 font-sans font-semibold text-secondary">
                        <ArrowLeftRight className="w-3.5 h-3.5" />
                        Nuevo valor:
                      </span>
                      <span>
                        USD: <strong className="text-on-surface">{formatCurrency(previewUsd)}</strong>
                      </span>
                      {activeEurRate > 0 && (
                        <span>
                          EUR: <strong className="text-on-surface">{formatEuros(previewEur)}</strong>
                        </span>
                      )}
                      <span>
                        Bs.: <strong className="text-on-surface">{formatBolivares(previewVes)}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-on-surface-variant">
                      <CalendarClock className="w-3.5 h-3.5 text-amber-600" />
                      <span>
                        BCV ({editDate}): $: Bs. {activeUsdRate.toFixed(4)}
                        {activeEurRate > 0 ? ` · €: Bs. ${activeEurRate.toFixed(4)}` : ''}
                      </span>
                    </div>
                  </div>

                  {error && (
                    <p className="text-xs text-error bg-error-container/40 px-3 py-1.5 rounded-lg">
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

            const usdTodayEquivalent =
              currentBcvRate > 0 && vesAmount > 0
                ? vesAmount / currentBcvRate
                : expense.amount;
            const itemExchangeDiffUsd = expense.amount - usdTodayEquivalent;
            const hasExchangeDiff = Math.abs(itemExchangeDiffUsd) >= 0.02;

            return (
              <div
                key={expense.id}
                className="px-6 py-4 flex flex-col sm:grid sm:grid-cols-12 items-start sm:items-center gap-2 sm:gap-3 hover:bg-surface-container-low/40 transition-colors group"
              >
                {/* Col 1-2: Fecha */}
                <div
                  className="sm:col-span-2 text-xs font-mono text-on-surface-variant shrink-0"
                  title={expense.expense_date}
                >
                  {formatShortDate(expense.expense_date)}
                </div>

                {/* Col 3-6: Concepto & Tasa BCV */}
                <div className="sm:col-span-4 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {expense.description}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {rateUsdUsed > 0 && (
                      <span className="text-[10px] font-mono text-on-surface-variant">
                        BCV $: Bs. {rateUsdUsed.toFixed(2)}
                        {rateEurUsed > 0 ? ` · €: Bs. ${rateEurUsed.toFixed(2)}` : ''}
                      </span>
                    )}
                    {hasExchangeDiff && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold ${
                          itemExchangeDiffUsd > 0
                            ? 'bg-secondary-container/40 text-on-secondary-container'
                            : 'bg-error-container/60 text-error'
                        }`}
                        title="Valor actual en USD de esos Bolívares a la tasa BCV de hoy"
                      >
                        Hoy: {formatCurrency(usdTodayEquivalent)} (
                        {itemExchangeDiffUsd > 0 ? '+' : ''}
                        {formatCurrency(itemExchangeDiffUsd)})
                      </span>
                    )}
                  </div>
                </div>

                {/* Col 7-9: Categoría y Subcategoría */}
                <div className="sm:col-span-3 flex items-center flex-wrap gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: `${expense.category_color}18`,
                      color: expense.category_color,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: expense.category_color }}
                    />
                    <span className="truncate max-w-28">{expense.category_name}</span>
                    {expense.subcategory_name && (
                      <>
                        <ChevronRight className="w-3 h-3 opacity-70 shrink-0" />
                        <span className="font-bold truncate max-w-24">
                          {expense.subcategory_name}
                        </span>
                      </>
                    )}
                  </span>
                </div>

                {/* Col 10-12: Monto Ledger + Acciones */}
                <div className="sm:col-span-3 w-full sm:w-auto flex items-center justify-between sm:justify-end gap-3 shrink-0">
                  <div className="text-left sm:text-right font-tabular">
                    <span className="block text-sm font-mono font-bold text-on-surface">
                      -{formatCurrency(expense.amount)}
                    </span>
                    <span className="block text-[11px] font-mono text-on-surface-variant">
                      {eurAmount > 0 ? `${formatEuros(eurAmount)} · ` : ''}
                      {vesAmount > 0 ? formatBolivares(vesAmount) : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 opacity-85 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => startEditing(expense)}
                      className="p-1.5 text-slate-400 hover:text-secondary hover:bg-secondary/10 rounded-lg transition-colors cursor-pointer"
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
                      className="p-1.5 text-slate-400 hover:text-error hover:bg-error-container/40 rounded-lg transition-colors cursor-pointer"
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
