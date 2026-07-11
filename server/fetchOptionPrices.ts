import type { OptionType } from '../src/types/trade'

export type OptionPriceRequest = {
  id: string
  symbol: string
  strike: number
  expireDate: string
  type: OptionType
}

export type OptionPriceResult = {
  id: string
  lastPrice: number | null
  error?: string
}

type CboeOption = {
  option: string
  last_trade_price?: number | null
  bid?: number | null
  ask?: number | null
}

type CboeOptionsResponse = {
  data?: {
    options?: CboeOption[]
  }
}

const strikesMatch = (a: number, b: number): boolean =>
  Math.abs(a - b) < 0.001

/** OCC option root symbol: SYMBOL + YYMMDD + C/P + strike*1000 (8 digits). */
export const toOccOptionSymbol = (
  symbol: string,
  expireDate: string,
  type: OptionType,
  strike: number,
): string => {
  const [year, month, day] = expireDate.split('-')
  const yymmdd = `${year.slice(2)}${month}${day}`
  const callPut = type === 'call' ? 'C' : 'P'
  const strikePart = String(Math.round(strike * 1000)).padStart(8, '0')
  return `${symbol.toUpperCase()}${yymmdd}${callPut}${strikePart}`
}

const pickPrice = (contract: CboeOption): number | null => {
  if (contract.last_trade_price != null && !Number.isNaN(contract.last_trade_price)) {
    return contract.last_trade_price
  }

  const bid = contract.bid
  const ask = contract.ask
  if (
    bid != null &&
    ask != null &&
    !Number.isNaN(bid) &&
    !Number.isNaN(ask) &&
    bid > 0 &&
    ask > 0
  ) {
    return (bid + ask) / 2
  }

  if (ask != null && !Number.isNaN(ask) && ask > 0) return ask
  if (bid != null && !Number.isNaN(bid) && bid > 0) return bid

  return null
}

const fetchCboeChain = async (symbol: string): Promise<CboeOption[]> => {
  const response = await fetch(
    `https://cdn.cboe.com/api/global/delayed_quotes/options/${encodeURIComponent(symbol.toUpperCase())}.json`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'options-trade-tracker/1.0',
      },
    },
  )

  if (!response.ok) {
    throw new Error(`CBOE ${symbol} returned ${response.status}`)
  }

  const payload = (await response.json()) as CboeOptionsResponse
  return payload.data?.options ?? []
}

export const fetchOptionPrices = async (
  requests: OptionPriceRequest[],
): Promise<OptionPriceResult[]> => {
  const bySymbol = new Map<string, OptionPriceRequest[]>()
  for (const request of requests) {
    const symbol = request.symbol.toUpperCase()
    const group = bySymbol.get(symbol) ?? []
    group.push(request)
    bySymbol.set(symbol, group)
  }

  const chainBySymbol = new Map<string, CboeOption[] | null>()
  const symbolErrors = new Map<string, string>()

  for (const symbol of bySymbol.keys()) {
    try {
      chainBySymbol.set(symbol, await fetchCboeChain(symbol))
    } catch (error) {
      chainBySymbol.set(symbol, null)
      symbolErrors.set(
        symbol,
        error instanceof Error ? error.message : 'CBOE request failed',
      )
    }
  }

  return requests.map((request) => {
    const symbol = request.symbol.toUpperCase()
    const chain = chainBySymbol.get(symbol)
    const symbolError = symbolErrors.get(symbol)

    if (!chain) {
      return {
        id: request.id,
        lastPrice: null,
        error: symbolError ?? 'Option chain unavailable',
      }
    }

    const occ = toOccOptionSymbol(
      symbol,
      request.expireDate,
      request.type,
      request.strike,
    )
    const exact = chain.find((contract) => contract.option === occ)
    const contract =
      exact ??
      chain.find((row) => {
        const match = row.option.match(/(\d{6})([CP])(\d{8})$/)
        if (!match) return false
        const [, yymmdd, cp, strikeRaw] = match
        const [year, month, day] = request.expireDate.split('-')
        const expected = `${year.slice(2)}${month}${day}`
        const typeOk = (request.type === 'call' ? 'C' : 'P') === cp
        const strikeOk = strikesMatch(Number(strikeRaw) / 1000, request.strike)
        return yymmdd === expected && typeOk && strikeOk
      })

    if (!contract) {
      return {
        id: request.id,
        lastPrice: null,
        error: `No CBOE quote for ${occ}`,
      }
    }

    const lastPrice = pickPrice(contract)
    return {
      id: request.id,
      lastPrice,
      error: lastPrice === null ? `No trade/bid/ask for ${occ}` : undefined,
    }
  })
}
