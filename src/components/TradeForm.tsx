import { useEffect, useState, type FormEvent } from 'react'
import { addTrade, updateTrade } from '../db/trades'
import { getTradeDate } from '../utils/tradeDate'
import type { ClosePositionContext } from './TradeDrawer'
import type { OptionType, Trade, TradeDirection } from '../types/trade'

type TradeFormProps = {
  editingTrade: Trade | null
  closingPosition: ClosePositionContext | null
  onSaved: () => void
  onClose: () => void
}

type FormState = {
  symbol: string
  strike: string
  expireDate: string
  tradeDate: string
  type: OptionType
  direction: TradeDirection
  quantity: string
  cost: string
}

const today = (): string => new Date().toISOString().slice(0, 10)

const getInitialFormState = (): FormState => ({
  symbol: '',
  strike: '',
  expireDate: '',
  tradeDate: today(),
  type: 'call',
  direction: 'buy',
  quantity: '1',
  cost: '',
})

const tradeToFormState = (trade: Trade): FormState => ({
  symbol: trade.symbol,
  strike: String(trade.strike),
  expireDate: trade.expireDate,
  tradeDate: getTradeDate(trade),
  type: trade.type,
  direction: trade.direction,
  quantity: String(trade.quantity),
  cost: String(trade.cost),
})

const closeToFormState = (context: ClosePositionContext): FormState => {
  const { sellTrade, openQty } = context
  return {
    symbol: sellTrade.symbol,
    strike: String(sellTrade.strike),
    expireDate: sellTrade.expireDate,
    tradeDate: today(),
    type: sellTrade.type,
    direction: 'buy',
    quantity: String(openQty),
    cost: '',
  }
}

export const TradeForm = ({
  editingTrade,
  closingPosition,
  onSaved,
  onClose,
}: TradeFormProps) => {
  const [form, setForm] = useState<FormState>(getInitialFormState)
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isClosing = closingPosition !== null
  const isEditing = editingTrade !== null && !isClosing
  const isLocked = isClosing

  useEffect(() => {
    if (closingPosition) {
      setForm(closeToFormState(closingPosition))
    } else if (editingTrade) {
      setForm(tradeToFormState(editingTrade))
    } else {
      setForm(getInitialFormState())
    }
    setError(null)
  }, [editingTrade, closingPosition])

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const symbol = form.symbol.trim().toUpperCase()
    const strike = parseFloat(form.strike)
    const quantity = parseInt(form.quantity, 10)
    const cost = parseFloat(form.cost)

    if (!symbol) {
      setError('Symbol is required')
      return
    }
    if (isNaN(strike) || strike <= 0) {
      setError('Strike must be a positive number')
      return
    }
    if (!form.expireDate) {
      setError('Expire date is required')
      return
    }
    if (!form.tradeDate) {
      setError('Trade date is required')
      return
    }
    if (isNaN(quantity) || quantity < 1) {
      setError('Quantity must be at least 1')
      return
    }
    if (isClosing && closingPosition && quantity > closingPosition.openQty) {
      setError(`Quantity cannot exceed open contracts (${closingPosition.openQty})`)
      return
    }
    if (isNaN(cost) || cost < 0) {
      setError('Cost must be a non-negative number')
      return
    }

    const tradeData = {
      symbol,
      strike,
      expireDate: form.expireDate,
      tradeDate: form.tradeDate,
      type: form.type,
      direction: form.direction,
      quantity,
      cost,
    }

    setIsSubmitting(true)
    try {
      if (isEditing) {
        await updateTrade(editingTrade!.id, tradeData)
      } else {
        await addTrade(tradeData)
      }
      setForm(getInitialFormState())
      onSaved()
    } catch {
      setError(
        isEditing
          ? 'Failed to update trade'
          : isClosing
            ? 'Failed to close position'
            : 'Failed to save trade',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="trade-form" onSubmit={handleSubmit}>
      {isClosing && closingPosition && (
        <p className="close-banner">
          Closing {closingPosition.sellTrade.symbol}{' '}
          {closingPosition.sellTrade.strike} {closingPosition.sellTrade.type} —
          sold @ {closingPosition.sellTrade.cost.toFixed(2)}
        </p>
      )}

      <div className="form-grid">
        <label>
          Symbol
          <input
            type="text"
            value={form.symbol}
            onChange={(e) => handleChange('symbol', e.target.value)}
            onBlur={(e) => handleChange('symbol', e.target.value.toUpperCase())}
            placeholder="AAPL"
            disabled={isLocked}
          />
        </label>

        <label>
          Strike
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.strike}
            onChange={(e) => handleChange('strike', e.target.value)}
            placeholder="200.00"
            disabled={isLocked}
          />
        </label>

        <label>
          Trade Date
          <input
            type="date"
            value={form.tradeDate}
            onChange={(e) => handleChange('tradeDate', e.target.value)}
          />
        </label>

        <label>
          Expire Date
          <input
            type="date"
            value={form.expireDate}
            onChange={(e) => handleChange('expireDate', e.target.value)}
            disabled={isLocked}
          />
        </label>

        <label>
          Type
          <select
            value={form.type}
            onChange={(e) => handleChange('type', e.target.value)}
            disabled={isLocked}
          >
            <option value="call">Call</option>
            <option value="put">Put</option>
          </select>
        </label>

        <label>
          Direction
          <select
            value={form.direction}
            onChange={(e) => handleChange('direction', e.target.value)}
            disabled={isLocked}
          >
            <option value="buy">Buy</option>
            <option value="sell">Sell</option>
          </select>
        </label>

        <label>
          Quantity
          <input
            type="number"
            min="1"
            max={isClosing ? closingPosition?.openQty : undefined}
            step="1"
            value={form.quantity}
            onChange={(e) => handleChange('quantity', e.target.value)}
          />
        </label>

        <label>
          {isClosing ? 'Buy-back price (per contract)' : 'Cost (per contract)'}
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cost}
            onChange={(e) => handleChange('cost', e.target.value)}
            placeholder="3.50"
            autoFocus={isClosing}
          />
        </label>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? 'Saving...'
            : isClosing
              ? 'Close Position'
              : isEditing
                ? 'Update Trade'
                : 'Add Trade'}
        </button>
        <button
          type="button"
          className="cancel-btn"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
