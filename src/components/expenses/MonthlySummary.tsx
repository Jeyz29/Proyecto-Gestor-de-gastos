import React from 'react';
import {
  Wallet,
  PieChart as PieChartIcon,
  CornerDownRight,
  Repeat,
  Scale,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';
import type { CategoryBreakdown } from '../../types/index.ts';
import { formatCurrency, formatEuros, formatBolivares } from '../../utils/formatters.ts';

interface MonthlySummaryProps {
  totalAmount: number;
  punctualUsdAmount: number;
  totalAmountEur: number;
  totalAmountVes: number; // Bs históricos pagados + suscripciones
  historicalPunctualVes: number; // Bs exactos desembolsados en gastos puntuales del mes
  subscriptionsMonthlyUsd: number;
  separatedAnnualUsd: number;
  currentBcvRate: number;
  currentBcvEurRate: number;
  expenseCount: number;
  breakdown: CategoryBreakdown[];
  activeCategoryFilter: string | null;
  onSelectCategoryFilter: (categoryId: string | null) => void;
  onOpenSubscriptionsTab: () => void;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({
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
  onOpenSubscriptionsTab,
}) => {
  // Equivalentes del total USD a las tasas oficiales vigentes del BCV
  const currentEquivalentVes =
    currentBcvRate > 0 ? totalAmount * currentBcvRate : totalAmountVes;

  const currentEquivalentEur =
    currentBcvEurRate > 0 && currentEquivalentVes > 0
      ? currentEquivalentVes / currentBcvEurRate
      : totalAmountEur;

  // Cálculo de Pérdida o Ganancia Cambiaria del Mes (sobre los gastos puntuales registrados)
  // Compara el costo USD original al momento del gasto vs lo que esos mismos Bolívares valen hoy a tasa BCV actual
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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Tarjeta de Total del Mes */}
        <div className="md:col-span-4 bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl p-6 text-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-indigo-100 text-sm font-medium">
              Total Gastado (Base USD)
            </span>
            <div className="p-2 bg-white/10 rounded-xl">
              <Wallet className="w-5 h-5 text-white" />
            </div>
          </div>

          <div className="my-4">
            <div className="text-3xl font-bold tracking-tight">
              {formatCurrency(totalAmount)}
            </div>

            {/* Relación en Euros y Bolívares según BCV */}
            <div className="mt-3 pt-2.5 border-t border-white/15 space-y-1">
              {currentEquivalentEur > 0 && (
                <div className="flex items-center justify-between text-xs text-indigo-100">
                  <span>Equiv. Euro (BCV):</span>
                  <span className="font-semibold text-white">
                    ≈ {formatEuros(currentEquivalentEur)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs text-indigo-100">
                <span>Equiv. Bolívares (BCV hoy):</span>
                <span className="font-semibold text-white">
                  ≈ {formatBolivares(currentEquivalentVes)}
                </span>
              </div>
            </div>

            {/* Desglose de Suscripciones incluidas o separadas */}
            {(subscriptionsMonthlyUsd > 0 || separatedAnnualUsd > 0) && (
              <button
                type="button"
                onClick={onOpenSubscriptionsTab}
                className="mt-3 w-full text-left p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors text-xs space-y-1 cursor-pointer"
              >
                {subscriptionsMonthlyUsd > 0 && (
                  <div className="flex items-center justify-between text-indigo-100">
                    <span className="inline-flex items-center gap-1">
                      <Repeat className="w-3.5 h-3.5" />
                      Suscripciones en el mes:
                    </span>
                    <span className="font-semibold text-white">
                      {formatCurrency(subscriptionsMonthlyUsd)}
                    </span>
                  </div>
                )}
                {separatedAnnualUsd > 0 && (
                  <div className="flex items-center justify-between text-indigo-200/90 text-[11px]">
                    <span>Gasto anual separado:</span>
                    <span>{formatCurrency(separatedAnnualUsd)}/año</span>
                  </div>
                )}
              </button>
            )}

            <p className="text-indigo-200 text-xs mt-3">
              {expenseCount}{' '}
              {expenseCount === 1 ? 'movimiento puntual' : 'movimientos puntuales'}
            </p>
          </div>

          {activeCategoryFilter && (
            <button
              onClick={() => onSelectCategoryFilter(null)}
              className="text-xs bg-white/20 hover:bg-white/30 text-white py-1.5 px-3 rounded-lg self-start transition-colors cursor-pointer"
            >
              Mostrar todas las categorías
            </button>
          )}
        </div>

        {/* Gráfico de Dona + Desglose por Categoría y Subcategorías */}
        <div className="md:col-span-8 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-semibold text-slate-800">
                Gráfico y Distribución por Categorías
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Haz clic en una categoría para filtrar
            </span>
          </div>

          {breakdown.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-sm text-slate-400">
              Aún no hay gastos en este mes para mostrar estadísticas.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Gráfico de Torta / Dona Interactivo */}
              <div className="lg:col-span-4 h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={breakdown}
                      dataKey="total"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={44}
                      outerRadius={72}
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
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Barras y Subcategorías */}
              <div className="lg:col-span-8 space-y-2.5 max-h-64 overflow-y-auto pr-1">
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
                      className={`rounded-xl transition-all border ${
                        isSelected
                          ? 'bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-300'
                          : 'border-slate-100 hover:bg-slate-50/70'
                      }`}
                    >
                      <button
                        onClick={() =>
                          onSelectCategoryFilter(isSelected ? null : item.category_id)
                        }
                        className="w-full text-left p-2.5 cursor-pointer"
                      >
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="font-semibold text-slate-700">
                              {item.name}
                            </span>
                            <span className="text-xs text-slate-400">({item.count})</span>
                          </div>
                          <div className="flex items-center gap-2.5">
                            <div className="text-right">
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(item.total)}
                              </span>
                              <span className="block text-[11px] text-slate-400">
                                {categoryEur > 0 ? `${formatEuros(categoryEur)} · ` : ''}
                                {formatBolivares(categoryVes)}
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 w-10 text-right">
                              {item.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${Math.max(item.percentage, 2)}%`,
                              backgroundColor: item.color,
                            }}
                          />
                        </div>
                      </button>

                      {/* Subcategorías internas */}
                      {hasNamedSubcategories && (
                        <div className="px-3.5 pb-2.5 pt-1 border-t border-slate-100/80 flex flex-wrap gap-2">
                          {item.subcategories.map((sub) => (
                            <div
                              key={sub.subcategory_id || 'general'}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-xs"
                            >
                              <CornerDownRight className="w-3 h-3 text-slate-400" />
                              <span className="font-medium text-slate-600">
                                {sub.name}:
                              </span>
                              <span className="font-semibold text-slate-800">
                                {formatCurrency(sub.total)}
                              </span>
                              <span className="text-[11px] text-slate-400">
                                ({sub.percentageOfCategory.toFixed(0)}%)
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tarjeta de Pérdida o Ganancia Cambiaria del Mes */}
      {punctualUsdAmount > 0 && currentBcvRate > 0 && (
        <div className="bg-white rounded-2xl px-6 py-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800">
                Efecto Cambiario del Mes (Pérdida / Ganancia BCV)
              </h4>
              <p className="text-xs text-slate-400">
                Pagaste <strong>{formatBolivares(historicalPunctualVes)}</strong> (que equivalían a{' '}
                <strong>{formatCurrency(punctualUsdAmount)}</strong> el día de cada compra). A la tasa BCV de hoy representan{' '}
                <strong>{formatCurrency(usdValueTodayOfVesPaid)}</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right">
              <span className="text-[11px] text-slate-400 block">
                Diferencia en Bolívares vs. Hoy
              </span>
              <span
                className={`text-xs font-bold ${
                  exchangeDiffVes >= 0 ? 'text-emerald-600' : 'text-red-600'
                }`}
              >
                {exchangeDiffVes >= 0 ? '+' : ''}
                {formatBolivares(exchangeDiffVes)}
              </span>
            </div>

            <span
              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
                exchangeDiffUsd >= 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {exchangeDiffUsd >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5" />
              )}
              {exchangeDiffUsd >= 0 ? 'Ahorro cambiario: +' : 'Variación: '}
              {formatCurrency(exchangeDiffUsd)} ({exchangeDiffPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
