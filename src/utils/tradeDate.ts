import type { Trade } from '../types/trade'

/** Calendar date in the user's local timezone (YYYY-MM-DD). */
export const getLocalDateString = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const isExpireDatePassed = (expireDate: string, now = new Date()): boolean =>
  expireDate < getLocalDateString(now)

export const getTradeDate = (trade: Trade): string =>
  trade.tradeDate ?? new Date(trade.createdAt).toISOString().slice(0, 10)

export const withTradeDate = (trade: Trade): Trade => ({
  ...trade,
  tradeDate: getTradeDate(trade),
})
