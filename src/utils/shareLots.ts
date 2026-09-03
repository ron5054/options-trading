import {
  getOpenShareLotsForSymbol,
  type ShareLot,
} from '../db/shareLots'
import type { Trade } from '../types/trade'
import type { TradePositionInfo } from './matchPositions'
import { isExpireDatePassed } from './tradeDate'

export const calcAssignmentBasisPerShare = (putTrade: Trade): number =>
  putTrade.strike

export const calcAssignmentShareQuantity = (openQty: number): number =>
  openQty * 100

const wasAlreadyCalledAway = (trade: Trade, lots: ShareLot[]): boolean =>
  lots.some((lot) => lot.closedByTradeId === trade.id)

/** Open lots that already existed when this call expired. */
const getLotsEligibleToCallAway = (
  lots: ShareLot[],
  symbol: string,
  callExpireDate: string,
): ShareLot[] =>
  getOpenShareLotsForSymbol(lots, symbol).filter(
    (lot) => lot.assignedAt <= callExpireDate,
  )

export const canMarkAssigned = (
  trade: Trade,
  positionMap: Map<string, TradePositionInfo>,
  lots: ShareLot[],
): boolean => {
  if (trade.direction !== 'sell' || trade.type !== 'put') return false
  if (!isExpireDatePassed(trade.expireDate)) return false
  const openQty = positionMap.get(trade.id)?.openQty ?? 0
  if (openQty <= 0) return false
  return !lots.some((lot) => lot.assignedFromTradeId === trade.id)
}

export const canMarkCalledAway = (
  trade: Trade,
  positionMap: Map<string, TradePositionInfo>,
  lots: ShareLot[],
): boolean => {
  if (trade.direction !== 'sell' || trade.type !== 'call') return false
  if (!isExpireDatePassed(trade.expireDate)) return false
  if (wasAlreadyCalledAway(trade, lots)) return false
  const openQty = positionMap.get(trade.id)?.openQty ?? 0
  if (openQty <= 0) return false

  const eligibleLots = getLotsEligibleToCallAway(
    lots,
    trade.symbol,
    trade.expireDate,
  )
  const openShares = eligibleLots.reduce((sum, lot) => sum + lot.quantity, 0)
  return openShares >= openQty * 100
}

/** Pick open lots (oldest first) covering at least `sharesNeeded`. */
export const pickLotsToClose = (
  lots: ShareLot[],
  symbol: string,
  sharesNeeded: number,
  callExpireDate?: string,
): ShareLot[] => {
  const openLots =
    callExpireDate == null
      ? getOpenShareLotsForSymbol(lots, symbol)
      : getLotsEligibleToCallAway(lots, symbol, callExpireDate)
  const selected: ShareLot[] = []
  let remaining = sharesNeeded

  for (const lot of openLots) {
    if (remaining <= 0) break
    selected.push(lot)
    remaining -= lot.quantity
  }

  if (remaining > 0) return []
  return selected
}

export type HoldingSummary = {
  lots: ShareLot[]
  quantity: number
  avgBasisPerShare: number
  totalCost: number
  firstAssignedAt: string
  hasOpenCoveredCall: boolean
}

export type HoldingMarkToMarket = {
  price: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPnlPercent: number
}

export const calcHoldingMarkToMarket = (
  holding: HoldingSummary,
  price: number,
): HoldingMarkToMarket => {
  const marketValue = price * holding.quantity
  const unrealizedPnl = marketValue - holding.totalCost
  const unrealizedPnlPercent =
    holding.avgBasisPerShare === 0
      ? 0
      : ((price - holding.avgBasisPerShare) / holding.avgBasisPerShare) * 100

  return {
    price,
    marketValue,
    unrealizedPnl,
    unrealizedPnlPercent,
  }
}

/** Break-even share price after applying all-time ticker premium. */
export const calcPremiumBreakEven = (
  avgBasisPerShare: number,
  quantity: number,
  premiumAfterCommissions: number,
): number => {
  if (quantity <= 0) return avgBasisPerShare
  return avgBasisPerShare - premiumAfterCommissions / quantity
}

export const calcHoldingSummary = (
  lots: ShareLot[],
  symbol: string,
  trades: Trade[],
  positionMap: Map<string, TradePositionInfo>,
): HoldingSummary | null => {
  const openLots = getOpenShareLotsForSymbol(lots, symbol)
  if (openLots.length === 0) return null

  const quantity = openLots.reduce((sum, lot) => sum + lot.quantity, 0)
  const totalCost = openLots.reduce(
    (sum, lot) => sum + lot.quantity * lot.basisPerShare,
    0,
  )
  const avgBasisPerShare = totalCost / quantity
  const firstAssignedAt = openLots[0].assignedAt

  const hasOpenCoveredCall = trades.some((trade) => {
    if (trade.symbol.toUpperCase() !== symbol.toUpperCase()) return false
    if (trade.type !== 'call' || trade.direction !== 'sell') return false
    const info = positionMap.get(trade.id)
    return (info?.openQty ?? 0) > 0 && info?.status === 'ongoing'
  })

  return {
    lots: openLots,
    quantity,
    avgBasisPerShare,
    totalCost,
    firstAssignedAt,
    hasOpenCoveredCall,
  }
}
