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
  categories,
  subcategories,
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
      // Solo sumamos la cuota mensual de suscripciones a meses que tengan actividad o si el usuario quiere ver la proyección
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

    // Análisis Cambiario Anual (Pérdida o Ganancia Cambiaria respecto al BCV actual)
    // Compara los Bolívares realmente desembolsados en el año vs. cuánto valen hoy en USD a la tasa BCV actual
    const usdEquivalentAtTodayRate =
      currentBcvRate > 0 && totalHistoricalVes > 0
        ? totalHistoricalVes / currentBcvRate
        : totalPunctualUsd;

    // Si gastaste $1,000 en su momento (ej. Bs. 850,000 a tasa 850) y hoy esos Bs. 850,000 divididos entre tasa 880 son $965.90,
    // la diferencia cambiaria es $34.10 (o en Bs: hoy $1,000 costarían Bs. 880,000, es decir +Bs. 30,000 de diferencia cambiaria).
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

    return {
      totalPunctualUsd,
      totalWithSubsUsd,
      totalHistoricalVes,
      totalTransactions,
      activeMonthsCount,
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

  return (
    <div className="space-y-6">
      {/* Cabecera de Control Anual */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              Resumen Anual y Balance Cambiario ({selectedYear})
            </h2>
            <p className="text-xs text-slate-400">
              Consolidado de todo el año, gráficos de evolución y efecto de la tasa BCV
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Botón para incluir/excluir suscripciones en el total anual */}
          <button
            type="button"
            onClick={() => setIncludeSubscriptions((v) => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
              includeSubscriptions
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-600 border-slate-200'
            }`}
          >
            {includeSubscriptions
              ? 'Incluyendo Suscripciones'
              : 'Solo Gastos Puntuales'}
          </button>

          {/* Selector de Año */}
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            <button
              type="button"
              onClick={() => onSelectYear(selectedYear - 1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Año anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 text-sm font-bold text-slate-800">
              {selectedYear}
            </span>
            <button
              type="button"
              onClick={() => onSelectYear(selectedYear + 1)}
              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all cursor-pointer"
              title="Año siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 1. Tarjetas de KPIs Anuales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gastado en el Año */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-5 text-white shadow-sm flex flex-col justify-between">
          <span className="text-xs font-medium text-indigo-100 uppercase tracking-wider">
            Gasto Total {selectedYear}
          </span>
          <div className="my-2">
            <div className="text-2xl font-bold">
              {formatCurrency(annualKpis.totalWithSubsUsd)}
            </div>
            <div className="text-xs text-indigo-100 mt-1">
              {totalEurCurrent > 0 ? `${formatEuros(totalEurCurrent)} · ` : ''}
              {formatBolivares(totalVesCurrent)}
            </div>
          </div>
          <span className="text-[11px] text-indigo-200">
            {annualKpis.totalTransactions} movimientos en {annualKpis.activeMonthsCount}{' '}
            {annualKpis.activeMonthsCount === 1 ? 'mes activo' : 'meses activos'}
          </span>
        </div>

        {/* Promedio Mensual */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
            Promedio por Mes Activo
          </span>
          <div className="my-2">
            <div className="text-2xl font-bold text-slate-800">
              {formatCurrency(annualKpis.averageMonthlyUsd)}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              ≈{' '}
              {formatBolivares(
                currentBcvRate > 0 ? annualKpis.averageMonthlyUsd * currentBcvRate : 0
              )}{' '}
              / mes
            </div>
          </div>
          <span className="text-[11px] text-slate-400">
            Calculado sobre {annualKpis.activeMonthsCount || 1} mes(es) con registros
          </span>
        </div>

        {/* Mes Más Costoso vs Más Económico */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Mes Pico del Año
            </span>
            <Flame className="w-4 h-4 text-red-500" />
          </div>
          {annualKpis.highestMonth ? (
            <>
              <div className="my-2">
                <div className="text-lg font-bold text-slate-800">
                  {annualKpis.highestMonth.fullName}:{' '}
                  <span className="text-red-600">
                    {formatCurrency(annualKpis.highestMonth.totalUsd)}
                  </span>
                </div>
                {annualKpis.lowestMonth &&
                  annualKpis.lowestMonth.monthKey !==
                    annualKpis.highestMonth.monthKey && (
                    <div className="text-xs text-emerald-600 mt-1">
                      Mes más bajo: {annualKpis.lowestMonth.fullName} (
                      {formatCurrency(annualKpis.lowestMonth.totalUsd)})
                    </div>
                  )}
              </div>
              <span className="text-[11px] text-slate-400">
                Haz clic en las barras inferiores para ir al mes
              </span>
            </>
          ) : (
            <div className="text-xs text-slate-400 my-auto">Sin datos en {selectedYear}</div>
          )}
        </div>

        {/* Categoría Mayor del Año */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
              Mayor Rubro del Año
            </span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          {topCategory ? (
            <>
              <div className="my-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: topCategory.color }}
                  />
                  <span className="text-base font-bold text-slate-800 truncate">
                    {topCategory.name}
                  </span>
                </div>
                <div className="text-lg font-bold text-indigo-600 mt-0.5">
                  {formatCurrency(topCategory.totalUsd)}{' '}
                  <span className="text-xs font-normal text-slate-400">
                    ({topCategory.percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400">
                {topCategory.count} movimientos en el año
              </span>
            </>
          ) : (
            <div className="text-xs text-slate-400 my-auto">Sin datos en {selectedYear}</div>
          )}
        </div>
      </div>

      {/* 2. Panel de Pérdida o Ganancia Cambiaria Anual (BCV) */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                Pérdida o Ganancia Cambiaria Acumulada ({selectedYear})
              </h3>
              <p className="text-xs text-slate-400">
                Compara los Bolívares que pagaste al momento de cada compra contra su valor actual a tasa BCV de hoy (Bs. {currentBcvRate.toFixed(2)}/USD)
              </p>
            </div>
          </div>

          {annualKpis.totalPunctualUsd > 0 && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                annualKpis.exchangeDiffUsd >= 0
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-red-50 text-red-700 border border-red-200'
              }`}
            >
              {annualKpis.exchangeDiffUsd >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              Efecto Cambiario: {annualKpis.exchangeDiffUsd >= 0 ? '+' : ''}
              {formatCurrency(annualKpis.exchangeDiffUsd)} (
              {annualKpis.exchangeDiffPercent.toFixed(1)}%)
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
          <div>
            <span className="text-xs text-slate-500 block">
              Bolívares Pagados (Histórico)
            </span>
            <span className="text-base font-bold text-slate-800 mt-0.5 block">
              {formatBolivares(annualKpis.totalHistoricalVes)}
            </span>
            <span className="text-[11px] text-slate-400">
              Tasa promedio pagada: Bs. {annualKpis.avgHistoricalRate.toFixed(2)}/$
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">
              Valor USD al Día del Gasto
            </span>
            <span className="text-base font-bold text-slate-800 mt-0.5 block">
              {formatCurrency(annualKpis.totalPunctualUsd)}
            </span>
            <span className="text-[11px] text-slate-400">
              Costo real en divisas cuando compraste
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">
              Esos Bs. a Tasa BCV de Hoy
            </span>
            <span className="text-base font-bold text-indigo-700 mt-0.5 block">
              {formatCurrency(annualKpis.usdEquivalentAtTodayRate)}
            </span>
            <span className="text-[11px] text-slate-400">
              Tasa BCV hoy: Bs. {currentBcvRate.toFixed(2)}/$
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-500 block">
              Diferencia por Devaluación
            </span>
            <span
              className={`text-base font-bold mt-0.5 block ${
                annualKpis.exchangeDiffVes >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}
            >
              {annualKpis.exchangeDiffVes >= 0 ? '+' : ''}
              {formatBolivares(annualKpis.exchangeDiffVes)}
            </span>
            <span className="text-[11px] text-slate-400">
              {annualKpis.exchangeDiffUsd >= 0
                ? `Ahorraste ${formatCurrency(annualKpis.exchangeDiffUsd)} frente a comprar hoy en Bs.`
                : `Variación de ${formatCurrency(annualKpis.exchangeDiffUsd)}`}
            </span>
          </div>
        </div>
      </div>

      {/* 3. Gráficos Interactivos Anuales (Barras de 12 Meses + Dona de Categorías) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Gráfico de Barras: Los 12 Meses del Año */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Gastos Mes a Mes en {selectedYear} (USD)
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Haz clic en una barra para abrir ese mes
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyChartData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
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
                    border: '1px solid #e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="punctualUsd"
                  name="punctualUsd"
                  stackId="a"
                  fill="#4f46e5"
                  radius={[4, 4, 0, 0]}
                  className="cursor-pointer"
                  onClick={(_data, index) => {
                    const item = monthlyChartData[index];
                    if (item?.monthKey) {
                      onSelectMonthAndGoToMonthly(item.monthKey);
                    }
                  }}
                />
                {includeSubscriptions && (
                  <Bar
                    dataKey="subscriptionsUsd"
                    name="subscriptionsUsd"
                    stackId="a"
                    fill="#818cf8"
                    radius={[4, 4, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico de Dona: Distribución Anual por Categorías */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col">
          <div className="flex items-center gap-2 mb-4">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-semibold text-slate-800">
              Proporción Anual por Categoría
            </h3>
          </div>

          {annualCategoryBreakdown.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
              Sin gastos registrados en {selectedYear}
            </div>
          ) : (
            <>
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={annualCategoryBreakdown}
                      dataKey="totalUsd"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={82}
                      paddingAngle={3}
                    >
                      {annualCategoryBreakdown.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Leyenda compacta */}
              <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {annualCategoryBreakdown.map((cat) => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-slate-700 truncate">
                        {cat.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(cat.totalUsd)}
                      </span>
                      <span className="text-slate-400 w-9 text-right">
                        {cat.percentage.toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 4. Desglose Completo de Categorías y Subcategorías en el Año */}
      {annualCategoryBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">
            Detalle Anual Acumulado por Categoría y Subcategoría ({selectedYear})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {annualCategoryBreakdown.map((cat) => (
              <div
                key={cat.id}
                className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-bold text-slate-800">{cat.name}</span>
                    <span className="text-xs text-slate-400">({cat.count} mov.)</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(cat.totalUsd)}
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {cat.subcategories.map((sub, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-xs text-slate-600"
                    >
                      <CornerDownRight className="w-3 h-3 text-slate-400" />
                      <span>{sub.name}:</span>
                      <strong className="text-slate-800">
                        {formatCurrency(sub.totalUsd)}
                      </strong>
                    </span>
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
