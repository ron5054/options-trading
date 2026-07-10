import type { Trade } from '../types/trade'

export const getTradeDate = (trade: Trade): string =>
  trade.tradeDate ?? new Date(trade.createdAt).toISOString().slice(0, 10)

export const withTradeDate = (trade: Trade): Trade => ({
  ...trade,
  tradeDate: getTradeDate(trade),
})
