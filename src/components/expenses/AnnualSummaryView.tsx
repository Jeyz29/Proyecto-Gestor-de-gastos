import React, { useMemo, useState } from 'react';
import {
  Calendar,
  TrendingUp,
  TrendingDown,
  Award,
  Flame,
  Scale,
  ChevronLeft,
  ChevronRight,
  PieChart as PieChartIcon,
  BarChart3,
  CornerDownRight,
  CheckCircle2,
  Circle,
  Wallet,
  ArrowDown,
  Layers,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import type {
  Category,
  Subcategory,
  MonthlyCategoryHistory,
  Subscription,
} from '../../types/index.ts';
import {
  formatCurrency,
  formatEuros,
  formatBolivares,
} from '../../utils/formatters.ts';

interface AnnualSummaryViewProps {
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onSelectMonthAndGoToMonthly: (yearMonth: string) => void;
  categories: Category[];
  subcategories: Subcategory[];
  history: MonthlyCategoryHistory[];
  subscriptions: Subscription[];
  currentBcvRate: number;
  currentBcvEurRate: number;
}

const MONTH_NAMES_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const MONTH_NAMES_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export const AnnualSummaryView: React.FC<AnnualSummaryViewProps> = ({
  selectedYear,
  onSelectYear,
  onSelectMonthAndGoToMonthly,
  history,
  subscriptions,
  currentBcvRate,
  currentBcvEurRate,
}) => {
  const [includeSubscriptions, setIncludeSubscriptions] = useState<boolean>(true);

  const yearPrefix = `${selectedYear}-`;

  // Filtrar historial del año seleccionado
  const yearHistory = useMemo(
    () => history.filter((row) => row.month.startsWith(yearPrefix)),
    [history, yearPrefix]
  );

  // Impacto anual de las suscripciones
  const subscriptionsAnnualData = useMemo(() => {
    let monthlySubsTotalPerMonth = 0;
    let annualSubsTotal = 0;

    for (const sub of subscriptions) {
      if (sub.billing_cycle === 'monthly') {
        if (sub.include_in_monthly === 1) {
          monthlySubsTotalPerMonth += sub.amount;
        } else {
          annualSubsTotal += sub.amount * 12;
        }
      } else {
        if (sub.include_in_monthly === 1) {
          monthlySubsTotalPerMonth += sub.amount / 12;
        } else {
          annualSubsTotal += sub.amount;
        }
      }
    }

    return {
      monthlySubsTotalPerMonth,
      annualSubsTotal,
      totalAnnualSubs: monthlySubsTotalPerMonth * 12 + annualSubsTotal,
    };
  }, [subscriptions]);

  // Datos de los 12 meses del año (Ene - Dic)
  const monthlyChartData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, idx) => {
      const mNum = String(idx + 1).padStart(2, '0');
      const monthKey = `${selectedYear}-${mNum}`;
      return {
        monthIndex: idx,
        monthKey,
        name: MONTH_NAMES_SHORT[idx],
        fullName: MONTH_NAMES_FULL[idx],
        punctualUsd: 0,
        subscriptionsUsd: 0,
        totalUsd: 0,
        historicalVes: 0,
        count: 0,
      };
    });

    for (const row of yearHistory) {
      const mIdx = parseInt(row.month.slice(5, 7), 10) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        months[mIdx].punctualUsd += row.total_usd;
        months[mIdx].historicalVes += row.total_ves;
        months[mIdx].count += row.expense_count;
      }
    }

    for (const m of months) {
      const subsToAdd =
        includeSubscriptions && m.punctualUsd > 0
          ? subscriptionsAnnualData.monthlySubsTotalPerMonth
          : 0;
      m.subscriptionsUsd = Number(subsToAdd.toFixed(2));
      m.totalUsd = Number((m.punctualUsd + subsToAdd).toFixed(2));
    }

    return months;
  }, [yearHistory, selectedYear, includeSubscriptions, subscriptionsAnnualData]);

  // Totales y KPIs del año
  const annualKpis = useMemo(() => {
    const totalPunctualUsd = monthlyChartData.reduce((s, m) => s + m.punctualUsd, 0);
    const totalHistoricalVes = monthlyChartData.reduce(
      (s, m) => s + m.historicalVes,
      0
    );
    const totalTransactions = monthlyChartData.reduce((s, m) => s + m.count, 0);

    const activeMonths = monthlyChartData.filter((m) => m.totalUsd > 0);
    const activeMonthsCount = activeMonths.length;

    const totalWithSubsUsd =
      totalPunctualUsd +
      (includeSubscriptions
        ? activeMonthsCount * subscriptionsAnnualData.monthlySubsTotalPerMonth +
          subscriptionsAnnualData.annualSubsTotal
        : 0);

    const averageMonthlyUsd =
      activeMonthsCount > 0 ? totalWithSubsUsd / activeMonthsCount : 0;

    let highestMonth: (typeof monthlyChartData)[0] | null = null;
    let lowestMonth: (typeof monthlyChartData)[0] | null = null;

    for (const m of activeMonths) {
      if (!highestMonth || m.totalUsd > highestMonth.totalUsd) {
        highestMonth = m;
      }
      if (!lowestMonth || m.totalUsd < lowestMonth.totalUsd) {
        lowestMonth = m;
      }
    }

    const usdEquivalentAtTodayRate =
      currentBcvRate > 0 && totalHistoricalVes > 0
        ? totalHistoricalVes / currentBcvRate
        : totalPunctualUsd;

    const exchangeDiffUsd = totalPunctualUsd - usdEquivalentAtTodayRate;
    const vesAtTodayRateForSameUsd =
      currentBcvRate > 0 ? totalPunctualUsd * currentBcvRate : totalHistoricalVes;
    const exchangeDiffVes = vesAtTodayRateForSameUsd - totalHistoricalVes;
    const exchangeDiffPercent =
      totalPunctualUsd > 0 ? (exchangeDiffUsd / totalPunctualUsd) * 100 : 0;

    const avgHistoricalRate =
      totalPunctualUsd > 0 && totalHistoricalVes > 0
        ? totalHistoricalVes / totalPunctualUsd
        : currentBcvRate;

    const activeMonthNames = activeMonths.map((m) => m.fullName);

    return {
      totalPunctualUsd,
      totalWithSubsUsd,
      totalHistoricalVes,
      totalTransactions,
      activeMonthsCount,
      activeMonthNames,
      averageMonthlyUsd,
      highestMonth,
      lowestMonth,
      usdEquivalentAtTodayRate,
      exchangeDiffUsd,
      exchangeDiffVes,
      exchangeDiffPercent,
      avgHistoricalRate,
    };
  }, [
    monthlyChartData,
    includeSubscriptions,
    subscriptionsAnnualData,
    currentBcvRate,
  ]);

  // Ranking anual por Categoría y Subcategoría
  const annualCategoryBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        totalUsd: number;
        totalVes: number;
        count: number;
        subMap: Map<string, { name: string; totalUsd: number }>;
      }
    >();

    for (const row of yearHistory) {
      let entry = map.get(row.category_id);
      if (!entry) {
        entry = {
          id: row.category_id,
          name: row.category_name,
          color: row.category_color,
          totalUsd: 0,
          totalVes: 0,
          count: 0,
          subMap: new Map(),
        };
        map.set(row.category_id, entry);
      }

      entry.totalUsd += row.total_usd;
      entry.totalVes += row.total_ves;
      entry.count += row.expense_count;

      const subKey = row.subcategory_id || '__general__';
      const subName = row.subcategory_name || 'General';
      const prevSub = entry.subMap.get(subKey) || { name: subName, totalUsd: 0 };
      prevSub.totalUsd += row.total_usd;
      entry.subMap.set(subKey, prevSub);
    }

    const totalCatUsd = Array.from(map.values()).reduce(
      (s, item) => s + item.totalUsd,
      0
    );

    return Array.from(map.values())
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .map((item) => ({
        id: item.id,
        name: item.name,
        color: item.color,
        totalUsd: Number(item.totalUsd.toFixed(2)),
        totalVes: item.totalVes,
        count: item.count,
        percentage: totalCatUsd > 0 ? (item.totalUsd / totalCatUsd) * 100 : 0,
        subcategories: Array.from(item.subMap.values()).sort(
          (a, b) => b.totalUsd - a.totalUsd
        ),
      }));
  }, [yearHistory]);

  const topCategory = annualCategoryBreakdown[0] || null;

  const totalVesCurrent =
    currentBcvRate > 0 ? annualKpis.totalWithSubsUsd * currentBcvRate : 0;
  const totalEurCurrent =
    currentBcvEurRate > 0 && totalVesCurrent > 0
      ? totalVesCurrent / currentBcvEurRate
      : 0;

  const scrollToDetail = () => {
    const el = document.getElementById('annual-category-detail');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="flex flex-col w-full gap-6 pb-8">
      {/* Banner Principal y Selector de Año (Estilo Stitch Resumen Anual) */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-surface-container-lowest p-5 rounded-2xl shadow-xs border border-slate-100 relative overflow-hidden">
        <div className="flex items-start sm:items-center gap-3.5 z-10">
          <div className="w-12 h-12 rounded-xl bg-surface-container-high flex items-center justify-center text-on-surface shadow-2xs shrink-0">
            <Calendar className="w-6 h-6 text-secondary" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg sm:text-xl text-on-surface font-bold tracking-tight">
                Resumen Anual y Balance Cambiario ({selectedYear})
              </h1>
              <span className="hidden sm:inline-block px-2 py-0.5 bg-secondary-fixed text-[#00201d] font-mono text-xs rounded-md font-medium">
                Oficial
              </span>
            </div>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Consolidado de todo el año, gráficos de evolución y efecto de la tasa BCV
            </p>
          </div>
        </div>

        {/* Controles: Toggle Suscripciones + Selector de Año */}
        <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-auto justify-end z-10">
          <button
            type="button"
            onClick={() => setIncludeSubscriptions((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 bg-surface-container text-on-surface rounded-lg font-mono text-xs sm:text-sm font-medium hover:bg-surface-container-high transition-colors shadow-2xs cursor-pointer"
          >
            {includeSubscriptions ? (
              <CheckCircle2 className="w-4 h-4 text-secondary shrink-0" />
            ) : (
              <Circle className="w-4 h-4 text-outline shrink-0" />
            )}
            <span>
              {includeSubscriptions
                ? 'Incluyendo Suscripciones'
                : 'Solo Gastos Puntuales'}
            </span>
          </button>

          <div className="flex items-center bg-surface-container rounded-lg p-1 shadow-2xs">
            <button
              type="button"
              onClick={() => onSelectYear(selectedYear - 1)}
              aria-label="Año anterior"
              title="Año anterior"
              className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 font-mono text-sm font-bold text-on-surface font-tabular">
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => onSelectYear(selectedYear + 1)}
              aria-label="Año siguiente"
              title="Año siguiente"
              className="w-7 h-7 flex items-center justify-center rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Fila 1: 4 Tarjetas KPI Anuales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Gasto Total (Hero Oscuro estilo Stitch) */}
        <div className="bg-primary-container text-on-primary rounded-xl p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs font-semibold uppercase tracking-wider text-on-primary-container">
              Gasto Total {selectedYear}
            </span>
            <Wallet className="w-4 h-4 text-secondary-fixed" />
          </div>

          <div className="my-3 font-tabular">
            <div className="font-mono text-2xl sm:text-[2rem] text-on-primary font-bold tracking-tight leading-none">
              {formatCurrency(annualKpis.totalWithSubsUsd)}
            </div>
            <div className="font-mono text-xs text-on-primary-container mt-1.5 font-medium">
              {totalEurCurrent > 0 ? `${formatEuros(totalEurCurrent)} • ` : ''}
              {formatBolivares(totalVesCurrent)}
            </div>
          </div>

          <div className="pt-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 text-on-primary font-mono text-[11px] rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary-fixed shrink-0" />
              {annualKpis.totalTransactions} movimientos en {annualKpis.activeMonthsCount}{' '}
              {annualKpis.activeMonthsCount === 1 ? 'mes activo' : 'meses activos'}
            </span>
          </div>
        </div>

        {/* Card 2: Promedio por Mes Activo */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
              Promedio por Mes Activo
            </span>
            <BarChart3 className="w-4 h-4 text-on-surface-variant" />
          </div>

          <div className="my-3 font-tabular">
            <div className="font-mono text-2xl sm:text-[2rem] text-on-surface font-bold tracking-tight leading-none">
              {formatCurrency(annualKpis.averageMonthlyUsd)}
            </div>
            <div className="font-mono text-xs text-on-surface-variant mt-1.5">
              ≈{' '}
              {formatBolivares(
                currentBcvRate > 0 ? annualKpis.averageMonthlyUsd * currentBcvRate : 0
              )}{' '}
              / mes
            </div>
          </div>

          <div className="pt-2">
            <span className="text-xs text-on-surface-variant">
              Calculado sobre {annualKpis.activeMonthsCount || 1} mes(es) con registros
            </span>
          </div>
        </div>

        {/* Card 3: Mes Pico del Año */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
              Mes Pico del Año
            </span>
            <Flame className="w-5 h-5 text-[#f83256]" />
          </div>

          {annualKpis.highestMonth ? (
            <>
              <div className="my-3">
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-lg font-semibold text-on-surface">
                    {annualKpis.highestMonth.fullName}:
                  </span>
                  <span className="font-mono text-xl text-error font-bold leading-none font-tabular">
                    {formatCurrency(annualKpis.highestMonth.totalUsd)}
                  </span>
                </div>
                {annualKpis.lowestMonth &&
                  annualKpis.lowestMonth.monthKey !==
                    annualKpis.highestMonth.monthKey && (
                    <div className="font-mono text-xs text-secondary font-medium mt-1.5">
                      Mes más bajo: {annualKpis.lowestMonth.fullName} (
                      {formatCurrency(annualKpis.lowestMonth.totalUsd)})
                    </div>
                  )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() =>
                    annualKpis.highestMonth &&
                    onSelectMonthAndGoToMonthly(annualKpis.highestMonth.monthKey)
                  }
                  className="text-xs text-on-surface-variant hover:text-on-surface cursor-pointer inline-flex items-center gap-1 transition-colors"
                >
                  <span>Haz clic en las barras para ir al mes</span>
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          ) : (
            <div className="text-xs text-on-surface-variant my-auto py-4">
              Sin datos registrados en {selectedYear}
            </div>
          )}
        </div>

        {/* Card 4: Mayor Rubro del Año */}
        <div className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant font-semibold uppercase tracking-wider">
              Mayor Rubro del Año
            </span>
            <Award className="w-5 h-5 text-[#d97706]" />
          </div>

          {topCategory ? (
            <>
              <div className="my-3">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: topCategory.color }}
                  />
                  <span className="text-lg font-bold text-on-surface leading-tight truncate">
                    {topCategory.name}
                  </span>
                </div>
                <div className="font-mono text-xl text-on-surface font-semibold font-tabular">
                  {formatCurrency(topCategory.totalUsd)}{' '}
                  <span className="font-mono text-xs text-on-surface-variant font-normal">
                    ({topCategory.percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-xs text-on-surface-variant">
                  {topCategory.count} movimientos en el año
                </span>
              </div>
            </>
          ) : (
            <div className="text-xs text-on-surface-variant my-auto py-4">
              Sin datos registrados en {selectedYear}
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: Pérdida o Ganancia Cambiaria Acumulada (BCV) */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col gap-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed/50 flex items-center justify-center text-secondary shadow-2xs shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg text-on-surface font-bold">
                Pérdida o Ganancia Cambiaria Acumulada ({selectedYear})
              </h2>
              <p className="text-xs text-on-surface-variant mt-0.5">
                Compara los Bolívares que pagaste al momento de cada compra contra su valor actual a tasa BCV de hoy (Bs. {currentBcvRate.toFixed(2)}/USD)
              </p>
            </div>
          </div>

          {annualKpis.totalPunctualUsd > 0 && (
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-semibold shadow-2xs shrink-0 ${
                annualKpis.exchangeDiffUsd >= 0
                  ? 'bg-secondary-fixed text-[#00201d]'
                  : 'bg-error-container text-on-error-container'
              }`}
            >
              {annualKpis.exchangeDiffUsd >= 0 ? (
                <TrendingUp className="w-4 h-4 text-secondary shrink-0" />
              ) : (
                <TrendingDown className="w-4 h-4 text-error shrink-0" />
              )}
              <span>
                Efecto Cambiario: {annualKpis.exchangeDiffUsd >= 0 ? '+' : ''}
                {formatCurrency(annualKpis.exchangeDiffUsd)} (
                {annualKpis.exchangeDiffPercent.toFixed(1)}%)
              </span>
            </div>
          )}
        </div>

        {/* 4 Sub-columnas de Métricas Cambiarias */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-surface-container-low rounded-xl font-tabular">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-on-surface-variant">
              Bolívares Pagados (Histórico)
            </span>
            <span className="font-mono text-lg font-bold text-on-surface">
              {formatBolivares(annualKpis.totalHistoricalVes)}
            </span>
            <span className="text-xs text-on-surface-variant">
              Tasa promedio pagada: Bs. {annualKpis.avgHistoricalRate.toFixed(2)}/$
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-on-surface-variant">
              Valor USD al Día del Gasto
            </span>
            <span className="font-mono text-lg font-bold text-on-surface">
              {formatCurrency(annualKpis.totalPunctualUsd)}
            </span>
            <span className="text-xs text-on-surface-variant">
              Costo real en divisas cuando compraste
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-on-surface-variant">
              Esos Bs. a Tasa BCV de Hoy
            </span>
            <span className="font-mono text-lg font-bold text-on-surface">
              {formatCurrency(annualKpis.usdEquivalentAtTodayRate)}
            </span>
            <span className="text-xs text-on-surface-variant">
              Tasa BCV hoy: Bs. {currentBcvRate.toFixed(2)}/$
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-mono text-xs text-on-surface-variant">
              Diferencia por Devaluación
            </span>
            <span
              className={`font-mono text-lg font-bold ${
                annualKpis.exchangeDiffVes >= 0 ? 'text-secondary' : 'text-error'
              }`}
            >
              {annualKpis.exchangeDiffVes >= 0 ? '+' : ''}
              {formatBolivares(annualKpis.exchangeDiffVes)}
            </span>
            <span
              className={`text-xs font-medium ${
                annualKpis.exchangeDiffUsd >= 0
                  ? 'text-secondary'
                  : 'text-on-surface-variant'
              }`}
            >
              {annualKpis.exchangeDiffUsd >= 0
                ? `Ahorraste ${formatCurrency(annualKpis.exchangeDiffUsd)} frente a comprar hoy en Bs.`
                : `Variación de ${formatCurrency(annualKpis.exchangeDiffUsd)}`}
            </span>
          </div>
        </div>
      </div>

      {/* Fila 3: Split de Gráficas (7 cols Barras 12 Meses + 5 cols Dona Categorías) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Columna Izquierda: Gastos Mes a Mes (USD) [Span 7] */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-secondary" />
              <h2 className="text-base sm:text-lg font-bold text-on-surface">
                Gastos Mes a Mes en {selectedYear} (USD)
              </h2>
            </div>
            <span className="text-xs text-on-surface-variant hidden sm:inline-block">
              Haz clic en una barra para abrir ese mes
            </span>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartData}
                margin={{ top: 12, right: 10, left: -8, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="#dce9ff"
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#76777d', fontFamily: 'JetBrains Mono' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatCurrency(Number(value) || 0),
                    name === 'punctualUsd'
                      ? 'Gastos Puntuales'
                      : name === 'subscriptionsUsd'
                        ? 'Suscripciones'
                        : 'Total USD',
                  ]}
                  labelFormatter={(label) => `Mes: ${label} ${selectedYear}`}
                  contentStyle={{
                    borderRadius: '12px',
                    border: '1px solid #c6c6cd',
                    fontFamily: 'JetBrains Mono',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="punctualUsd"
                  name="punctualUsd"
                  stackId="a"
                  radius={[6, 6, 0, 0]}
                  className="cursor-pointer"
                  onClick={(_data, index) => {
                    const item = monthlyChartData[index];
                    if (item?.monthKey) {
                      onSelectMonthAndGoToMonthly(item.monthKey);
                    }
                  }}
                >
                  {monthlyChartData.map((entry) => {
                    const isPeak =
                      annualKpis.highestMonth &&
                      entry.monthKey === annualKpis.highestMonth.monthKey;
                    return (
                      <Cell
                        key={entry.monthKey}
                        fill={isPeak ? '#006a61' : '#131b2e'}
                      />
                    );
                  })}
                </Bar>
                {includeSubscriptions && (
                  <Bar
                    dataKey="subscriptionsUsd"
                    name="subscriptionsUsd"
                    stackId="a"
                    fill="#6bd8cb"
                    radius={[6, 6, 0, 0]}
                    className="cursor-pointer"
                    onClick={(_data, index) => {
                      const item = monthlyChartData[index];
                      if (item?.monthKey) {
                        onSelectMonthAndGoToMonthly(item.monthKey);
                      }
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 mt-2 border-t border-surface-container flex flex-wrap items-center justify-between gap-2 text-xs text-on-surface-variant">
            <span>
              {annualKpis.activeMonthNames.length > 0
                ? `* Registros contabilizados en: ${annualKpis.activeMonthNames.slice(0, 4).join(', ')}${annualKpis.activeMonthNames.length > 4 ? ` y ${annualKpis.activeMonthNames.length - 4} más` : ''} ${selectedYear}.`
                : `Sin registros contabilizados en ${selectedYear}.`}
            </span>
            <span className="font-mono font-semibold text-on-surface font-tabular">
              Total: {formatCurrency(annualKpis.totalWithSubsUsd)}
            </span>
          </div>
        </div>

        {/* Columna Derecha: Proporción Anual por Categoría [Span 5] */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-6 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-secondary" />
              <h2 className="text-base sm:text-lg font-bold text-on-surface">
                Proporción Anual por Categoría
              </h2>
            </div>
          </div>

          {annualCategoryBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant py-12">
              Sin gastos registrados en {selectedYear}
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row lg:flex-col xl:flex-row items-center justify-between gap-5 my-auto">
                {/* Dona con total centrado */}
                <div className="relative w-44 h-44 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={annualCategoryBreakdown}
                        dataKey="totalUsd"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={78}
                        paddingAngle={2.5}
                      >
                        {annualCategoryBreakdown.map((entry) => (
                          <Cell key={entry.id} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                        contentStyle={{
                          borderRadius: '10px',
                          border: '1px solid #c6c6cd',
                          fontFamily: 'JetBrains Mono',
                          fontSize: '12px',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                    <span className="font-mono text-base font-bold text-on-surface leading-none font-tabular">
                      {formatCurrency(annualKpis.totalPunctualUsd)}
                    </span>
                    <span className="font-mono text-[10px] text-on-surface-variant uppercase mt-1">
                      Total Anual
                    </span>
                  </div>
                </div>

                {/* Leyenda de categorías */}
                <div className="flex flex-col gap-1.5 w-full max-h-52 overflow-y-auto pr-1">
                  {annualCategoryBreakdown.map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between text-xs hover:bg-surface-container-low px-2 py-1.5 rounded-lg transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="text-on-surface font-medium truncate">
                          {cat.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 font-tabular">
                        <span className="font-mono text-on-surface font-semibold">
                          {formatCurrency(cat.totalUsd)}
                        </span>
                        <span className="font-mono text-on-surface-variant w-8 text-right">
                          {cat.percentage.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-3 mt-4 flex items-center justify-between border-t border-surface-container text-xs">
                <span className="text-on-surface-variant">
                  {annualCategoryBreakdown.length}{' '}
                  {annualCategoryBreakdown.length === 1
                    ? 'categoría activa'
                    : 'categorías activas'}{' '}
                  este año
                </span>
                <button
                  type="button"
                  onClick={scrollToDetail}
                  className="font-mono text-xs text-secondary hover:underline font-semibold cursor-pointer"
                >
                  Ver detalle analítico →
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fila 4: Detalle Anual Acumulado por Categoría y Subcategoría */}
      {annualCategoryBreakdown.length > 0 && (
        <div id="annual-category-detail" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <Layers className="w-5 h-5 text-secondary shrink-0" />
              <h2 className="text-base sm:text-lg font-bold text-on-surface">
                Detalle Anual Acumulado por Categoría y Subcategoría ({selectedYear})
              </h2>
            </div>
            <span className="font-mono text-xs text-on-surface-variant bg-surface-container px-2.5 py-1 rounded-md">
              {annualKpis.totalTransactions} Transacciones
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {annualCategoryBreakdown.map((cat) => (
              <div
                key={cat.id}
                className="bg-surface-container-lowest rounded-xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between gap-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-base sm:text-lg font-bold text-on-surface truncate">
                      {cat.name}
                    </span>
                    <span className="font-mono text-xs text-on-surface-variant shrink-0">
                      ({cat.count} mov.)
                    </span>
                  </div>
                  <span className="font-mono text-lg font-bold text-on-surface font-tabular shrink-0">
                    {formatCurrency(cat.totalUsd)}
                  </span>
                </div>

                {/* Chips de Subcategorías */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {cat.subcategories.map((sub, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-container rounded-lg text-xs"
                    >
                      <CornerDownRight className="w-3.5 h-3.5 text-on-surface-variant shrink-0" />
                      <span className="text-on-surface-variant">{sub.name}:</span>
                      <span className="font-mono text-on-surface font-semibold font-tabular">
                        {formatCurrency(sub.totalUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
