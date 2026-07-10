type FrankfurterRateResponse = {
  date: string
  base: string
  quote: string
  rate: number
}

type CurrencyApiResponse = {
  date: string
  usd: { ils: number }
}

export type UsdToIlsRate = {
  rate: number
  date: string
  source: 'BOI' | 'fallback'
}

export const fetchUsdToIls = async (): Promise<UsdToIlsRate> => {
  try {
    const response = await fetch(
      'https://api.frankfurter.dev/v2/rate/USD/ILS?providers=BOI',
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Frankfurter request failed')

    const data: FrankfurterRateResponse = await response.json()
    return { rate: data.rate, date: data.date, source: 'BOI' }
  } catch {
    const response = await fetch(
      'https://cdn.jsdelivr.net/gh/irfanokr/currency-api@main/v1/currencies/usd.min.json',
      { cache: 'no-store' },
    )
    if (!response.ok) throw new Error('Fallback exchange rate request failed')

    const data: CurrencyApiResponse = await response.json()
    return { rate: data.usd.ils, date: data.date, source: 'fallback' }
  }
}
