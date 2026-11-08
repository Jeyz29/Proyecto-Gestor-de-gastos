import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Layers,
  CalendarRange,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import type { Category, Subcategory, MonthlyCategoryHistory } from '../../types/index.ts';
import {
  formatCurrency,
  formatEuros,
  formatBolivares,
  formatMonthLabel,
  getCurrentYearMonth,
  shiftMonth,
} from '../../utils/formatters.ts';

interface MonthlyComparisonViewProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  categories: Category[];
  subcategories: Subcategory[];
  history: MonthlyCategoryHistory[];
  currentBcvRate: number;
  currentBcvEurRate: number;
}

interface SubcategoryComparisonRow {
  subKey: string;
  name: string;
  currentUsd: number;
  previousUsd: number;
  diffUsd: number;
  diffPercent: number | null;
}

interface CategoryComparisonRow {
  id: string;
  name: string;
  color: string;
  currentUsd: number;
  previousUsd: number;
  diffUsd: number;
  diffPercent: number | null;
  subRows: SubcategoryComparisonRow[];
}

export const MonthlyComparisonView: React.FC<MonthlyComparisonViewProps> = ({
  selectedMonth,
  onSelectMonth,
  categories,
  subcategories,
  history,
  currentBcvRate,
  currentBcvEurRate,
}) => {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const previousMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const toggleExpandCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: prev[catId] === undefined ? false : !prev[catId],
    }));
  };

  // Mantener una ventana estable de 6 meses que no oculte el mes actual cuando haces clic en un mes anterior
  const chartEndMonth = useMemo(() => {
    const currentRealMonth = getCurrentYearMonth();
    let maxMonth = currentRealMonth > selectedMonth ? currentRealMonth : selectedMonth;
    for (const row of history) {
      if (row.month > maxMonth) {
        maxMonth = row.month;
      }
    }
    // Si el usuario navegó más de 5 meses hacia atrás con las flechas superiores,
    // ajustamos la ventana para que el mes seleccionado siga visible pero dejando meses posteriores a la derecha
    const oldestInDefaultWindow = shiftMonth(maxMonth, -5);
    if (selectedMonth < oldestInDefaultWindow) {
      return shiftMonth(selectedMonth, 2);
    }
    return maxMonth;
  }, [selectedMonth, history]);

  const lastSixMonths = useMemo(() => {
    const list: string[] = [];
    for (let i = 5; i >= 0; i--) {
      list.push(shiftMonth(chartEndMonth, -i));
    }
    return list;
  }, [chartEndMonth]);

  // Totales agrupados por mes
  const totalsByMonth = useMemo(() => {
    const map = new Map<
      string,
      { usd: number; eur: number; ves: number; count: number }
    >();

    for (const row of history) {
      const current = map.get(row.month) || { usd: 0, eur: 0, ves: 0, count: 0 };
      const ves =
        row.total_ves > 0
          ? row.total_ves
          : currentBcvRate > 0
          ? row.total_usd * currentBcvRate
          : 0;
      const eur =
        row.total_eur > 0
          ? row.total_eur
          : currentBcvEurRate > 0 && ves > 0
          ? ves / currentBcvEurRate
          : 0;

      current.usd += row.total_usd;
      current.eur += eur;
      current.ves += ves;
      current.count += row.expense_count;
      map.set(row.month, current);
    }
    return map;
  }, [history, currentBcvRate, currentBcvEurRate]);

  const currentMonthTotal = totalsByMonth.get(selectedMonth)?.usd || 0;
  const prevMonthTotal = totalsByMonth.get(previousMonth)?.usd || 0;
  const totalDiffUsd = currentMonthTotal - prevMonthTotal;
  const totalDiffPercent =
    prevMonthTotal > 0 ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100 : null;

  // Máximo entre los 6 meses para escalar las barras de evolución
  const maxSixMonthUsd = useMemo(() => {
    let max = 0;
    for (const m of lastSixMonths) {
      const val = totalsByMonth.get(m)?.usd || 0;
      if (val > max) max = val;
    }
    return max;
  }, [lastSixMonths, totalsByMonth]);

  // Desglose comparativo por Categoría y Subcategoría (Mes Actual vs Mes Anterior)
  const categoryComparison = useMemo<CategoryComparisonRow[]>(() => {
    const catMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        currentUsd: number;
        previousUsd: number;
        subMap: Map<string, { name: string; currentUsd: number; previousUsd: number }>;
      }
    >();

    // Inicializar categorías conocidas
    for (const cat of categories) {
      const subMap = new Map<
        string,
        { name: string; currentUsd: number; previousUsd: number }
      >();
      // Pre-cargar las subcategorías definidas para esta categoría
      for (const sub of subcategories.filter((s) => s.category_id === cat.id)) {
        subMap.set(sub.id, { name: sub.name, currentUsd: 0, previousUsd: 0 });
      }
      catMap.set(cat.id, {
        id: cat.id,
        name: cat.name,
        color: cat.color,
        currentUsd: 0,
        previousUsd: 0,
        subMap,
      });
    }

    for (const row of history) {
      if (row.month !== selectedMonth && row.month !== previousMonth) continue;

      let entry = catMap.get(row.category_id);
      if (!entry) {
        entry = {
          id: row.category_id,
          name: row.category_name,
          color: row.category_color,
          currentUsd: 0,
          previousUsd: 0,
          subMap: new Map(),
        };
        catMap.set(row.category_id, entry);
      }

      const subKey = row.subcategory_id || '__general__';
      const subName = row.subcategory_name || 'General / Sin especificar';
      const subEntry = entry.subMap.get(subKey) || {
        name: subName,
        currentUsd: 0,
        previousUsd: 0,
      };

      if (row.month === selectedMonth) {
        entry.currentUsd += row.total_usd;
        subEntry.currentUsd += row.total_usd;
      } else if (row.month === previousMonth) {
        entry.previousUsd += row.total_usd;
        subEntry.previousUsd += row.total_usd;
      }

      entry.subMap.set(subKey, subEntry);
    }

    const result: CategoryComparisonRow[] = [];

    for (const item of catMap.values()) {
      if (item.currentUsd === 0 && item.previousUsd === 0) continue;

      const diffUsd = item.currentUsd - item.previousUsd;
      const diffPercent =
        item.previousUsd > 0
          ? ((item.currentUsd - item.previousUsd) / item.previousUsd) * 100
          : null;

      const subRows: SubcategoryComparisonRow[] = Array.from(item.subMap.entries())
        .map(([subKey, subData]) => {
          const sDiff = subData.currentUsd - subData.previousUsd;
          const sPercent =
            subData.previousUsd > 0
              ? ((subData.currentUsd - subData.previousUsd) / subData.previousUsd) * 100
              : null;
          return {
            subKey,
            name: subData.name,
            currentUsd: subData.currentUsd,
            previousUsd: subData.previousUsd,
            diffUsd: sDiff,
            diffPercent: sPercent,
          };
        })
        .filter((s) => s.currentUsd > 0 || s.previousUsd > 0)
        .sort(
          (a, b) =>
            Math.max(b.currentUsd, b.previousUsd) - Math.max(a.currentUsd, a.previousUsd)
        );

      result.push({
        id: item.id,
        name: item.name,
        color: item.color,
        currentUsd: item.currentUsd,
        previousUsd: item.previousUsd,
        diffUsd,
        diffPercent,
        subRows,
      });
    }

    return result.sort(
      (a, b) =>
        Math.max(b.currentUsd, b.previousUsd) - Math.max(a.currentUsd, a.previousUsd)
    );
  }, [categories, subcategories, history, selectedMonth, previousMonth]);

  const currentEquivalentVes =
    currentBcvRate > 0
      ? currentMonthTotal * currentBcvRate
      : totalsByMonth.get(selectedMonth)?.ves || 0;
  const currentEquivalentEur =
    currentBcvEurRate > 0 && currentEquivalentVes > 0
      ? currentEquivalentVes / currentBcvEurRate
      : totalsByMonth.get(selectedMonth)?.eur || 0;

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas Superiores de Comparación General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Mes Seleccionado */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {formatMonthLabel(selectedMonth)} (Actual)
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">
            {formatCurrency(currentMonthTotal)}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {currentEquivalentEur > 0 ? `${formatEuros(currentEquivalentEur)} · ` : ''}
            {formatBolivares(currentEquivalentVes)}
          </div>
        </div>

        {/* Mes Anterior */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            {formatMonthLabel(previousMonth)} (Mes Anterior)
          </span>
          <div className="text-2xl font-bold text-slate-700 mt-1">
            {formatCurrency(prevMonthTotal)}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {currentBcvEurRate > 0 && currentBcvRate > 0
              ? `${formatEuros((prevMonthTotal * currentBcvRate) / currentBcvEurRate)} · `
              : ''}
            {currentBcvRate > 0 ? formatBolivares(prevMonthTotal * currentBcvRate) : ''}
          </div>
        </div>

        {/* Variación / Diferencia */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Variación vs. Mes Anterior
          </span>

          <div className="mt-1 flex items-center gap-2">
            {totalDiffUsd > 0.005 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700">
                <TrendingUp className="w-3.5 h-3.5" />+
                {formatCurrency(totalDiffUsd)}
                {totalDiffPercent !== null ? ` (+${totalDiffPercent.toFixed(1)}%)` : ''}
              </span>
            ) : totalDiffUsd < -0.005 ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                <TrendingDown className="w-3.5 h-3.5" />
                {formatCurrency(totalDiffUsd)}
                {totalDiffPercent !== null ? ` (${totalDiffPercent.toFixed(1)}%)` : ''}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                <Minus className="w-3.5 h-3.5" />
                Sin variación ($0.00)
              </span>
            )}
          </div>

          <p className="text-xs text-slate-500 mt-2">
            {totalDiffUsd > 0.005
              ? 'Tus gastos aumentaron respecto al mes pasado.'
              : totalDiffUsd < -0.005
              ? '¡Bien! Gastaste menos que el mes pasado.'
              : 'Mismo nivel de gasto que el mes anterior.'}
          </p>
        </div>
      </div>

      {/* 2. Evolución de los Últimos 6 Meses */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Curva y Evolución Mensual (Últimos 6 Meses)
            </h2>
          </div>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CalendarRange className="w-3.5 h-3.5" />
            Haz clic en cualquier mes para inspeccionarlo
          </span>
        </div>

        {/* Gráfico de Área Interactivo (Tendencia de 6 meses) */}
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={lastSixMonths.map((m) => ({
                monthKey: m,
                label: `${formatMonthLabel(m).split(' ')[0].slice(0, 3)} ${m.slice(2, 4)}`,
                usd: Number((totalsByMonth.get(m)?.usd || 0).toFixed(2)),
              }))}
              margin={{ top: 10, right: 15, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorUsdTrend" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.28} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                formatter={(value: unknown) => [
                  formatCurrency(Number(value) || 0),
                  'Total Gastado',
                ]}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="usd"
                stroke="#4f46e5"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorUsdTrend)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end pt-2">
          {lastSixMonths.map((monthKey) => {
            const monthData = totalsByMonth.get(monthKey);
            const usd = monthData?.usd || 0;
            const heightPercent = maxSixMonthUsd > 0 ? (usd / maxSixMonthUsd) * 100 : 0;
            const isSelected = monthKey === selectedMonth;
            const shortLabel = formatMonthLabel(monthKey).split(' ')[0].slice(0, 3);
            const yearLabel = monthKey.slice(0, 4);

            return (
              <button
                key={monthKey}
                onClick={() => onSelectMonth(monthKey)}
                className={`flex flex-col items-center p-3 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-300'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700 mb-2">
                  {formatCurrency(usd)}
                </span>

                {/* Contenedor de barra vertical */}
                <div className="w-full h-28 bg-slate-100 rounded-lg flex items-end p-1 overflow-hidden">
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${
                      isSelected ? 'bg-indigo-600' : 'bg-indigo-400/70'
                    }`}
                    style={{
                      height: usd > 0 ? `${Math.max(heightPercent, 8)}%` : '0%',
                    }}
                  />
                </div>

                <span className="text-xs font-medium text-slate-700 mt-2 capitalize">
                  {shortLabel} {yearLabel}
                </span>
                <span className="text-[11px] text-slate-400">
                  {monthData?.count || 0} mov.
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Desglose Comparativo por Categoría y Subcategorías (Mes Actual vs Mes Anterior) */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-semibold text-slate-800">
              Desglose por Categoría y Subcategoría: {formatMonthLabel(selectedMonth)} vs.{' '}
              {formatMonthLabel(previousMonth)}
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            Haz clic en una categoría para desplegar o contraer sus subcategorías
          </span>
        </div>

        {categoryComparison.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            No hay gastos registrados en {formatMonthLabel(selectedMonth)} ni en{' '}
            {formatMonthLabel(previousMonth)} para comparar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-50/60">
                  <th className="py-3 px-6">Categoría / Subcategoría</th>
                  <th className="py-3 px-4 text-right">
                    {formatMonthLabel(previousMonth)}
                  </th>
                  <th className="py-3 px-4 text-right">
                    {formatMonthLabel(selectedMonth)}
                  </th>
                  <th className="py-3 px-4 text-right">Diferencia ($)</th>
                  <th className="py-3 px-6 text-right">Comportamiento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {categoryComparison.map((item) => {
                  const increased = item.diffUsd > 0.005;
                  const decreased = item.diffUsd < -0.005;
                  const currentVes =
                    currentBcvRate > 0 ? item.currentUsd * currentBcvRate : 0;

                  // Por defecto mostramos expandidas las categorías que tienen subcategorías
                  const isExpanded =
                    expandedCategories[item.id] === undefined
                      ? true
                      : expandedCategories[item.id];

                  return (
                    <React.Fragment key={item.id}>
                      {/* Fila Principal de la Categoría */}
                      <tr
                        onClick={() => toggleExpandCategory(item.id)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer bg-white"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-slate-800">
                              {item.name}
                            </span>
                            {item.subRows.length > 0 && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                {item.subRows.length} sub.
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-medium text-slate-600">
                          {formatCurrency(item.previousUsd)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <span className="font-bold text-slate-900 block">
                            {formatCurrency(item.currentUsd)}
                          </span>
                          {currentVes > 0 && (
                            <span className="text-[11px] text-slate-400 block">
                              {formatBolivares(currentVes)}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right font-semibold">
                          <span
                            className={
                              increased
                                ? 'text-red-600'
                                : decreased
                                ? 'text-emerald-600'
                                : 'text-slate-400'
                            }
                          >
                            {increased ? '+' : ''}
                            {formatCurrency(item.diffUsd)}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 text-right">
                          {increased ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {item.diffPercent !== null
                                ? `Subió ${item.diffPercent.toFixed(0)}%`
                                : 'Nuevo gasto'}
                            </span>
                          ) : decreased ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                              <TrendingDown className="w-3.5 h-3.5" />
                              {item.diffPercent !== null
                                ? `Bajó ${Math.abs(item.diffPercent).toFixed(0)}%`
                                : 'Bajó'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                              <Minus className="w-3.5 h-3.5" />
                              Igual
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Filas Hijas: Subcategorías (Proteína, Verduras, Frutas...) */}
                      {isExpanded &&
                        item.subRows.map((sub) => {
                          const subInc = sub.diffUsd > 0.005;
                          const subDec = sub.diffUsd < -0.005;

                          return (
                            <tr
                              key={`${item.id}-${sub.subKey}`}
                              className="bg-slate-50/50 text-xs hover:bg-slate-100/60 transition-colors"
                            >
                              <td className="py-2.5 pl-14 pr-6">
                                <div className="flex items-center gap-2 text-slate-600">
                                  <CornerDownRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span className="font-medium">{sub.name}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-right text-slate-500">
                                {formatCurrency(sub.previousUsd)}
                              </td>

                              <td className="py-2.5 px-4 text-right font-semibold text-slate-700">
                                {formatCurrency(sub.currentUsd)}
                              </td>

                              <td className="py-2.5 px-4 text-right font-medium">
                                <span
                                  className={
                                    subInc
                                      ? 'text-red-600'
                                      : subDec
                                      ? 'text-emerald-600'
                                      : 'text-slate-400'
                                  }
                                >
                                  {subInc ? '+' : ''}
                                  {formatCurrency(sub.diffUsd)}
                                </span>
                              </td>

                              <td className="py-2.5 px-6 text-right">
                                {subInc ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50/80 text-red-700">
                                    <TrendingUp className="w-3 h-3" />
                                    {sub.diffPercent !== null
                                      ? `+${sub.diffPercent.toFixed(0)}%`
                                      : 'Nuevo'}
                                  </span>
                                ) : subDec ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50/80 text-emerald-700">
                                    <TrendingDown className="w-3 h-3" />
                                    {sub.diffPercent !== null
                                      ? `-${Math.abs(sub.diffPercent).toFixed(0)}%`
                                      : 'Bajó'}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-400">Igual</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
