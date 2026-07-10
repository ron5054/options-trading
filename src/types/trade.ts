export type OptionType = 'call' | 'put'
export type TradeDirection = 'buy' | 'sell'

export type Trade = {
  id: string
  symbol: string
  strike: number
  expireDate: string
  tradeDate?: string
  type: OptionType
  direction: TradeDirection
  quantity: number
  cost: number
  createdAt: number
}

export type NewTrade = Omit<Trade, 'id' | 'createdAt'>
