import { getTradeDate } from './tradeDate'
import type { Trade } from '../types/trade'

export type TradePositionInfo = {
  status: 'ongoing' | 'closed' | 'done'
  matchedQty: number
  openQty: number
  realizedPnl: number
}

const contractKey = (trade: Trade): string =>
  `${trade.symbol}|${trade.strike}|${trade.expireDate}|${trade.type}`

type SellLot = {
  tradeId: string
  remainingQty: number
  cost: number
}

const isExpired = (trade: Trade): boolean =>
  trade.expireDate < new Date().toISOString().slice(0, 10)

const sortByTradeDate = (a: Trade, b: Trade): number => {
  const dateCmp = getTradeDate(a).localeCompare(getTradeDate(b))
  if (dateCmp !== 0) return dateCmp
  return a.createdAt - b.createdAt
}

export const buildPositionMap = (trades: Trade[]): Map<string, TradePositionInfo> => {
  const result = new Map<string, TradePositionInfo>()

  const groups = new Map<string, Trade[]>()
  for (const trade of trades) {
    const key = contractKey(trade)
    const group = groups.get(key) ?? []
    group.push(trade)
    groups.set(key, group)
  }

  for (const groupTrades of groups.values()) {
    const sells = groupTrades
      .filter((trade) => trade.direction === 'sell')
      .sort(sortByTradeDate)
    const buys = groupTrades
      .filter((trade) => trade.direction === 'buy')
      .sort(sortByTradeDate)

    const sellQueue: SellLot[] = sells.map((trade) => ({
      tradeId: trade.id,
      remainingQty: trade.quantity,
      cost: trade.cost,
    }))

    const sellMatchedQty = new Map<string, number>(
      sells.map((trade) => [trade.id, 0]),
    )
    const sellRealizedPnl = new Map<string, number>(
      sells.map((trade) => [trade.id, 0]),
    )
    const buyMatchedQty = new Map<string, number>(
      buys.map((trade) => [trade.id, 0]),
    )

    for (const trade of buys) {
      let buyRemaining = trade.quantity

      while (buyRemaining > 0 && sellQueue.length > 0) {
        const lot = sellQueue[0]
        if (lot.remainingQty === 0) {
          sellQueue.shift()
          continue
        }

        const matchQty = Math.min(buyRemaining, lot.remainingQty)
        const pnl = (lot.cost - trade.cost) * matchQty * 100

        lot.remainingQty -= matchQty
        buyRemaining -= matchQty

        sellMatchedQty.set(
          lot.tradeId,
          (sellMatchedQty.get(lot.tradeId) ?? 0) + matchQty,
        )
        sellRealizedPnl.set(
          lot.tradeId,
          (sellRealizedPnl.get(lot.tradeId) ?? 0) + pnl,
        )
        buyMatchedQty.set(
          trade.id,
          (buyMatchedQty.get(trade.id) ?? 0) + matchQty,
        )

        if (lot.remainingQty === 0) sellQueue.shift()
      }
    }

    for (const trade of groupTrades) {
      if (trade.direction === 'sell') {
        const matched = sellMatchedQty.get(trade.id) ?? 0
        const openQty = trade.quantity - matched
        const realizedPnl = sellRealizedPnl.get(trade.id) ?? 0
        const expired = isExpired(trade)

        let status: TradePositionInfo['status']
        if (openQty === 0 && matched > 0) status = 'closed'
        else if (expired) status = 'done'
        else status = 'ongoing'

        result.set(trade.id, { status, matchedQty: matched, openQty, realizedPnl })
      } else {
        const matched = buyMatchedQty.get(trade.id) ?? 0
        const expired = isExpired(trade)

        let status: TradePositionInfo['status']
        if (matched > 0) status = 'closed'
        else if (expired) status = 'done'
        else status = 'ongoing'

        result.set(trade.id, {
          status,
          matchedQty: matched,
          openQty: 0,
          realizedPnl: 0,
        })
      }
    }
  }

  for (const trade of trades) {
    if (!result.has(trade.id)) {
      result.set(trade.id, {
        status: isExpired(trade) ? 'done' : 'ongoing',
        matchedQty: 0,
        openQty: trade.direction === 'sell' ? trade.quantity : 0,
        realizedPnl: 0,
      })
    }
  }

  return result
}

export const isOpenShort = (
  trade: Trade,
  positionMap: Map<string, TradePositionInfo>,
): boolean => {
  const info = positionMap.get(trade.id)
  return (
    trade.direction === 'sell' &&
    (info?.openQty ?? 0) > 0 &&
    !isExpired(trade)
  )
}
