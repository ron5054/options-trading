import type { Trade } from '../types/trade'

export type OptionPriceResult = {
  id: string
  lastPrice: number | null
  error?: string
}

export const fetchOptionPrices = async (
  trades: Trade[],
): Promise<OptionPriceResult[]> => {
  const response = await fetch('/api/option-prices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      trades: trades.map((trade) => ({
        id: trade.id,
        symbol: trade.symbol,
        strike: trade.strike,
        expireDate: trade.expireDate,
        type: trade.type,
      })),
    }),
  })

  if (!response.ok) {
    throw new Error('Failed to fetch option prices')
  }

  const data = (await response.json()) as { results: OptionPriceResult[] }
  return data.results
}
