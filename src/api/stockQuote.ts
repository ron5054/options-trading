export type StockQuote = {
  symbol: string
  price: number
}

export const fetchStockQuote = async (symbol: string): Promise<StockQuote> => {
  const response = await fetch(
    `/api/stock-quote?symbol=${encodeURIComponent(symbol)}`,
  )

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error ?? 'Failed to fetch stock quote')
  }

  return (await response.json()) as StockQuote
}
