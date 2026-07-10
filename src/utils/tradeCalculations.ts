import type { Trade } from '../types/trade'

export const TAX_RATE = 0.25
export const COMMISSION_PER_CONTRACT = 2

export const calcTotal = (trade: Trade): number =>
  trade.cost * trade.quantity * 100

export const calcSignedTotal = (trade: Trade): number =>
  trade.direction === 'sell' ? calcTotal(trade) : -calcTotal(trade)

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
  const commissions = contractCount * COMMISSION_PER_CONTRACT
  const netAfterCommissions = netTotal - commissions
  const tax = netAfterCommissions > 0 ? netAfterCommissions * TAX_RATE : 0
  const afterTax = netAfterCommissions - tax

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
