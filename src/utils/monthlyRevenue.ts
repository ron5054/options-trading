import { getTradeDate } from './tradeDate'
import { calcTradeSummary } from './tradeCalculations'
import type { Trade } from '../types/trade'

export type MonthlyRevenue = {
  month: string
  label: string
  netTotal: number
  commissions: number
  netAfterCommissions: number
  tax: number
  afterTax: number
  tradeCount: number
}

const formatMonthLabel = (month: string): string => {
  const [year, monthNum] = month.split('-').map(Number)
  return new Date(year, monthNum - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
  })
}

export type YearFilter = 'all' | number

export const getTradeYears = (trades: Trade[]): number[] => {
  const years = new Set<number>()

  for (const trade of trades) {
    years.add(Number(getTradeDate(trade).slice(0, 4)))
  }

  return [...years].sort((a, b) => b - a)
}

export const filterTradesByYear = (
  trades: Trade[],
  year: YearFilter,
): Trade[] => {
  if (year === 'all') return trades
  const prefix = `${year}-`
  return trades.filter((trade) => getTradeDate(trade).startsWith(prefix))
}

export const getMonthlyRevenue = (trades: Trade[]): MonthlyRevenue[] => {
  const byMonth = new Map<string, Trade[]>()

  for (const trade of trades) {
    const month = getTradeDate(trade).slice(0, 7)
    const group = byMonth.get(month) ?? []
    group.push(trade)
    byMonth.set(month, group)
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthTrades]) => {
      const summary = calcTradeSummary(monthTrades)

      return {
        month,
        label: formatMonthLabel(month),
        netTotal: summary.netTotal,
        commissions: summary.commissions,
        netAfterCommissions: summary.netAfterCommissions,
        tax: summary.tax,
        afterTax: summary.afterTax,
        tradeCount: summary.tradeCount,
      }
    })
}
