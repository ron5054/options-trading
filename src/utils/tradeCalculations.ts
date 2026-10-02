import {
  buildPositionMap,
  isOpenLong,
  isOpenShort,
  type TradePositionInfo,
} from './matchPositions'
import { getTradeDate } from './tradeDate'
import type { OptionType, Trade, TradeDirection } from '../types/trade'

export const TAX_RATE = 0.25
export const COMMISSION_PER_CONTRACT_BEFORE = 2
export const COMMISSION_PER_CONTRACT_FROM_OCT_2026 = 1
export const COMMISSION_RATE_CUTOVER = '2026-10-01'

export const getCommissionPerContract = (tradeDate: string): number =>
  tradeDate >= COMMISSION_RATE_CUTOVER
    ? COMMISSION_PER_CONTRACT_FROM_OCT_2026
    : COMMISSION_PER_CONTRACT_BEFORE

export const calcTradeCommission = (trade: Trade): number =>
  trade.quantity * getCommissionPerContract(getTradeDate(trade))

export const calcTotal = (trade: Trade): number =>
  trade.cost * trade.quantity * 100

export const calcSignedTotal = (trade: Trade): number =>
  trade.direction === 'sell' ? calcTotal(trade) : -calcTotal(trade)

export type OpenOptionPosition = {
  type: OptionType
  direction: TradeDirection
  strike: number
  expireDate: string
  openQty: number
  premium: number
  capitalAtRisk: number
}

const openOptionKey = (trade: Trade): string =>
  `${trade.type}|${trade.direction}|${trade.strike}|${trade.expireDate}`

export const getOpenOptionPositions = (
  trades: Trade[],
  symbol: string,
  positionMap: Map<string, TradePositionInfo>,
): OpenOptionPosition[] => {
  const normalized = symbol.toUpperCase()
  const buckets = new Map<string, OpenOptionPosition>()

  for (const trade of trades) {
    if (trade.symbol.toUpperCase() !== normalized) continue

    const short = isOpenShort(trade, positionMap)
    const long = isOpenLong(trade, positionMap)
    if (!short && !long) continue

    const openQty = short
      ? (positionMap.get(trade.id)?.openQty ?? 0)
      : trade.quantity - (positionMap.get(trade.id)?.matchedQty ?? 0)
    if (openQty <= 0) continue

    const premium = (short ? 1 : -1) * trade.cost * openQty * 100
    const capitalAtRisk =
      short && trade.type === 'put' ? trade.strike * openQty * 100 : 0
    const key = openOptionKey(trade)
    const existing = buckets.get(key)

    if (existing) {
      existing.openQty += openQty
      existing.premium += premium
      existing.capitalAtRisk += capitalAtRisk
      continue
    }

    buckets.set(key, {
      type: trade.type,
      direction: trade.direction,
      strike: trade.strike,
      expireDate: trade.expireDate,
      openQty,
      premium,
      capitalAtRisk,
    })
  }

  return Array.from(buckets.values()).sort((a, b) => {
    const expire = a.expireDate.localeCompare(b.expireDate)
    if (expire !== 0) return expire
    if (a.type !== b.type) return a.type === 'put' ? -1 : 1
    return a.strike - b.strike
  })
}

/** Open short put notional: strike × open contracts × 100 (calls are covered) */
export const calcOpenCapitalAtRisk = (trades: Trade[]): number => {
  const positionMap = buildPositionMap(trades)

  return trades.reduce((sum, trade) => {
    if (trade.type !== 'put' || !isOpenShort(trade, positionMap)) return sum
    const openQty = positionMap.get(trade.id)?.openQty ?? 0
    return sum + trade.strike * openQty * 100
  }, 0)
}

export type TradeSummary = {
  netTotal: number
  contractCount: number
  commissions: number
  netAfterCommissions: number
  tax: number
  afterTax: number
  tradeCount: number
}

export const calcTradeSummary = (trades: Trade[]): TradeSummary => {
  const netTotal = trades.reduce(
    (sum, trade) => sum + calcSignedTotal(trade),
    0,
  )
  const contractCount = trades.reduce(
    (sum, trade) => sum + trade.quantity,
    0,
  )
  const commissions = trades.reduce(
    (sum, trade) => sum + calcTradeCommission(trade),
    0,
  )
  const netAfterCommissions = netTotal - commissions
  const tax = netTotal > 0 ? netTotal * TAX_RATE : 0
  const afterTax = netTotal - commissions - tax

  return {
    netTotal,
    contractCount,
    commissions,
    netAfterCommissions,
    tax,
    afterTax,
    tradeCount: trades.length,
  }
}

export type SymbolSummary = {
  symbol: string
  netTotal: number
  commissions: number
  premiumAfterCommissions: number
  tradeCount: number
  contractCount: number
  firstTradeDate: string | null
  openCapitalAtRisk: number
}

export const calcSymbolSummary = (
  trades: Trade[],
  symbol: string,
): SymbolSummary => {
  const normalized = symbol.toUpperCase()
  const symbolTrades = trades.filter(
    (trade) => trade.symbol.toUpperCase() === normalized,
  )
  const summary = calcTradeSummary(symbolTrades)
  const firstTradeDate =
    symbolTrades.length === 0
      ? null
      : symbolTrades.reduce((earliest, trade) => {
          const date = getTradeDate(trade)
          return date < earliest ? date : earliest
        }, getTradeDate(symbolTrades[0]))

  return {
    symbol: normalized,
    netTotal: summary.netTotal,
    commissions: summary.commissions,
    premiumAfterCommissions: summary.netAfterCommissions,
    tradeCount: summary.tradeCount,
    contractCount: summary.contractCount,
    firstTradeDate,
    openCapitalAtRisk: calcOpenCapitalAtRisk(symbolTrades),
  }
}

export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)

export const formatIls = (value: number): string =>
  new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
  }).format(value)
