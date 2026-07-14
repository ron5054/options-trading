import { supabase } from '../lib/supabase'

export type TaxCash = {
  amountIls: number
  updatedAt: string
}

type TaxCashRow = {
  id: number
  amount_ils: number
  updated_at: string
}

const toTaxCash = (row: TaxCashRow): TaxCash => ({
  amountIls: Number(row.amount_ils),
  updatedAt: row.updated_at,
})

export const getTaxCash = async (): Promise<TaxCash> => {
  const { data, error } = await supabase
    .from('tax_cash')
    .select('*')
    .eq('id', 1)
    .single()

  if (error) throw error
  return toTaxCash(data as TaxCashRow)
}

export const updateTaxCash = async (amountIls: number): Promise<TaxCash> => {
  const { data, error } = await supabase
    .from('tax_cash')
    .update({
      amount_ils: amountIls,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)
    .select()
    .single()

  if (error) throw error
  return toTaxCash(data as TaxCashRow)
}
