import type { NewTrade, OptionType, Trade, TradeDirection } from '../types/trade'
import { supabase } from '../lib/supabase'
import { getTradeDate, withTradeDate } from '../utils/tradeDate'

type TradeRow = {
  id: string
  symbol: string
  strike: number
  expire_date: string
  trade_date: string | null
  type: OptionType
  direction: TradeDirection
  quantity: number
  cost: number
  created_at: number
}

const INDEXED_DB_NAME = 'option-trades'
const INDEXED_DB_STORE = 'trades'
const MIGRATION_FLAG_KEY = 'option-trades:indexeddb-migrated'

const toTrade = (row: TradeRow): Trade =>
  withTradeDate({
    id: row.id,
    symbol: row.symbol,
    strike: Number(row.strike),
    expireDate: row.expire_date,
    tradeDate: row.trade_date ?? undefined,
    type: row.type,
    direction: row.direction,
    quantity: Number(row.quantity),
    cost: Number(row.cost),
    createdAt: Number(row.created_at),
  })

const toRow = (trade: Trade): TradeRow => ({
  id: trade.id,
  symbol: trade.symbol,
  strike: trade.strike,
  expire_date: trade.expireDate,
  trade_date: trade.tradeDate ?? null,
  type: trade.type,
  direction: trade.direction,
  quantity: trade.quantity,
  cost: trade.cost,
  created_at: trade.createdAt,
})

const sortTrades = (trades: Trade[]): Trade[] =>
  [...trades].sort((a, b) => {
    const dateA = getTradeDate(a)
    const dateB = getTradeDate(b)
    if (dateA !== dateB) return dateB.localeCompare(dateA)
    return b.createdAt - a.createdAt
  })

const readIndexedDbTrades = (): Promise<Trade[]> =>
  new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve([])
      return
    }

    const request = indexedDB.open(INDEXED_DB_NAME)
    request.onerror = () => resolve([])
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(INDEXED_DB_STORE)) {
        db.close()
        resolve([])
        return
      }

      const tx = db.transaction(INDEXED_DB_STORE, 'readonly')
      const store = tx.objectStore(INDEXED_DB_STORE)
      const getAll = store.getAll()
      getAll.onerror = () => {
        db.close()
        resolve([])
      }
      getAll.onsuccess = () => {
        const trades = (getAll.result as Trade[]).map(withTradeDate)
        db.close()
        resolve(trades)
      }
    }
  })

let migrationPromise: Promise<void> | null = null

const migrateIndexedDbIfNeeded = async (): Promise<void> => {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(MIGRATION_FLAG_KEY)) {
    return
  }

  const { count, error: countError } = await supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })

  if (countError) throw countError
  if ((count ?? 0) > 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, '1')
    return
  }

  const localTrades = await readIndexedDbTrades()
  if (localTrades.length === 0) {
    localStorage.setItem(MIGRATION_FLAG_KEY, '1')
    return
  }

  const { error } = await supabase.from('trades').upsert(localTrades.map(toRow))
  if (error) throw error

  localStorage.setItem(MIGRATION_FLAG_KEY, '1')
}

const ensureMigrated = async (): Promise<void> => {
  if (!migrationPromise) {
    migrationPromise = migrateIndexedDbIfNeeded().catch((error) => {
      migrationPromise = null
      throw error
    })
  }
  await migrationPromise
}

export const getAllTrades = async (): Promise<Trade[]> => {
  await ensureMigrated()

  const { data, error } = await supabase.from('trades').select('*')
  if (error) throw error

  return sortTrades((data as TradeRow[]).map(toTrade))
}

export const addTrade = async (trade: NewTrade): Promise<Trade> => {
  await ensureMigrated()

  const record: Trade = withTradeDate({
    ...trade,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  })

  const { data, error } = await supabase
    .from('trades')
    .insert(toRow(record))
    .select()
    .single()

  if (error) throw error
  return toTrade(data as TradeRow)
}

export const deleteTrade = async (id: string): Promise<void> => {
  await ensureMigrated()

  const { error } = await supabase.from('trades').delete().eq('id', id)
  if (error) throw error
}

export const updateTrade = async (
  id: string,
  trade: NewTrade,
): Promise<Trade> => {
  await ensureMigrated()

  const { data: existing, error: fetchError } = await supabase
    .from('trades')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) throw fetchError
  if (!existing) throw new Error('Trade not found')

  const record: Trade = withTradeDate({
    ...trade,
    id,
    createdAt: Number((existing as TradeRow).created_at),
  })

  const { data, error } = await supabase
    .from('trades')
    .update(toRow(record))
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toTrade(data as TradeRow)
}

export const addTradeWithTimestamp = async (
  trade: NewTrade,
  createdAt: number,
): Promise<Trade> => {
  await ensureMigrated()

  const record: Trade = withTradeDate({
    ...trade,
    id: crypto.randomUUID(),
    createdAt,
  })

  const { data, error } = await supabase
    .from('trades')
    .insert(toRow(record))
    .select()
    .single()

  if (error) throw error
  return toTrade(data as TradeRow)
}

export const seedTradesDeduped = async (
  trades: Array<NewTrade & { createdAt: number }>,
  isDuplicate: (existing: Trade, incoming: NewTrade) => boolean,
): Promise<number> => {
  const existing = await getAllTrades()
  let added = 0

  for (const { createdAt, ...trade } of trades) {
    const duplicate = existing.some((record) => isDuplicate(record, trade))
    if (duplicate) continue

    const record = await addTradeWithTimestamp(trade, createdAt)
    existing.push(record)
    added++
  }

  return added
}
