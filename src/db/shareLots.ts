import { supabase } from '../lib/supabase'

export type ShareLot = {
  id: string
  symbol: string
  quantity: number
  basisPerShare: number
  assignedAt: string
  assignedFromTradeId: string
  closedAt: string | null
  closedByTradeId: string | null
  createdAt: string
}

export type NewShareLot = {
  symbol: string
  quantity: number
  basisPerShare: number
  assignedAt: string
  assignedFromTradeId: string
}

type ShareLotRow = {
  id: string
  symbol: string
  quantity: number
  basis_per_share: number
  assigned_at: string
  assigned_from_trade_id: string
  closed_at: string | null
  closed_by_trade_id: string | null
  created_at: string
}

const toShareLot = (row: ShareLotRow): ShareLot => ({
  id: row.id,
  symbol: row.symbol,
  quantity: Number(row.quantity),
  basisPerShare: Number(row.basis_per_share),
  assignedAt: row.assigned_at,
  assignedFromTradeId: row.assigned_from_trade_id,
  closedAt: row.closed_at,
  closedByTradeId: row.closed_by_trade_id,
  createdAt: row.created_at,
})

export const getAllShareLots = async (): Promise<ShareLot[]> => {
  const { data, error } = await supabase
    .from('share_lots')
    .select('*')
    .order('assigned_at', { ascending: false })

  if (error) throw error
  return ((data as ShareLotRow[]) ?? []).map(toShareLot)
}

export const addShareLot = async (lot: NewShareLot): Promise<ShareLot> => {
  const { data, error } = await supabase
    .from('share_lots')
    .insert({
      symbol: lot.symbol.toUpperCase(),
      quantity: lot.quantity,
      basis_per_share: lot.basisPerShare,
      assigned_at: lot.assignedAt,
      assigned_from_trade_id: lot.assignedFromTradeId,
    })
    .select()
    .single()

  if (error) throw error
  return toShareLot(data as ShareLotRow)
}

export const closeShareLot = async (
  id: string,
  closedAt: string,
  closedByTradeId: string,
): Promise<ShareLot> => {
  const { data, error } = await supabase
    .from('share_lots')
    .update({
      closed_at: closedAt,
      closed_by_trade_id: closedByTradeId,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return toShareLot(data as ShareLotRow)
}

export const deleteShareLot = async (id: string): Promise<void> => {
  const { error } = await supabase.from('share_lots').delete().eq('id', id)
  if (error) throw error
}

export const isOpenShareLot = (lot: ShareLot): boolean => lot.closedAt === null

export const getOpenShareLotsForSymbol = (
  lots: ShareLot[],
  symbol: string,
): ShareLot[] => {
  const normalized = symbol.toUpperCase()
  return lots
    .filter(
      (lot) =>
        lot.symbol.toUpperCase() === normalized && isOpenShareLot(lot),
    )
    .sort((a, b) => a.assignedAt.localeCompare(b.assignedAt))
}

/** @deprecated Prefer getOpenShareLotsForSymbol — kept for single-lot call sites */
export const getOpenShareLotForSymbol = (
  lots: ShareLot[],
  symbol: string,
): ShareLot | null => getOpenShareLotsForSymbol(lots, symbol)[0] ?? null

export const closeShareLots = async (
  ids: string[],
  closedAt: string,
  closedByTradeId: string,
): Promise<void> => {
  if (ids.length === 0) return
  const { error } = await supabase
    .from('share_lots')
    .update({
      closed_at: closedAt,
      closed_by_trade_id: closedByTradeId,
    })
    .in('id', ids)

  if (error) throw error
}
