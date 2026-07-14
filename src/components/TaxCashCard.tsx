import { useEffect, useState, type FormEvent } from 'react'
import { getTaxCash, updateTaxCash } from '../db/taxCash'
import { formatIls } from '../utils/tradeCalculations'

type TaxCashCardProps = {
  canEdit: boolean
}

export const TaxCashCard = ({ canEdit }: TaxCashCardProps) => {
  const [amountIls, setAmountIls] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    getTaxCash()
      .then((cash) => {
        if (!mounted) return
        setAmountIls(cash.amountIls)
        setDraft(String(cash.amountIls))
      })
      .catch(() => {
        if (!mounted) return
        setError('Could not load tax cash')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const startEdit = () => {
    if (!canEdit || amountIls === null) return
    setDraft(String(amountIls))
    setError(null)
    setIsEditing(true)
  }

  const cancelEdit = () => {
    if (amountIls !== null) setDraft(String(amountIls))
    setError(null)
    setIsEditing(false)
  }

  const handleSave = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return

    const parsed = Number(draft.replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed < 0) {
      setError('Enter a valid non-negative amount')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const cash = await updateTaxCash(parsed)
      setAmountIls(cash.amountIls)
      setDraft(String(cash.amountIls))
      setIsEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="stat-total tax-cash">
      <span className="stat-total-label">Tax cash (ILS)</span>
      {isLoading ? (
        <span className="stat-total-note">Loading…</span>
      ) : isEditing ? (
        <form className="tax-cash-form" onSubmit={handleSave}>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="Tax cash in ILS"
            autoFocus
          />
          <button type="submit" className="auth-btn" disabled={isSaving}>
            {isSaving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            className="auth-btn secondary"
            onClick={cancelEdit}
            disabled={isSaving}
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="tax-cash-display">
          <span className="stat-total-value">
            {amountIls === null ? '—' : formatIls(amountIls)}
          </span>
          {canEdit && amountIls !== null && (
            <button
              type="button"
              className="edit-btn tax-cash-edit"
              onClick={startEdit}
            >
              Edit
            </button>
          )}
        </div>
      )}
      <span className="stat-total-note">
        ILS cash set aside to pay taxes
      </span>
      {error && <p className="tax-cash-error">{error}</p>}
    </div>
  )
}
