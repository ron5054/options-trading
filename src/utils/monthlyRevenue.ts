import { getLocalDateString, getTradeDate } from './tradeDate'
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

export const getFirstTradeDate = (trades: Trade[]): string | null => {
  if (trades.length === 0) return null
  return trades.reduce((earliest, trade) => {
    const date = getTradeDate(trade)
    return date < earliest ? date : earliest
  }, getTradeDate(trades[0]))
}

const parseLocalDate = (
  iso: string,
): { year: number; month: number; day: number } => {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

const daysInMonth = (year: number, month: number): number =>
  new Date(year, month, 0).getDate()

export const getPeriodEndDate = (
  yearFilter: YearFilter,
  now = new Date(),
): string => {
  const today = getLocalDateString(now)
  if (yearFilter === 'all') return today
  const yearEnd = `${yearFilter}-12-31`
  return yearEnd < today ? yearEnd : today
}

/** Calendar months from first trade through the period end, prorating stub months. */
export const getElapsedMonths = (firstIso: string, endIso: string): number => {
  if (endIso < firstIso) return 0

  const start = parseLocalDate(firstIso)
  const end = parseLocalDate(endIso)
  const startDays = daysInMonth(start.year, start.month)
  const endDays = daysInMonth(end.year, end.month)

  if (start.year === end.year && start.month === end.month) {
    return (end.day - start.day + 1) / startDays
  }

  const startFraction = (startDays - start.day + 1) / startDays
  const endFraction = end.day / endDays
  const fullMonths =
    (end.year - start.year) * 12 + (end.month - start.month) - 1

  return startFraction + fullMonths + endFraction
}

export const formatShortTradeDate = (iso: string): string => {
  const { year, month, day } = parseLocalDate(iso)
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
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
