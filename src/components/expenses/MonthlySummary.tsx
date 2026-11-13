import React, { useState, useMemo } from 'react';
import {
  CornerDownRight,
  Repeat,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import type { CategoryBreakdown, Expense } from '../../types/index.ts';
import {
  formatCurrency,
  formatEuros,
  formatBolivares,
  formatShortDate,
} from '../../utils/formatters.ts';

interface MonthlySummaryProps {
  selectedMonth: string;
  expenses: Expense[];
  totalAmount: number;
  punctualUsdAmount: number;
  totalAmountEur: number;
  totalAmountVes: number;
  historicalPunctualVes: number;
  subscriptionsMonthlyUsd: number;
  separatedAnnualUsd: number;
  currentBcvRate: number;
  currentBcvEurRate: number;
  expenseCount: number;
  breakdown: CategoryBreakdown[];
  activeCategoryFilter: string | null;
  onSelectCategoryFilter: (categoryId: string | null) => void;
  selectedDateFilter?: string | null;
  onSelectDateFilter?: (date: string | null) => void;
  onOpenSubscriptionsTab: () => void;
  onOpenCategories?: () => void;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
  selectedMonth,
  expenses,
  totalAmount,
  punctualUsdAmount,
  totalAmountEur,
  totalAmountVes,
  historicalPunctualVes,
  subscriptionsMonthlyUsd,
  separatedAnnualUsd,
  currentBcvRate,
  currentBcvEurRate,
  expenseCount,
  breakdown,
  activeCategoryFilter,
  onSelectCategoryFilter,
  selectedDateFilter = null,
  onSelectDateFilter,
  onOpenSubscriptionsTab,
  onOpenCategories,
}) => {
  const [chartMode, setChartMode] = useState<'daily' | 'cumulative' | 'category'>('daily');

  // Equivalentes del total USD a las tasas oficiales vigentes del BCV
  const currentEquivalentVes =
    currentBcvRate > 0 ? totalAmount * currentBcvRate : totalAmountVes;

  const currentEquivalentEur =
    currentBcvEurRate > 0 && currentEquivalentVes > 0
      ? currentEquivalentVes / currentBcvEurRate
      : totalAmountEur;

  // Cálculo de Pérdida o Ganancia Cambiaria del Mes (sobre los gastos puntuales registrados)
  const usdValueTodayOfVesPaid =
    currentBcvRate > 0 && historicalPunctualVes > 0
      ? historicalPunctualVes / currentBcvRate
      : punctualUsdAmount;

  const exchangeDiffUsd = punctualUsdAmount - usdValueTodayOfVesPaid;
  const vesTodayForPunctualUsd =
    currentBcvRate > 0 ? punctualUsdAmount * currentBcvRate : historicalPunctualVes;
  const exchangeDiffVes = vesTodayForPunctualUsd - historicalPunctualVes;
  const exchangeDiffPercent =
    punctualUsdAmount > 0 ? (exchangeDiffUsd / punctualUsdAmount) * 100 : 0;

  // Construcción de la serie diaria del mes para "Daily Outflow Cadence"
  const dailyStats = useMemo(() => {
    const [yearStr, monthStr] = selectedMonth.split('-');
    const year = Number(yearStr) || new Date().getFullYear();
    const monthIndex = (Number(monthStr) || 1) - 1;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const byDay = new Map<number, { usd: number; ves: number; count: number }>();
    for (let d = 1; d <= daysInMonth; d++) {
      byDay.set(d, { usd: 0, ves: 0, count: 0 });
    }

    for (const exp of expenses) {
      const dayNum = Number(exp.expense_date.slice(8, 10));
      if (dayNum >= 1 && dayNum <= daysInMonth) {
        const entry = byDay.get(dayNum)!;
        entry.usd += exp.amount;
        entry.ves +=
          exp.amount_ves > 0
            ? exp.amount_ves
            : currentBcvRate > 0
            ? exp.amount * currentBcvRate
            : 0;
        entry.count += 1;
      }
    }

    let runningUsd = 0;
    let weekdaySum = 0;
    let weekdayActiveDays = 0;
    let weekendSum = 0;
    let weekendActiveDays = 0;
    let activeDaysCount = 0;
    let peakDay = { day: 1, dateIso: `${selectedMonth}-01`, usd: 0 };

    const series: Array<{
      day: number;
      label: string;
      dateIso: string;
      usd: number;
      cumulativeUsd: number;
      count: number;
      isWeekend: boolean;
    }> = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, monthIndex, d);
      const dayOfWeek = dateObj.getDay(); // 0 = Dom, 6 = Sáb
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dateIso = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const info = byDay.get(d)!;

      runningUsd += info.usd;

      if (info.usd > 0) {
        activeDaysCount += 1;
        if (isWeekend) {
          weekendSum += info.usd;
          weekendActiveDays += 1;
        } else {
          weekdaySum += info.usd;
          weekdayActiveDays += 1;
        }
        if (info.usd > peakDay.usd) {
          peakDay = { day: d, dateIso, usd: info.usd };
        }
      }

      series.push({
        day: d,
        label: String(d).padStart(2, '0'),
        dateIso,
        usd: Number(info.usd.toFixed(2)),
        cumulativeUsd: Number(runningUsd.toFixed(2)),
        count: info.count,
        isWeekend,
      });
    }

    const todayIso = new Date().toISOString().slice(0, 10);
    const elapsedDays = todayIso.startsWith(selectedMonth)
      ? Math.max(1, Number(todayIso.slice(8, 10)))
      : daysInMonth;

    const dailyVelocity = punctualUsdAmount / elapsedDays;
    const avgActiveDay = activeDaysCount > 0 ? punctualUsdAmount / activeDaysCount : 0;
    const weekendAvg = weekendActiveDays > 0 ? weekendSum / weekendActiveDays : 0;
    const weekdayAvg = weekdayActiveDays > 0 ? weekdaySum / weekdayActiveDays : 0;

    return {
      daysInMonth,
      elapsedDays,
      activeDaysCount,
      dailyVelocity,
      avgActiveDay,
      weekendAvg,
      weekdayAvg,
      peakDay,
      series,
    };
  }, [selectedMonth, expenses, punctualUsdAmount, currentBcvRate]);

  const topCategory = breakdown.length > 0 ? breakdown[0] : null;

  return (
    <div className="space-y-6">
      {/* Fila de 4 Tarjetas KPI */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Gasto Total del Mes */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant uppercase font-medium tracking-wider">
              Gasto Total
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container font-semibold">
              {expenseCount} {expenseCount === 1 ? 'mov.' : 'movs.'}
            </span>
          </div>

          <div className="my-2.5">
            <div className="font-tabular text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
              {formatCurrency(totalAmount)}
            </div>
            <p className="font-mono text-xs text-on-surface-variant mt-1 truncate">
              {currentEquivalentEur > 0 ? `${formatEuros(currentEquivalentEur)} · ` : ''}
              {formatBolivares(currentEquivalentVes)}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            {subscriptionsMonthlyUsd > 0 || separatedAnnualUsd > 0 ? (
              <button
                type="button"
                onClick={onOpenSubscriptionsTab}
                className="flex items-center gap-1 text-secondary hover:text-on-secondary-container font-mono text-xs font-medium cursor-pointer"
              >
                <Repeat className="w-3.5 h-3.5" />
                <span>
                  Susc: {formatCurrency(subscriptionsMonthlyUsd)}/mes
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-1 text-secondary font-mono text-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Base USD Oficial</span>
              </div>
            )}
            <svg
              className="w-14 h-5 text-secondary shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 64 24"
            >
              <path
                d="M2 18 L16 14 L30 19 L44 9 L62 5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* KPI 2: Efecto Cambiario BCV (Ganancia o Pérdida) */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant uppercase font-medium tracking-wider">
              Efecto Cambiario
            </span>
            <span
              className={`font-mono text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${
                exchangeDiffUsd >= 0
                  ? 'bg-secondary-container text-on-secondary-container'
                  : 'bg-error-container text-on-error-container'
              }`}
            >
              {exchangeDiffUsd >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {exchangeDiffUsd >= 0 ? '+' : ''}
              {exchangeDiffPercent.toFixed(1)}%
            </span>
          </div>

          <div className="my-2.5">
            <div className="font-tabular text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
              {exchangeDiffUsd >= 0 ? '+' : ''}
              {formatCurrency(exchangeDiffUsd)}
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full mt-2.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  exchangeDiffUsd >= 0 ? 'bg-secondary' : 'bg-tertiary'
                }`}
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(12, 50 + exchangeDiffPercent * 2)
                  )}%`,
                }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-on-surface-variant">
              Hoy equiv. a {formatCurrency(usdValueTodayOfVesPaid)}
            </span>
            <span
              className={`font-mono text-xs font-semibold ${
                exchangeDiffVes >= 0 ? 'text-secondary' : 'text-tertiary'
              }`}
            >
              {exchangeDiffVes >= 0 ? '+' : ''}
              {formatBolivares(exchangeDiffVes)}
            </span>
          </div>
        </div>

        {/* KPI 3: Velocidad / Promedio Diario (Daily Velocity) */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant uppercase font-medium tracking-wider">
              Velocidad Diaria
            </span>
            <span className="font-mono text-xs text-on-surface-variant">
              {dailyStats.activeDaysCount}/{dailyStats.daysInMonth} Días
            </span>
          </div>

          <div className="my-2.5">
            <div className="font-tabular text-2xl sm:text-3xl font-semibold text-on-surface tracking-tight">
              {formatCurrency(dailyStats.dailyVelocity)}
              <span className="font-mono text-xs text-on-surface-variant font-normal">
                /día
              </span>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">
              Prom. por día con gasto: {formatCurrency(dailyStats.avgActiveDay)}
            </p>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-on-surface-variant">Día de mayor gasto</span>
            <span className="font-mono text-xs text-on-surface font-semibold">
              {dailyStats.peakDay.usd > 0
                ? `${formatShortDate(dailyStats.peakDay.dateIso)} (${formatCurrency(
                    dailyStats.peakDay.usd
                  )})`
                : 'Sin registros'}
            </span>
          </div>
        </div>

        {/* KPI 4: Categoría Dominante (Dominant Outflow) */}
        <div className="bg-surface-container-lowest rounded-xl p-4 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col justify-between hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs text-on-surface-variant uppercase font-medium tracking-wider">
              Flujo Dominante
            </span>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-surface-container-highest text-on-surface font-semibold">
              {topCategory ? `${topCategory.percentage.toFixed(1)}% Ratio` : '0% Ratio'}
            </span>
          </div>

          <div className="my-2.5">
            <div className="text-lg font-semibold text-on-surface truncate">
              {topCategory ? topCategory.name : 'Sin categoría activa'}
            </div>
            <div className="font-tabular text-xl font-semibold text-on-surface mt-0.5">
              {topCategory ? formatCurrency(topCategory.total) : '$0.00'}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-xs text-on-surface-variant">
              {topCategory
                ? `${topCategory.count} movimientos registrados`
                : 'Añade un gasto para iniciar'}
            </span>
            <ShieldCheck className="w-4 h-4 text-secondary shrink-0" />
          </div>
        </div>
      </section>

      {/* Fila Principal de Analítica y Visualización (60/40 Split de Stitch) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Columna Izquierda (7 cols): Cadencia de Gasto Diario (Daily Outflow Cadence) */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-xl p-5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Cadencia de Gasto Diario
              </h2>
              <p className="text-xs text-on-surface-variant">
                Distribución diaria del mes con marcadores de fin de semana y clic para filtrar por día
              </p>
            </div>

            {/* Pestañas del gráfico (Daily Trend | Cumulative | By Category) */}
            <div className="flex items-center bg-surface-container-low rounded-lg p-1 font-mono text-xs">
              <button
                type="button"
                onClick={() => setChartMode('daily')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  chartMode === 'daily'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Diario
              </button>
              <button
                type="button"
                onClick={() => setChartMode('cumulative')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  chartMode === 'cumulative'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Acumulado
              </button>
              <button
                type="button"
                onClick={() => setChartMode('category')}
                className={`px-2.5 py-1 rounded transition-all cursor-pointer ${
                  chartMode === 'category'
                    ? 'bg-surface-container-lowest text-on-surface font-semibold shadow-2xs'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Por Categoría
              </button>
            </div>
          </div>

          {/* Contenedor del Gráfico */}
          <div className="w-full bg-surface-container-low/50 rounded-xl p-4 flex flex-col gap-2">
            <div className="flex flex-wrap justify-between items-center gap-2 font-mono text-[11px] text-on-surface-variant">
              <div className="flex flex-wrap items-center gap-3">
                {chartMode === 'daily' && (
                  <>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-secondary" />
                      Lun - Vie
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-xs bg-secondary-fixed-dim" />
                      Fin de Semana
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-on-tertiary-container inline-block" />
                      Prom. Activo ({formatCurrency(dailyStats.avgActiveDay)})
                    </span>
                  </>
                )}
                {chartMode === 'cumulative' && (
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-xs bg-secondary" />
                    Curva acumulada del mes ({formatCurrency(punctualUsdAmount)})
                  </span>
                )}
                {chartMode === 'category' && (
                  <span>Haz clic en un segmento para filtrar la tabla inferior</span>
                )}
              </div>

              {selectedDateFilter && onSelectDateFilter && (
                <button
                  type="button"
                  onClick={() => onSelectDateFilter(null)}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-white text-[11px] font-semibold cursor-pointer"
                >
                  <CalendarDays className="w-3 h-3" />
                  Filtrando: {formatShortDate(selectedDateFilter)} (Quitar)
                </button>
              )}
            </div>

            <div className="h-60 w-full">
              {expenses.length === 0 && breakdown.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-on-surface-variant">
                  Registra movimientos en este mes para visualizar la cadencia diaria.
                </div>
              ) : chartMode === 'daily' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dailyStats.series}
                    margin={{ top: 10, right: 6, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#d3e4fe"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                      axisLine={{ stroke: '#c6c6cd' }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [
                        formatCurrency(Number(value) || 0),
                        'Gasto del día',
                      ]}
                      labelFormatter={(label) => `Día ${label} (${selectedMonth}-${label})`}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                    />
                    {dailyStats.avgActiveDay > 0 && (
                      <ReferenceLine
                        y={dailyStats.avgActiveDay}
                        stroke="#f83256"
                        strokeDasharray="6 3"
                        strokeWidth={1.5}
                      />
                    )}
                    <Bar
                      dataKey="usd"
                      radius={[3, 3, 0, 0]}
                      className="cursor-pointer"
                      onClick={(_data, index) => {
                        const item = dailyStats.series[index];
                        if (item && onSelectDateFilter) {
                          onSelectDateFilter(
                            selectedDateFilter === item.dateIso ? null : item.dateIso
                          );
                        }
                      }}
                    >
                      {dailyStats.series.map((entry) => {
                        const isSelected = selectedDateFilter === entry.dateIso;
                        return (
                          <Cell
                            key={entry.dateIso}
                            fill={
                              isSelected
                                ? '#0f172a'
                                : entry.isWeekend
                                ? '#6bd8cb'
                                : '#006a61'
                            }
                            opacity={
                              selectedDateFilter && !isSelected ? 0.35 : 1
                            }
                          />
                        );
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : chartMode === 'cumulative' ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={dailyStats.series}
                    margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="primaryTealGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#006a61" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#006a61" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#d3e4fe"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                      axisLine={{ stroke: '#c6c6cd' }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#45464d', fontFamily: 'JetBrains Mono' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      formatter={(value: unknown) => [
                        formatCurrency(Number(value) || 0),
                        'Acumulado USD',
                      ]}
                      labelFormatter={(label) => `Día ${label}`}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativeUsd"
                      stroke="#006a61"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#primaryTealGradient)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={86}
                      paddingAngle={3}
                      onClick={(_entry, index) => {
                        const cat = breakdown[index];
                        if (cat?.category_id) {
                          onSelectCategoryFilter(
                            activeCategoryFilter === cat.category_id
                              ? null
                              : cat.category_id
                          );
                        }
                      }}
                      className="cursor-pointer"
                    >
                      {breakdown.map((entry) => (
                        <Cell
                          key={entry.category_id}
                          fill={entry.color}
                          opacity={
                            activeCategoryFilter &&
                            activeCategoryFilter !== entry.category_id
                              ? 0.35
                              : 1
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: unknown) => formatCurrency(Number(value) || 0)}
                      contentStyle={{
                        borderRadius: '10px',
                        border: '1px solid #cbd5e1',
                        fontFamily: 'JetBrains Mono',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* 3 Mini Tarjetas Inferiores de Resumen Diario (Quick Highlights de Stitch) */}
          <div className="grid grid-cols-3 gap-2.5 pt-0.5 text-center">
            <div className="p-2.5 bg-surface-container-low rounded-lg">
              <p className="font-mono text-[11px] text-on-surface-variant">
                Prom. Fin de Semana
              </p>
              <p className="font-tabular text-sm text-on-surface font-semibold mt-0.5">
                {formatCurrency(dailyStats.weekendAvg)}
              </p>
            </div>
            <div className="p-2.5 bg-surface-container-low rounded-lg">
              <p className="font-mono text-[11px] text-on-surface-variant">
                Prom. Lun - Vie
              </p>
              <p className="font-tabular text-sm text-on-surface font-semibold mt-0.5">
                {formatCurrency(dailyStats.weekdayAvg)}
              </p>
            </div>
            <div className="p-2.5 bg-surface-container-low rounded-lg">
              <p className="font-mono text-[11px] text-on-surface-variant">
                Balance Cambiario
              </p>
              <p
                className={`font-tabular text-sm font-semibold mt-0.5 ${
                  exchangeDiffUsd >= 0 ? 'text-secondary' : 'text-tertiary'
                }`}
              >
                {exchangeDiffUsd >= 0 ? 'Favorable' : 'Devaluado'} (
                {exchangeDiffUsd >= 0 ? '+' : ''}
                {exchangeDiffPercent.toFixed(1)}%)
              </p>
            </div>
          </div>
        </div>

        {/* Columna Derecha (5 cols): Distribución por Categorías y Subcategorías */}
        <div className="lg:col-span-5 bg-surface-container-lowest rounded-xl p-5 border border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.04)] flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-on-surface">
                Distribución por Categorías
              </h2>
              <p className="text-xs text-on-surface-variant">
                Desembolsos registrados y peso porcentual
              </p>
            </div>
            {activeCategoryFilter ? (
              <button
                type="button"
                onClick={() => onSelectCategoryFilter(null)}
                className="font-mono text-xs text-secondary hover:text-on-secondary-container font-semibold cursor-pointer"
              >
                Ver Todas
              </button>
            ) : onOpenCategories ? (
              <button
                type="button"
                onClick={onOpenCategories}
                className="font-mono text-xs text-secondary hover:text-on-secondary-container font-semibold cursor-pointer"
              >
                Gestionar
              </button>
            ) : null}
          </div>

          {breakdown.length === 0 ? (
            <div className="py-12 text-center text-xs text-on-surface-variant">
              No hay categorías con movimientos en este período.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-96 overflow-y-auto pr-1">
              {breakdown.map((item) => {
                const isSelected = activeCategoryFilter === item.category_id;
                const categoryVes =
                  currentBcvRate > 0 ? item.total * currentBcvRate : item.totalVes;
                const categoryEur =
                  currentBcvEurRate > 0 && categoryVes > 0
                    ? categoryVes / currentBcvEurRate
                    : item.totalEur;

                const hasNamedSubcategories = item.subcategories.some(
                  (s) => s.subcategory_id !== null || item.subcategories.length > 1
                );

                return (
                  <div
                    key={item.category_id}
                    className={`flex flex-col gap-1.5 p-2.5 rounded-lg transition-all border ${
                      isSelected
                        ? 'bg-surface-container border-primary/40 ring-1 ring-primary/20'
                        : 'bg-surface-container-low/50 border-transparent hover:bg-surface-container-low'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onSelectCategoryFilter(isSelected ? null : item.category_id)
                      }
                      className="w-full text-left cursor-pointer"
                    >
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold text-on-surface flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          {item.name}
                          <span className="font-mono text-[11px] text-on-surface-variant font-normal">
                            ({item.count})
                          </span>
                        </span>
                        <span className="font-tabular text-xs font-semibold text-on-surface">
                          {formatCurrency(item.total)}
                        </span>
                      </div>

                      <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(item.percentage, 3)}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>

                      <div className="flex justify-between font-mono text-[11px] text-on-surface-variant mt-1">
                        <span>{item.percentage.toFixed(1)}% del mes</span>
                        <span>
                          {categoryEur > 0 ? `${formatEuros(categoryEur)} · ` : ''}
                          {formatBolivares(categoryVes)}
                        </span>
                      </div>
                    </button>

                    {hasNamedSubcategories && (
                      <div className="pt-1.5 border-t border-slate-200/60 flex flex-wrap gap-1.5">
                        {item.subcategories.map((sub) => (
                          <div
                            key={sub.subcategory_id || 'general'}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-lowest border border-slate-200/80 font-mono text-[10px]"
                          >
                            <CornerDownRight className="w-2.5 h-2.5 text-outline" />
                            <span className="text-on-surface-variant">{sub.name}:</span>
                            <span className="font-semibold text-on-surface">
                              {formatCurrency(sub.total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
