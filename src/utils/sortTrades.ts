import { getTradeDate } from './tradeDate'
import { getTradeStatus } from './tradeStatus'
import type { TradePositionInfo } from './matchPositions'
import type { Trade } from '../types/trade'

export type SortField =
  | 'date'
  | 'symbol'
  | 'strike'
  | 'expire'
  | 'status'
  | 'type'
  | 'direction'
  | 'qty'
  | 'cost'
  | 'lastPrice'
  | 'realized'
  | 'total'

export type SortDirection = 'asc' | 'desc'

type SortContext = {
  lastPrices: Record<string, number>
  positionMap: Map<string, TradePositionInfo>
  calcSignedTotal: (trade: Trade) => number
}

const compareStrings = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' })

const compareNumbers = (a: number, b: number): number => a - b

export const sortTrades = (
  trades: Trade[],
  field: SortField,
  direction: SortDirection,
  context: SortContext,
): Trade[] => {
  const sorted = [...trades].sort((a, b) => {
    let result = 0

    switch (field) {
      case 'date': {
        const dateCmp = compareStrings(getTradeDate(a), getTradeDate(b))
        result = dateCmp !== 0 ? dateCmp : compareNumbers(a.createdAt, b.createdAt)
        break
      }
      case 'symbol':
        result = compareStrings(a.symbol, b.symbol)
        break
      case 'strike':
        result = compareNumbers(a.strike, b.strike)
        break
      case 'expire':
        result = compareStrings(a.expireDate, b.expireDate)
        break
      case 'status':
        result = compareStrings(
          getTradeStatus(a, context.positionMap),
          getTradeStatus(b, context.positionMap),
        )
        break
      case 'type':
        result = compareStrings(a.type, b.type)
        break
      case 'direction':
        result = compareStrings(a.direction, b.direction)
        break
      case 'qty':
        result = compareNumbers(a.quantity, b.quantity)
        break
      case 'cost':
        result = compareNumbers(a.cost, b.cost)
        break
      case 'lastPrice': {
        const priceA = context.lastPrices[a.id] ?? -1
        const priceB = context.lastPrices[b.id] ?? -1
        result = compareNumbers(priceA, priceB)
        break
      }
      case 'realized': {
        const pnlA = context.positionMap.get(a.id)?.realizedPnl ?? 0
        const pnlB = context.positionMap.get(b.id)?.realizedPnl ?? 0
        result = compareNumbers(pnlA, pnlB)
        break
      }
      case 'total':
        result = compareNumbers(
          context.calcSignedTotal(a),
          context.calcSignedTotal(b),
        )
        break
    }

    return direction === 'asc' ? result : -result
  })

  return sorted
}

export const getNextSortDirection = (
  field: SortField,
  currentField: SortField,
  currentDirection: SortDirection,
): SortDirection => {
  if (field === currentField) {
    return currentDirection === 'asc' ? 'desc' : 'asc'
  }

  return field === 'date' || field === 'expire' || field === 'total' || field === 'realized'
    ? 'desc'
    : 'asc'
}
