import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { fetchUsdToIls, type UsdToIlsRate } from '../api/exchangeRate'
import {
  filterTradesByYear,
  getMonthlyRevenue,
  getTradeYears,
  type MonthlyRevenue,
  type YearFilter,
} from '../utils/monthlyRevenue'
import {
  calcTradeSummary,
  formatCurrency,
  formatIls,
} from '../utils/tradeCalculations'
import type { Trade } from '../types/trade'

type MonthlyRevenueChartProps = {
  trades: Trade[]
}

type TooltipProps = {
  active?: boolean
  payload?: Array<{ payload: MonthlyRevenue }>
  exchangeRate: UsdToIlsRate | null
}

type AmountRowProps = {
  label: string
  usd: number
  exchangeRate: UsdToIlsRate | null
  highlight?: boolean
}

const AmountRow = ({ label, usd, exchangeRate, highlight = false }: AmountRowProps) => (
  <div className={highlight ? 'chart-tooltip-highlight' : undefined}>
    <dt>{label}</dt>
    <dd>
      <span>{formatCurrency(usd)}</span>
      {exchangeRate && (
        <span className="chart-tooltip-ils">
          {formatIls(usd * exchangeRate.rate)}
        </span>
      )}
    </dd>
  </div>
)

const ChartTooltip = ({ active, payload, exchangeRate }: TooltipProps) => {
  if (!active || !payload?.length) return null

  const data = payload[0].payload

  return (
    <div className="chart-tooltip">
      <p className="chart-tooltip-title">{data.label}</p>
      <dl className="chart-tooltip-list">
        <AmountRow label="Net" usd={data.netTotal} exchangeRate={exchangeRate} />
        <AmountRow label="Commissions" usd={-data.commissions} exchangeRate={exchangeRate} />
        <AmountRow
          label="Net after commissions"
          usd={data.netAfterCommissions}
          exchangeRate={exchangeRate}
        />
        <AmountRow label="Tax (25%)" usd={-data.tax} exchangeRate={exchangeRate} />
        <AmountRow
          label="After tax"
          usd={data.afterTax}
          exchangeRate={exchangeRate}
          highlight
        />
        <div>
          <dt>Trades</dt>
          <dd>{data.tradeCount}</dd>
        </div>
      </dl>
      {exchangeRate && (
        <p className="chart-tooltip-rate">
          Rate: {exchangeRate.rate.toFixed(2)} ILS/USD ({exchangeRate.date})
        </p>
      )}
    </div>
  )
}

const formatYAxisIls = (value: number): string =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

const AllTimePremiumsIls = ({
  afterTax,
  exchangeRate,
  rateError,
  periodLabel,
}: {
  afterTax: number
  exchangeRate: UsdToIlsRate | null
  rateError: string | null
  periodLabel: string
}) => {
  const afterTaxIls = exchangeRate ? afterTax * exchangeRate.rate : null

  return (
    <div className="trades-stats-row stats-summary-row">
      <div className="stat-total">
        <span className="stat-total-label">
          {periodLabel} net premiums after commissions and tax (ILS)
        </span>
        <span
          className={[
            'stat-total-value',
            afterTaxIls == null
              ? ''
              : afterTaxIls >= 0
                ? 'total-positive'
                : 'total-negative',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {afterTaxIls != null ? formatIls(afterTaxIls) : '—'}
        </span>
        <span className="stat-total-note">
          {formatCurrency(afterTax)} USD after commissions and tax
          {exchangeRate
            ? ` · BOI rate ${exchangeRate.rate.toFixed(2)} (${exchangeRate.date})`
            : rateError
              ? ` · ${rateError}`
              : ' · loading USD/ILS rate'}
        </span>
      </div>
    </div>
  )
}

export const MonthlyRevenueChart = ({ trades }: MonthlyRevenueChartProps) => {
  const [exchangeRate, setExchangeRate] = useState<UsdToIlsRate | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)
  const [yearFilter, setYearFilter] = useState<YearFilter>('all')

  const years = useMemo(() => getTradeYears(trades), [trades])
  const filteredTrades = useMemo(
    () => filterTradesByYear(trades, yearFilter),
    [trades, yearFilter],
  )
  const data = useMemo(
    () => getMonthlyRevenue(filteredTrades),
    [filteredTrades],
  )
  const { afterTax } = useMemo(
    () => calcTradeSummary(filteredTrades),
    [filteredTrades],
  )
  const periodLabel = yearFilter === 'all' ? 'All-time' : String(yearFilter)

  const chartData = useMemo(() => {
    if (!exchangeRate) return []
    return data.map((entry) => ({
      ...entry,
      afterTaxIls: entry.afterTax * exchangeRate.rate,
    }))
  }, [data, exchangeRate])

  useEffect(() => {
    fetchUsdToIls()
      .then(setExchangeRate)
      .catch(() => setRateError('Could not load USD/ILS rate'))
  }, [])

  useEffect(() => {
    if (yearFilter !== 'all' && !years.includes(yearFilter)) {
      setYearFilter('all')
    }
  }, [years, yearFilter])

  const yearToolbar = (
    <div className="stats-toolbar">
      <div className="status-filter">
        <span className="status-filter-label">Year</span>
        <div className="status-filter-options">
          <button
            type="button"
            className={`status-filter-btn ${yearFilter === 'all' ? 'active' : ''}`}
            onClick={() => setYearFilter('all')}
          >
            All time
          </button>
          {years.map((year) => (
            <button
              key={year}
              type="button"
              className={`status-filter-btn ${yearFilter === year ? 'active' : ''}`}
              onClick={() => setYearFilter(year)}
            >
              {year}
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  if (data.length === 0) {
    return (
      <div>
        {yearToolbar}
        <AllTimePremiumsIls
          afterTax={afterTax}
          exchangeRate={exchangeRate}
          rateError={rateError}
          periodLabel={periodLabel}
        />
        <div className="empty-state">
          <p>No trades to chart yet.</p>
        </div>
      </div>
    )
  }

  if (!exchangeRate) {
    return (
      <div>
        {yearToolbar}
        <AllTimePremiumsIls
          afterTax={afterTax}
          exchangeRate={exchangeRate}
          rateError={rateError}
          periodLabel={periodLabel}
        />
        {rateError ? (
          <p className="price-error">{rateError}</p>
        ) : (
          <p className="loading">Loading ILS exchange rate...</p>
        )}
      </div>
    )
  }

  return (
    <div>
      {yearToolbar}
      <AllTimePremiumsIls
        afterTax={afterTax}
        exchangeRate={exchangeRate}
        rateError={rateError}
        periodLabel={periodLabel}
      />
      <p className="chart-rate-note">
        After tax (ILS) · BOI rate {exchangeRate.rate.toFixed(2)} ({exchangeRate.date})
      </p>
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={(value, index) => {
                const entry = chartData[index]
                return entry ? `${value} (${entry.tradeCount} trades)` : String(value)
              }}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxisIls}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              content={<ChartTooltip exchangeRate={exchangeRate} />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="afterTaxIls" radius={[4, 4, 0, 0]}>
              {chartData.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.afterTaxIls >= 0 ? 'var(--buy)' : 'var(--sell)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
