import type { TradePositionInfo } from './matchPositions'
import { isExpireDatePassed } from './tradeDate'
import type { Trade } from '../types/trade'

export type TradeStatus = 'ongoing' | 'closed' | 'done'

export const getTradeStatus = (
  trade: Trade,
  positionMap: Map<string, TradePositionInfo>,
): TradeStatus => {
  const info = positionMap.get(trade.id)
  if (info) return info.status

  return isExpireDatePassed(trade.expireDate) ? 'done' : 'ongoing'
}

export const getStatusLabel = (status: TradeStatus): string => {
  switch (status) {
    case 'ongoing':
      return 'Ongoing'
    case 'closed':
      return 'Closed'
    case 'done':
      return 'Done'
  }
}

export const TRADE_STATUSES: TradeStatus[] = ['ongoing', 'closed', 'done']

export type StatusFilter = 'all' | TradeStatus
