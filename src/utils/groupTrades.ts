import { getTradeDate } from './tradeDate'
import type { Trade } from '../types/trade'

export type DisplayTrade = {
  trades: Trade[]
  trade: Trade
  isGrouped: boolean
}

export const getTradeGroupKey = (trade: Trade): string =>
  `${trade.symbol}|${trade.strike}|${trade.expireDate}|${trade.type}|${trade.direction}`

const mergeTradeGroup = (trades: Trade[]): Trade => {
  const latest = [...trades].sort((a, b) => b.createdAt - a.createdAt)[0]
  const totalQty = trades.reduce((sum, trade) => sum + trade.quantity, 0)
  const weightedCost =
    trades.reduce((sum, trade) => sum + trade.cost * trade.quantity, 0) / totalQty

  return {
    ...latest,
    id: `group:${getTradeGroupKey(latest)}`,
    quantity: totalQty,
    cost: weightedCost,
    createdAt: Math.max(...trades.map((trade) => trade.createdAt)),
  }
}

export const getGroupedTradeDateLabel = (trades: Trade[]): string => {
  const dates = [...new Set(trades.map((trade) => getTradeDate(trade)))].sort()
  if (dates.length <= 1) return dates[0] ?? ''
  return `${dates[0]} – ${dates[dates.length - 1]}`
}

export const toDisplayTrades = (
  trades: Trade[],
  groupEnabled: boolean,
): DisplayTrade[] => {
  if (!groupEnabled) {
    return trades.map((trade) => ({
      trades: [trade],
      trade,
      isGrouped: false,
    }))
  }

  const buckets = new Map<string, Trade[]>()

  for (const trade of trades) {
    const key = getTradeGroupKey(trade)
    const bucket = buckets.get(key) ?? []
    bucket.push(trade)
    buckets.set(key, bucket)
  }

  return Array.from(buckets.values()).map((groupTrades) => ({
    trades: groupTrades,
    trade:
      groupTrades.length === 1 ? groupTrades[0] : mergeTradeGroup(groupTrades),
    isGrouped: groupTrades.length > 1,
  }))
}
