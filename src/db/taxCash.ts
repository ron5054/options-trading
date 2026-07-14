import { supabase } from '../lib/supabase'

export type TaxCashDeposit = {
  id: string
  amountIls: number
  note: string | null
  createdAt: string
}

type TaxCashDepositRow = {
  id: string
  amount_ils: number
  note: string | null
  created_at: string
}

const toDeposit = (row: TaxCashDepositRow): TaxCashDeposit => ({
  id: row.id,
  amountIls: Number(row.amount_ils),
  note: row.note,
  createdAt: row.created_at,
})

export const getTaxCashDeposits = async (): Promise<TaxCashDeposit[]> => {
  const { data, error } = await supabase
    .from('tax_cash_deposits')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data as TaxCashDepositRow[]) ?? []).map(toDeposit)
}

export const sumTaxCashDeposits = (deposits: TaxCashDeposit[]): number =>
  deposits.reduce((sum, deposit) => sum + deposit.amountIls, 0)

export const addTaxCashDeposit = async (
  amountIls: number,
  note?: string,
): Promise<TaxCashDeposit> => {
  const { data, error } = await supabase
    .from('tax_cash_deposits')
    .insert({
      amount_ils: amountIls,
      note: note?.trim() || null,
    })
    .select()
    .single()

  if (error) throw error
  return toDeposit(data as TaxCashDepositRow)
}

export const deleteTaxCashDeposit = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tax_cash_deposits')
    .delete()
    .eq('id', id)

  if (error) throw error
}
