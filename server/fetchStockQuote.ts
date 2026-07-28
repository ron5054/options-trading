export type StockQuote = {
  symbol: string
  price: number
}

type CboeQuoteResponse = {
  data?: {
    symbol?: string
    current_price?: number | null
    close?: number | null
  }
}

export const fetchStockQuote = async (symbol: string): Promise<StockQuote> => {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) throw new Error('Symbol is required')

  const response = await fetch(
    `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(normalized)}.json`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'options-trade-tracker/1.0',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`CBOE ${normalized} returned ${response.status}`)
  }

  const payload = (await response.json()) as CboeQuoteResponse
  const price = payload.data?.current_price ?? payload.data?.close ?? null

  if (price == null || Number.isNaN(Number(price))) {
    throw new Error(`No CBOE price for ${normalized}`)
  }

  return {
    symbol: payload.data?.symbol?.toUpperCase() ?? normalized,
    price: Number(price),
  }
}
