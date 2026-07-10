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
import { getMonthlyRevenue, type MonthlyRevenue } from '../utils/monthlyRevenue'
import { formatCurrency, formatIls } from '../utils/tradeCalculations'
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

const formatYAxis = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)

export const MonthlyRevenueChart = ({ trades }: MonthlyRevenueChartProps) => {
  const [exchangeRate, setExchangeRate] = useState<UsdToIlsRate | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)

  const data = useMemo(() => getMonthlyRevenue(trades), [trades])

  useEffect(() => {
    fetchUsdToIls()
      .then(setExchangeRate)
      .catch(() => setRateError('Could not load USD/ILS rate'))
  }, [])

  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>No trades to chart yet.</p>
      </div>
    )
  }

  return (
    <div>
      {exchangeRate && (
        <p className="chart-rate-note">
          ILS amounts use BOI rate {exchangeRate.rate.toFixed(2)} ({exchangeRate.date})
        </p>
      )}
      {rateError && <p className="price-error">{rateError}</p>}
      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tickFormatter={(value, index) => {
                const entry = data[index]
                return entry ? `${value} (${entry.tradeCount} trades)` : String(value)
              }}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={formatYAxis}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              content={<ChartTooltip exchangeRate={exchangeRate} />}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="afterTax" radius={[4, 4, 0, 0]}>
              {data.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={entry.afterTax >= 0 ? 'var(--buy)' : 'var(--sell)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
