import type { IncomingMessage, ServerResponse } from 'node:http'
import {
  fetchOptionPrices,
  type OptionPriceRequest,
} from './fetchOptionPrices'

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString()
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })

const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

export const handleOptionPricesRequest = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' })
    return
  }

  try {
    const body = await readBody(req)
    const { trades } = JSON.parse(body) as { trades: OptionPriceRequest[] }

    if (!Array.isArray(trades) || trades.length === 0) {
      sendJson(res, 400, { error: 'trades array is required' })
      return
    }

    const results = await fetchOptionPrices(trades)
    sendJson(res, 200, { results })
  } catch {
    sendJson(res, 500, { error: 'Failed to fetch option prices' })
  }
}

export const optionPricesApiMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void => {
  if (req.url !== '/api/option-prices') {
    next()
    return
  }

  handleOptionPricesRequest(req, res).catch(() => {
    sendJson(res, 500, { error: 'Failed to fetch option prices' })
  })
}
