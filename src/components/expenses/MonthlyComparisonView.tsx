import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Layers,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  CheckCircle2,
  History,
  AlertCircle,
  ShoppingBag,
  LineChart,
  MousePointerClick,
  ArrowLeftRight,
  Download,
  PieChart,
  Lightbulb,
  AlertTriangle,
  BadgeCheck,
  RefreshCw,
  BarChart2,
  Sparkles,
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
  const [rangeMonthsCount, setRangeMonthsCount] = useState<3 | 6 | 12>(6);
  const [showSecondaryCurrency, setShowSecondaryCurrency] = useState<boolean>(true);

  const previousMonth = useMemo(() => shiftMonth(selectedMonth, -1), [selectedMonth]);

  const toggleExpandCategory = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: prev[catId] === undefined ? false : !prev[catId],
    }));
  };

  // Mantener una ventana estable de N meses que no oculte el mes actual cuando haces clic en un mes anterior
  const chartEndMonth = useMemo(() => {
    const currentRealMonth = getCurrentYearMonth();
    let maxMonth = currentRealMonth > selectedMonth ? currentRealMonth : selectedMonth;
    for (const row of history) {
      if (row.month > maxMonth) {
        maxMonth = row.month;
      }
    }
    const oldestInDefaultWindow = shiftMonth(maxMonth, -(rangeMonthsCount - 1));
    if (selectedMonth < oldestInDefaultWindow) {
      return shiftMonth(selectedMonth, Math.floor(rangeMonthsCount / 3));
    }
    return maxMonth;
  }, [selectedMonth, history, rangeMonthsCount]);

  const displayedMonths = useMemo(() => {
    const list: string[] = [];
    for (let i = rangeMonthsCount - 1; i >= 0; i--) {
      list.push(shiftMonth(chartEndMonth, -i));
    }
    return list;
  }, [chartEndMonth, rangeMonthsCount]);

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

  const currentMonthData = totalsByMonth.get(selectedMonth);
  const prevMonthData = totalsByMonth.get(previousMonth);

  const currentMonthTotal = currentMonthData?.usd || 0;
  const currentMonthCount = currentMonthData?.count || 0;
  const prevMonthTotal = prevMonthData?.usd || 0;
  const prevMonthCount = prevMonthData?.count || 0;

  const totalDiffUsd = currentMonthTotal - prevMonthTotal;
  const totalDiffPercent =
    prevMonthTotal > 0
      ? ((currentMonthTotal - prevMonthTotal) / prevMonthTotal) * 100
      : currentMonthTotal > 0
        ? 100
        : null;

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

    for (const cat of categories) {
      const subMap = new Map<
        string,
        { name: string; currentUsd: number; previousUsd: number }
      >();
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

  const handleExpandAll = () => {
    const next: Record<string, boolean> = {};
    for (const cat of categoryComparison) {
      next[cat.id] = true;
    }
    setExpandedCategories(next);
  };

  const handleCollapseAll = () => {
    const next: Record<string, boolean> = {};
    for (const cat of categoryComparison) {
      next[cat.id] = false;
    }
    setExpandedCategories(next);
  };

  const currentEquivalentVes =
    currentMonthData && currentMonthData.ves > 0
      ? currentMonthData.ves
      : currentBcvRate > 0
        ? currentMonthTotal * currentBcvRate
        : 0;
  const currentEquivalentEur =
    currentMonthData && currentMonthData.eur > 0
      ? currentMonthData.eur
      : currentBcvEurRate > 0 && currentEquivalentVes > 0
        ? currentEquivalentVes / currentBcvEurRate
        : 0;

  const prevEquivalentVes =
    prevMonthData && prevMonthData.ves > 0
      ? prevMonthData.ves
      : currentBcvRate > 0
        ? prevMonthTotal * currentBcvRate
        : 0;
  const prevEquivalentEur =
    prevMonthData && prevMonthData.eur > 0
      ? prevMonthData.eur
      : currentBcvEurRate > 0 && prevEquivalentVes > 0
        ? prevEquivalentVes / currentBcvEurRate
        : 0;

  // Categoría con mayor peso en el mes seleccionado
  const activeCurrentCategories = useMemo(
    () =>
      [...categoryComparison]
        .filter((c) => c.currentUsd > 0)
        .sort((a, b) => b.currentUsd - a.currentUsd),
    [categoryComparison]
  );

  const topCategory = activeCurrentCategories.length > 0 ? activeCurrentCategories[0] : null;
  const topCategoryShare =
    topCategory && currentMonthTotal > 0
      ? (topCategory.currentUsd / currentMonthTotal) * 100
      : 0;

  const topSubcategoriesSummary = useMemo(() => {
    if (!topCategory || topCategory.subRows.length === 0) {
      return 'Sin subcategorías activas';
    }
    const activeSubs = topCategory.subRows.filter((s) => s.currentUsd > 0);
    if (activeSubs.length === 0) return 'Sin movimientos este mes';
    if (activeSubs.length === 1) return `${activeSubs[0].name} lidera`;
    const first = activeSubs[0].name.split(' ')[0];
    const second = activeSubs[1].name.split(' ')[0];
    return `${first} y ${second} lideran`;
  }, [topCategory]);

  const secondCategory =
    activeCurrentCategories.length > 1 ? activeCurrentCategories[1] : null;
  const secondTopSub =
    secondCategory && secondCategory.subRows.length > 0
      ? secondCategory.subRows[0]
      : null;

  const handleExportComparativeCsv = () => {
    if (categoryComparison.length === 0) return;
    const headers = [
      'Tipo',
      'Categoria',
      'Subcategoria',
      `USD_${previousMonth}`,
      `USD_${selectedMonth}`,
      `VES_${selectedMonth}`,
      'Diferencia_USD',
      'Variacion_Porcentual',
    ];
    const rows: string[][] = [];

    for (const cat of categoryComparison) {
      const catVes = currentBcvRate > 0 ? cat.currentUsd * currentBcvRate : 0;
      rows.push([
        'CATEGORIA',
        `"${cat.name.replace(/"/g, '""')}"`,
        '"Todas"',
        cat.previousUsd.toFixed(2),
        cat.currentUsd.toFixed(2),
        catVes.toFixed(2),
        cat.diffUsd.toFixed(2),
        cat.diffPercent !== null ? `${cat.diffPercent.toFixed(1)}%` : 'Nuevo',
      ]);

      for (const sub of cat.subRows) {
        const subVes = currentBcvRate > 0 ? sub.currentUsd * currentBcvRate : 0;
        rows.push([
          'SUBCATEGORIA',
          `"${cat.name.replace(/"/g, '""')}"`,
          `"${sub.name.replace(/"/g, '""')}"`,
          sub.previousUsd.toFixed(2),
          sub.currentUsd.toFixed(2),
          subVes.toFixed(2),
          sub.diffUsd.toFixed(2),
          sub.diffPercent !== null ? `${sub.diffPercent.toFixed(1)}%` : 'Nuevo',
        ]);
      }
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `g-budget-comparativa-${selectedMonth}-vs-${previousMonth}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col w-full gap-6 pb-8">
      {/* 1. View Header & Controls (Estilo Stitch Month-over-Month Comparative Analytics) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant">
              Analítica Financiera
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-outline-variant" />
            <span className="font-mono text-xs uppercase tracking-wider text-secondary font-semibold">
              Comparativa Mensual
            </span>
          </div>
          <h1 className="text-2xl sm:text-[2rem] font-semibold text-on-surface tracking-tight leading-tight">
            Comparativa Mensual de Gastos
          </h1>
          <p className="text-sm text-on-surface-variant mt-0.5">
            Auditoría comparativa, variaciones de flujo y descomposición por categoría
          </p>
        </div>

        {/* Selector de rango temporal, toggle de moneda secundaria y exportación */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <div className="flex items-center bg-surface-container p-1 rounded-lg shadow-2xs">
            {([
              { label: '3M', value: 3 },
              { label: '6M', value: 6 },
              { label: '1A', value: 12 },
            ] as const).map((opt) => {
              const active = rangeMonthsCount === opt.value;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setRangeMonthsCount(opt.value)}
                  className={`px-3 py-1 rounded-md font-mono text-xs transition-all cursor-pointer ${
                    active
                      ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-2xs'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowSecondaryCurrency((v) => !v)}
              title="Alternar visualización de moneda secundaria (Bs. / EUR)"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg shadow-2xs font-mono text-xs sm:text-sm font-medium transition-all cursor-pointer ${
                showSecondaryCurrency
                  ? 'bg-surface-container-lowest text-on-surface hover:bg-surface-container'
                  : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
              }`}
            >
              <ArrowLeftRight className="w-4 h-4 text-secondary" />
              <span>{showSecondaryCurrency ? 'Bs. Activo' : 'Bs. Oculto'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportComparativeCsv}
              disabled={categoryComparison.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-primary text-on-primary hover:bg-primary-container disabled:opacity-40 transition-all rounded-lg shadow-2xs font-mono text-xs sm:text-sm font-medium cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Exportar CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {/* Card 1: Mes Actual */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div className="absolute top-0 right-0 w-24 h-24 bg-secondary-fixed/30 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-semibold truncate">
                {formatMonthLabel(selectedMonth)} (Actual)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-[#00201d] font-mono text-[11px] font-semibold shrink-0">
                {currentMonthCount} movs.
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-[2rem] font-semibold text-on-surface tracking-tight font-tabular leading-tight">
                {formatCurrency(currentMonthTotal)}
              </span>
            </div>
            {showSecondaryCurrency && (
              <p className="font-mono text-xs text-on-surface-variant mt-1 font-tabular">
                {formatBolivares(currentEquivalentVes)}{' '}
                {currentBcvRate > 0 && (
                  <span className="font-sans text-[10px] text-outline opacity-80">
                    (Tasa {currentBcvRate.toFixed(2)})
                  </span>
                )}
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-secondary font-mono text-xs">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Mes activo seleccionado</span>
          </div>
        </div>

        {/* Card 2: Mes Anterior */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-semibold truncate">
                {formatMonthLabel(previousMonth)} (Mes Anterior)
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[11px] shrink-0">
                {prevMonthCount} movs.
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-mono text-2xl sm:text-[2rem] font-semibold text-on-surface-variant/85 tracking-tight font-tabular leading-tight">
                {formatCurrency(prevMonthTotal)}
              </span>
            </div>
            {showSecondaryCurrency && (
              <p className="font-mono text-xs text-on-surface-variant mt-1 font-tabular">
                {prevEquivalentEur > 0 ? `${formatEuros(prevEquivalentEur)} • ` : ''}
                {formatBolivares(prevEquivalentVes)}
              </p>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-on-surface-variant font-mono text-xs">
            <History className="w-4 h-4 text-outline shrink-0" />
            <span>Período base de referencia</span>
          </div>
        </div>

        {/* Card 3: Variación vs. Mes Anterior */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div
            className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none ${
              totalDiffUsd > 0.005
                ? 'bg-error-container/40'
                : totalDiffUsd < -0.005
                  ? 'bg-secondary-fixed/30'
                  : 'bg-surface-container-high/40'
            }`}
          />
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-semibold truncate">
                Variación vs. Mes Anterior
              </span>
              {totalDiffUsd > 0.005 ? (
                <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container font-mono text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <TrendingUp className="w-3.5 h-3.5" />
                  {totalDiffPercent !== null ? `+${totalDiffPercent.toFixed(0)}%` : 'Nuevo'}
                </span>
              ) : totalDiffUsd < -0.005 ? (
                <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <TrendingDown className="w-3.5 h-3.5" />
                  {totalDiffPercent !== null ? `${totalDiffPercent.toFixed(0)}%` : 'Bajó'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant font-mono text-[11px] font-bold flex items-center gap-1 shrink-0">
                  <Minus className="w-3.5 h-3.5" />
                  0%
                </span>
              )}
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`font-mono text-2xl sm:text-[2rem] font-semibold tracking-tight font-tabular leading-tight ${
                  totalDiffUsd > 0.005
                    ? 'text-on-error-container'
                    : totalDiffUsd < -0.005
                      ? 'text-secondary'
                      : 'text-on-surface'
                }`}
              >
                {totalDiffUsd > 0.005 ? '+' : ''}
                {formatCurrency(totalDiffUsd)}
              </span>
            </div>

            <p
              className={`text-xs mt-1 font-medium ${
                totalDiffUsd > 0.005
                  ? 'text-on-error-container'
                  : totalDiffUsd < -0.005
                    ? 'text-secondary'
                    : 'text-on-surface-variant'
              }`}
            >
              {totalDiffUsd > 0.005
                ? 'Tus gastos aumentaron respecto al mes pasado.'
                : totalDiffUsd < -0.005
                  ? '¡Bien! Gastaste menos que el mes pasado.'
                  : 'Mismo nivel de gasto que el mes anterior.'}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-on-surface-variant font-mono text-[11px]">
            <AlertCircle
              className={`w-4 h-4 shrink-0 ${
                totalDiffUsd > 0.005 ? 'text-error' : 'text-secondary'
              }`}
            />
            <span>
              {prevMonthTotal === 0 && currentMonthTotal > 0
                ? 'Impactado por apertura de ciclo'
                : totalDiffUsd < -0.005
                  ? 'Reducción neta de flujo mensual'
                  : 'Variación intermensual consolidada'}
            </span>
          </div>
        </div>

        {/* Card 4: Mayor Concentración */}
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-on-surface-variant font-semibold truncate">
                Mayor Concentración
              </span>
              <span className="px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[11px] font-bold shrink-0">
                {topCategoryShare.toFixed(1)}%
              </span>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-xl sm:text-2xl font-semibold text-on-surface tracking-tight truncate leading-tight">
                {topCategory ? topCategory.name : 'Sin gastos'}
              </span>
            </div>

            <p className="font-mono text-xs text-secondary font-medium mt-1 font-tabular">
              {topCategory ? (
                <>
                  {formatCurrency(topCategory.currentUsd)}{' '}
                  <span className="font-sans text-on-surface-variant font-normal">
                    en {topCategory.subRows.filter((s) => s.currentUsd > 0).length}{' '}
                    subcategorías
                  </span>
                </>
              ) : (
                <span className="font-sans text-on-surface-variant font-normal">
                  Sin movimientos en este período
                </span>
              )}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
            <span className="truncate">{topSubcategoriesSummary}</span>
            <ShoppingBag className="w-4 h-4 text-secondary shrink-0" />
          </div>
        </div>
      </div>

      {/* 3. Main Chart Section: Curva y Evolución Mensual */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-slate-100 p-4 sm:p-6 flex flex-col gap-5 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center text-on-surface shrink-0">
              <LineChart className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-on-surface tracking-tight leading-snug">
                Curva y Evolución Mensual (Últimos {rangeMonthsCount} Meses)
              </h2>
              <p className="text-xs text-on-surface-variant">
                Trayectoria histórica de desembolsos y evolución comparativa
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-on-surface-variant font-mono text-xs bg-surface-container-low px-3 py-1.5 rounded-lg self-start sm:self-auto">
            <MousePointerClick className="w-4 h-4 text-secondary shrink-0" />
            <span>Haz clic en cualquier mes para inspeccionarlo</span>
          </div>
        </div>

        {/* Gráfico de Área Suave con Gradiente Esmeralda Stitch */}
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={displayedMonths.map((m) => ({
                monthKey: m,
                label: `${formatMonthLabel(m).split(' ')[0].slice(0, 3)} ${m.slice(0, 4)}`,
                usd: Number((totalsByMonth.get(m)?.usd || 0).toFixed(2)),
              }))}
              margin={{ top: 14, right: 18, left: 0, bottom: 4 }}
              onClick={(state) => {
                if (state && state.activeTooltipIndex !== undefined) {
                  const idx = Number(state.activeTooltipIndex);
                  if (!isNaN(idx) && displayedMonths[idx]) {
                    onSelectMonth(displayedMonths[idx]);
                  }
                }
              }}
            >
              <defs>
                <linearGradient id="gBudgetChartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#006a61" stopOpacity={0.32} />
                  <stop offset="60%" stopColor="#6bd8cb" stopOpacity={0.1} />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#dce9ff"
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(val) => `$${val}`}
              />
              <Tooltip
                formatter={(value: unknown) => [
                  formatCurrency(Number(value) || 0),
                  'Total Ejecutado',
                ]}
                contentStyle={{
                  borderRadius: '12px',
                  border: '1px solid #c6c6cd',
                  fontFamily: 'JetBrains Mono',
                  fontSize: '12px',
                }}
              />
              <Area
                type="monotone"
                dataKey="usd"
                stroke="#006a61"
                strokeWidth={3}
                fillOpacity={1}
                fill="url(#gBudgetChartGrad)"
                dot={(props) => {
                  const { cx, cy, index } = props;
                  if (cx === undefined || cy === undefined) return <g key={index} />;
                  const mKey = displayedMonths[index];
                  const isActive = mKey === selectedMonth;
                  if (isActive) {
                    return (
                      <g key={mKey}>
                        <circle cx={cx} cy={cy} r={11} fill="#006a61" fillOpacity={0.2} />
                        <circle
                          cx={cx}
                          cy={cy}
                          r={6}
                          fill="#006a61"
                          stroke="#ffffff"
                          strokeWidth={2}
                        />
                      </g>
                    );
                  }
                  return (
                    <circle
                      key={mKey}
                      cx={cx}
                      cy={cy}
                      r={4}
                      fill="#ffffff"
                      stroke="#45464d"
                      strokeWidth={2}
                    />
                  );
                }}
                activeDot={{
                  r: 7,
                  fill: '#006a61',
                  stroke: '#ffffff',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tarjetas Interactivas de Selección de Mes (Estilo Stitch) */}
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 ${
            rangeMonthsCount === 3
              ? 'lg:grid-cols-3'
              : rangeMonthsCount === 12
                ? 'lg:grid-cols-6'
                : 'lg:grid-cols-6'
          } gap-3 pt-1`}
        >
          {displayedMonths.map((monthKey) => {
            const monthData = totalsByMonth.get(monthKey);
            const usd = monthData?.usd || 0;
            const count = monthData?.count || 0;
            const isSelected = monthKey === selectedMonth;
            const shortLabel = formatMonthLabel(monthKey).split(' ')[0].slice(0, 3);
            const yearLabel = monthKey.slice(0, 4);

            if (isSelected) {
              return (
                <button
                  key={monthKey}
                  type="button"
                  onClick={() => onSelectMonth(monthKey)}
                  className="flex flex-col items-center justify-between p-3 rounded-xl bg-surface-container-highest shadow-md text-center transform scale-[1.02] transition-all relative ring-2 ring-secondary cursor-pointer"
                >
                  <div className="absolute -top-2.5 px-2.5 py-0.5 bg-secondary text-on-secondary rounded-full font-mono text-[10px] font-bold">
                    Activo
                  </div>
                  <span className="font-mono text-sm text-secondary font-bold font-tabular mt-1">
                    {formatCurrency(usd)}
                  </span>
                  <div className="w-full h-12 my-2 bg-secondary rounded-lg flex items-center justify-center shadow-2xs text-on-secondary">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-on-surface font-bold capitalize">
                      {shortLabel} {yearLabel}
                    </span>
                    <span className="text-[11px] text-secondary font-semibold">
                      {count} mov.
                    </span>
                  </div>
                </button>
              );
            }

            return (
              <button
                key={monthKey}
                type="button"
                onClick={() => onSelectMonth(monthKey)}
                className="flex flex-col items-center justify-between p-3 rounded-xl bg-surface-container-low hover:bg-surface-container transition-all text-center group cursor-pointer"
              >
                <span
                  className={`font-mono text-sm font-tabular ${
                    usd > 0
                      ? 'text-on-surface font-semibold'
                      : 'text-on-surface-variant font-medium'
                  }`}
                >
                  {formatCurrency(usd)}
                </span>

                <div
                  className={`w-full h-12 my-2 rounded-lg flex items-center justify-center transition-all ${
                    usd > 0
                      ? 'bg-[#bec6e0]/40 group-hover:bg-[#bec6e0]/60'
                      : 'bg-surface-container opacity-40 group-hover:opacity-60'
                  }`}
                >
                  {usd > 0 ? (
                    <BarChart2 className="w-4 h-4 text-on-surface-variant" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-outline-variant" />
                  )}
                </div>

                <div className="flex flex-col">
                  <span className="text-sm text-on-surface font-semibold capitalize">
                    {shortLabel} {yearLabel}
                  </span>
                  <span className="text-[11px] text-on-surface-variant">
                    {count} mov.
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Detailed Category and Subcategory Breakdown Table (Accordion UI) */}
      <div className="bg-surface-container-lowest rounded-2xl shadow-xs border border-slate-100 overflow-hidden flex flex-col">
        {/* Table Header & Controls */}
        <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-lowest border-b border-slate-100">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-secondary shrink-0" />
              <h3 className="text-lg font-semibold text-on-surface">
                Desglose por Categoría y Subcategoría
              </h3>
            </div>
            <p className="text-xs text-on-surface-variant mt-0.5">
              {formatMonthLabel(selectedMonth)} vs. {formatMonthLabel(previousMonth)} • Haz clic en una categoría para desplegar o contraer sus subcategorías
            </p>
          </div>

          {categoryComparison.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-mono text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Desplegar Todo
              </button>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-3 py-1.5 rounded-lg bg-surface-container text-on-surface font-mono text-xs font-medium hover:bg-surface-container-high transition-colors cursor-pointer"
              >
                Contraer Todo
              </button>
            </div>
          )}
        </div>

        {categoryComparison.length === 0 ? (
          <div className="p-12 text-center text-sm text-on-surface-variant">
            No hay gastos registrados en {formatMonthLabel(selectedMonth)} ni en{' '}
            {formatMonthLabel(previousMonth)} para comparar.
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container-low text-on-surface-variant font-mono text-xs uppercase tracking-wider">
                  <th className="py-3.5 px-6 font-semibold min-w-[260px]">
                    Categoría / Subcategoría
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right min-w-[140px]">
                    {formatMonthLabel(previousMonth)}
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right min-w-[160px]">
                    {formatMonthLabel(selectedMonth)}
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-right min-w-[130px]">
                    Diferencia ($)
                  </th>
                  <th className="py-3.5 px-6 font-semibold text-center min-w-[140px]">
                    Comportamiento
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-surface-container-high text-on-surface text-sm">
                {categoryComparison.map((item) => {
                  const increased = item.diffUsd > 0.005;
                  const decreased = item.diffUsd < -0.005;
                  const currentVes =
                    currentBcvRate > 0 ? item.currentUsd * currentBcvRate : 0;

                  const isExpanded =
                    expandedCategories[item.id] === undefined
                      ? true
                      : expandedCategories[item.id];

                  return (
                    <React.Fragment key={item.id}>
                      {/* Fila Principal de la Categoría */}
                      <tr
                        onClick={() => toggleExpandCategory(item.id)}
                        className="cursor-pointer hover:bg-surface-container-low/70 transition-colors bg-surface-container-lowest"
                      >
                        <td className="py-3.5 px-6">
                          <div className="flex items-center gap-2.5">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-on-surface-variant shrink-0 transition-transform" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-on-surface-variant shrink-0 transition-transform" />
                            )}
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-base font-semibold text-on-surface">
                              {item.name}
                            </span>
                            {item.subRows.length > 0 && (
                              <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px]">
                                {item.subRows.length} sub.
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-sm text-on-surface-variant font-tabular">
                          {formatCurrency(item.previousUsd)}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex flex-col items-end font-tabular">
                            <span className="font-mono text-base font-bold text-on-surface">
                              {formatCurrency(item.currentUsd)}
                            </span>
                            {showSecondaryCurrency && currentVes > 0 && (
                              <span className="font-mono text-[11px] text-on-surface-variant">
                                {formatBolivares(currentVes)}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono text-sm font-bold font-tabular">
                          <span
                            className={
                              increased
                                ? 'text-error'
                                : decreased
                                  ? 'text-secondary'
                                  : 'text-outline'
                            }
                          >
                            {increased ? '+' : ''}
                            {formatCurrency(item.diffUsd)}
                          </span>
                        </td>

                        <td className="py-3.5 px-6 text-center">
                          {increased ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-error-container text-on-error-container font-mono text-[11px] font-semibold">
                              <TrendingUp className="w-3.5 h-3.5" />
                              {item.diffPercent !== null
                                ? `Subió ${item.diffPercent.toFixed(0)}%`
                                : 'Nuevo gasto'}
                            </span>
                          ) : decreased ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-container text-on-secondary-container font-mono text-[11px] font-semibold">
                              <TrendingDown className="w-3.5 h-3.5" />
                              {item.diffPercent !== null
                                ? `Bajó ${Math.abs(item.diffPercent).toFixed(0)}%`
                                : 'Bajó'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-container text-on-surface-variant font-mono text-[11px] font-semibold">
                              <Minus className="w-3.5 h-3.5" />
                              Igual
                            </span>
                          )}
                        </td>
                      </tr>

                      {/* Filas Hijas: Subcategorías */}
                      {isExpanded &&
                        item.subRows.map((sub) => {
                          const subInc = sub.diffUsd > 0.005;
                          const subDec = sub.diffUsd < -0.005;

                          return (
                            <tr
                              key={`${item.id}-${sub.subKey}`}
                              className="bg-surface-container-low/30 hover:bg-surface-container-low/60 transition-colors"
                            >
                              <td className="py-2.5 pl-14 pr-4">
                                <div className="flex items-center gap-2 text-on-surface-variant">
                                  <CornerDownRight className="w-3.5 h-3.5 text-outline shrink-0" />
                                  <span className="text-sm text-on-surface font-medium">
                                    {sub.name}
                                  </span>
                                </div>
                              </td>

                              <td className="py-2.5 px-4 text-right font-mono text-xs text-on-surface-variant font-tabular">
                                {formatCurrency(sub.previousUsd)}
                              </td>

                              <td className="py-2.5 px-4 text-right font-mono text-xs text-on-surface font-semibold font-tabular">
                                {formatCurrency(sub.currentUsd)}
                              </td>

                              <td className="py-2.5 px-4 text-right font-mono text-xs font-tabular">
                                <span
                                  className={
                                    subInc
                                      ? 'text-error'
                                      : subDec
                                        ? 'text-secondary'
                                        : 'text-outline'
                                  }
                                >
                                  {subInc ? '+' : ''}
                                  {formatCurrency(sub.diffUsd)}
                                </span>
                              </td>

                              <td className="py-2.5 px-6 text-center">
                                {subInc ? (
                                  <span className="inline-flex items-center gap-1 text-on-surface-variant font-mono text-[11px]">
                                    <TrendingUp className="w-3 h-3 text-error" />
                                    {sub.diffPercent !== null
                                      ? `+${sub.diffPercent.toFixed(0)}%`
                                      : 'Nuevo'}
                                  </span>
                                ) : subDec ? (
                                  <span className="inline-flex items-center gap-1 text-on-surface-variant font-mono text-[11px]">
                                    <TrendingDown className="w-3 h-3 text-secondary" />
                                    {sub.diffPercent !== null
                                      ? `-${Math.abs(sub.diffPercent).toFixed(0)}%`
                                      : 'Bajó'}
                                  </span>
                                ) : (
                                  <span className="font-mono text-[11px] text-outline">
                                    Igual
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })}
              </tbody>

              {/* Table Total Footer */}
              <tfoot>
                <tr className="bg-surface-container-high/60 font-semibold text-on-surface">
                  <td className="py-4 px-6 text-base font-semibold">
                    Total Acumulado del Período
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-base text-on-surface-variant font-tabular">
                    {formatCurrency(prevMonthTotal)}
                  </td>
                  <td className="py-4 px-4 text-right">
                    <div className="flex flex-col items-end font-tabular">
                      <span className="font-mono text-base text-on-surface font-bold">
                        {formatCurrency(currentMonthTotal)}
                      </span>
                      {showSecondaryCurrency && currentEquivalentVes > 0 && (
                        <span className="font-mono text-xs text-secondary font-medium">
                          {formatBolivares(currentEquivalentVes)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-right font-mono text-base font-bold font-tabular">
                    <span
                      className={
                        totalDiffUsd > 0.005
                          ? 'text-error'
                          : totalDiffUsd < -0.005
                            ? 'text-secondary'
                            : 'text-on-surface'
                      }
                    >
                      {totalDiffUsd > 0.005 ? '+' : ''}
                      {formatCurrency(totalDiffUsd)}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <span className="px-3 py-1 rounded-full bg-primary text-on-primary font-mono text-xs font-semibold">
                      {selectedMonth < getCurrentYearMonth() ? 'Cerrado' : 'En Curso'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* 5. Smart Comparison Insights Panel (3 Columnas Inferiores estilo Stitch) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Distribución por Cesta */}
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-base font-semibold text-on-surface">
                Distribución por Cesta
              </span>
              <PieChart className="w-5 h-5 text-secondary" />
            </div>
            <p className="text-xs text-on-surface-variant mb-4">
              Proporción de gasto en {formatMonthLabel(selectedMonth)} respecto al total ejecutado.
            </p>

            {/* Barra apilada horizontal por categoría */}
            <div className="w-full h-3 rounded-full bg-surface-container overflow-hidden flex mb-4">
              {activeCurrentCategories.length === 0 ? (
                <div className="h-full w-full bg-surface-container-high" />
              ) : (
                activeCurrentCategories.map((cat) => {
                  const pct =
                    currentMonthTotal > 0
                      ? (cat.currentUsd / currentMonthTotal) * 100
                      : 0;
                  return (
                    <div
                      key={cat.id}
                      className="h-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat.color,
                      }}
                      title={`${cat.name}: ${pct.toFixed(1)}%`}
                    />
                  );
                })
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              {activeCurrentCategories.slice(0, 4).map((cat) => {
                const pct =
                  currentMonthTotal > 0
                    ? (cat.currentUsd / currentMonthTotal) * 100
                    : 0;
                return (
                  <div key={cat.id} className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-on-surface font-medium truncate">
                      {cat.name} ({pct.toFixed(1)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-3 border-t border-slate-100 flex items-center justify-between text-on-surface-variant font-mono text-[11px]">
            <span>{activeCurrentCategories.length} categorías activas</span>
            <span className="text-secondary font-medium">
              {topCategoryShare >= 45 ? 'Gasto Concentrado' : 'Gasto Diversificado'}
            </span>
          </div>
        </div>

        {/* Card 2: Observaciones de Flujo */}
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-semibold text-on-surface">
                Observaciones de Flujo
              </span>
              <Lightbulb className="w-5 h-5 text-amber-500" />
            </div>

            <div className="flex flex-col gap-3">
              <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-on-surface font-semibold">
                    {topCategory ? `${topCategory.name} como flujo principal` : 'Sin actividad registrada'}
                  </span>
                  <span className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {topCategory
                      ? `El gasto en ${topCategory.name} (${formatCurrency(topCategory.currentUsd)}) representa el ${topCategoryShare.toFixed(1)}% del presupuesto ejecutado este mes.`
                      : 'Registra movimientos en este período para obtener observaciones automáticas de flujo.'}
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-surface-container-low flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-on-surface font-semibold">
                    {secondCategory ? secondCategory.name : 'Seguimiento Intermensual'}
                  </span>
                  <span className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">
                    {secondCategory && secondTopSub && secondCategory.currentUsd > 0
                      ? `${secondTopSub.name} (${formatCurrency(secondTopSub.currentUsd)}) representó el ${((secondTopSub.currentUsd / secondCategory.currentUsd) * 100).toFixed(0)}% del renglón de ${secondCategory.name}.`
                      : `La variación neta frente a ${formatMonthLabel(previousMonth)} es de ${totalDiffUsd > 0 ? '+' : ''}${formatCurrency(totalDiffUsd)}.`}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-on-surface-variant font-mono text-[11px]">
            <BadgeCheck className="w-4 h-4 text-secondary shrink-0" />
            <span>Recomendación generada por motor G-Budget</span>
          </div>
        </div>

        {/* Card 3: Referencia Cambiaria */}
        <div className="bg-surface-container-lowest p-6 rounded-xl shadow-xs border border-slate-100 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -bottom-8 -right-8 w-28 h-28 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-semibold text-on-surface">
                Referencia Cambiaria
              </span>
              <span className="px-2 py-0.5 bg-[#fef3c7] text-[#b45309] font-mono text-[10px] font-bold rounded">
                BCV Oficial
              </span>
            </div>

            <div className="flex flex-col gap-2 font-tabular">
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-on-surface-variant">
                  Tasa de Conversión:
                </span>
                <span className="font-mono text-sm font-bold text-on-surface">
                  {currentBcvRate > 0 ? `${currentBcvRate.toFixed(2)} Bs. / USD` : '...'}
                </span>
              </div>

              {currentBcvEurRate > 0 && (
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-on-surface-variant">
                    Referencia Euro BCV:
                  </span>
                  <span className="font-mono text-xs font-semibold text-on-surface">
                    {currentBcvEurRate.toFixed(2)} Bs. / EUR
                  </span>
                </div>
              )}

              <div className="flex items-baseline justify-between">
                <span className="text-xs text-on-surface-variant">
                  Total convertido:
                </span>
                <span className="font-mono text-base font-bold text-secondary">
                  {formatBolivares(currentEquivalentVes)}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <span className="text-xs text-on-surface-variant">
                  Período de consolidación:
                </span>
                <span className="font-mono text-xs text-on-surface capitalize">
                  {formatMonthLabel(selectedMonth)}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-surface-container-low rounded-lg text-on-surface-variant text-[11px] leading-relaxed">
              Los montos son calculados dinámicamente según la cotización oficial de cierre para registrar paridad histórica exacta.
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="font-mono text-[11px] text-on-surface-variant">
              Actualización automática
            </span>
            <RefreshCw className="w-4 h-4 text-secondary" />
          </div>
        </div>
      </div>
    </div>
  );
};
