import YahooFinance from 'yahoo-finance2'
import type { OptionType } from '../src/types/trade'

const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] })

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

const strikesMatch = (a: number, b: number): boolean =>
  Math.abs(a - b) < 0.001

const toDateKey = (date: Date): string => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const findLastPrice = (
  options: Awaited<ReturnType<typeof yahooFinance.options>>,
  strike: number,
  type: OptionType,
): number | null => {
  const chain = options.options[0]
  if (!chain) return null

  const contracts = type === 'call' ? chain.calls : chain.puts
  const match = contracts.find((contract) => strikesMatch(contract.strike, strike))

  if (match?.lastPrice != null && !Number.isNaN(match.lastPrice)) {
    return match.lastPrice
  }

  return null
}

const getExpirationDate = async (
  symbol: string,
  expireDate: string,
  expirationCache: Map<string, Date[]>,
): Promise<Date | null> => {
  if (!expirationCache.has(symbol)) {
    const overview = await yahooFinance.options(symbol)
    expirationCache.set(symbol, overview.expirationDates)
  }

  const expirationDates = expirationCache.get(symbol) ?? []
  return (
    expirationDates.find((date) => toDateKey(date) === expireDate) ?? null
  )
}

export const fetchOptionPrices = async (
  requests: OptionPriceRequest[],
): Promise<OptionPriceResult[]> => {
  const groups = new Map<string, OptionPriceRequest[]>()
  const expirationCache = new Map<string, Date[]>()
  const chainCache = new Map<string, Awaited<ReturnType<typeof yahooFinance.options>> | null>()
  const requestErrors = new Map<string, string>()

  for (const request of requests) {
    const key = `${request.symbol}|${request.expireDate}`
    const group = groups.get(key) ?? []
    group.push(request)
    groups.set(key, group)
  }

  for (const [key, groupRequests] of groups) {
    const [symbol, expireDate] = key.split('|')

    if (!chainCache.has(key)) {
      try {
        const expiration = await getExpirationDate(
          symbol,
          expireDate,
          expirationCache,
        )

        if (!expiration) {
          chainCache.set(key, null)
          for (const request of groupRequests) {
            requestErrors.set(
              request.id,
              `No Yahoo expiration matching ${expireDate} for ${symbol}`,
            )
          }
        } else {
          const options = await yahooFinance.options(symbol, { date: expiration })
          chainCache.set(key, options)
        }
      } catch (error) {
        chainCache.set(key, null)
        const message =
          error instanceof Error ? error.message : 'Yahoo Finance request failed'
        for (const request of groupRequests) {
          requestErrors.set(request.id, message)
        }
      }
    }
  }

  const priceCache = new Map<string, number | null>()

  for (const [key, groupRequests] of groups) {
    const options = chainCache.get(key)

    for (const request of groupRequests) {
      const contractKey = `${key}|${request.strike}|${request.type}`

      if (priceCache.has(contractKey)) continue

      if (!options) {
        priceCache.set(contractKey, null)
        continue
      }

      priceCache.set(
        contractKey,
        findLastPrice(options, request.strike, request.type),
      )
    }
  }

  return requests.map((request) => {
    const contractKey = `${request.symbol}|${request.expireDate}|${request.strike}|${request.type}`
    const lastPrice = priceCache.get(contractKey) ?? null
    const fetchError = requestErrors.get(request.id)

    return {
      id: request.id,
      lastPrice,
      error:
        lastPrice === null
          ? (fetchError ?? 'Price not found')
          : undefined,
    }
  })
}
