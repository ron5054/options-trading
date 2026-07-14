import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  addTaxCashDeposit,
  deleteTaxCashDeposit,
  getTaxCashDeposits,
  sumTaxCashDeposits,
  type TaxCashDeposit,
} from '../db/taxCash'
import { formatIls } from '../utils/tradeCalculations'

type TaxCashCardProps = {
  canEdit: boolean
  /** Estimated tax due in ILS (25% of net × FX), or null while rate loads */
  taxOwedIls: number | null
}

const formatDepositDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

export const TaxCashCard = ({ canEdit, taxOwedIls }: TaxCashCardProps) => {
  const [deposits, setDeposits] = useState<TaxCashDeposit[]>([])
  const [draft, setDraft] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const loadDeposits = useCallback(async () => {
    const rows = await getTaxCashDeposits()
    setDeposits(rows)
  }, [])

  useEffect(() => {
    let mounted = true

    loadDeposits()
      .catch(() => {
        if (!mounted) return
        setError('Could not load tax deposits')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [loadDeposits])

  const totalDeposited = sumTaxCashDeposits(deposits)
  const remainingIls =
    taxOwedIls !== null ? totalDeposited - taxOwedIls : null
  const shortfallIls =
    remainingIls !== null && remainingIls < 0 ? -remainingIls : 0
  const needsMore = shortfallIls > 0

  const openAdd = () => {
    setDraft('')
    setError(null)
    setIsAdding(true)
  }

  const cancelAdd = () => {
    setDraft('')
    setError(null)
    setIsAdding(false)
  }

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault()
    if (!canEdit) return

    const parsed = Number(draft.replace(/,/g, ''))
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError('Enter an amount greater than zero')
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      await addTaxCashDeposit(parsed)
      await loadDeposits()
      setDraft('')
      setIsAdding(false)
      setShowHistory(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add deposit')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (deposit: TaxCashDeposit) => {
    if (!canEdit) return
    if (
      !window.confirm(
        `Remove deposit of ${formatIls(deposit.amountIls)} from ${formatDepositDate(deposit.createdAt)}?`,
      )
    ) {
      return
    }

    setError(null)
    try {
      await deleteTaxCashDeposit(deposit.id)
      await loadDeposits()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove deposit')
    }
  }

  return (
    <div className={`stat-total tax-cash ${needsMore ? 'tax-cash-warn' : ''}`}>
      <span className="stat-total-label">Tax deposit (ILS)</span>
      {isLoading ? (
        <span className="stat-total-note">Loading…</span>
      ) : (
        <>
          <div className="tax-cash-display">
            <span className="stat-total-value">{formatIls(totalDeposited)}</span>
            {canEdit && !isAdding && (
              <button
                type="button"
                className="edit-btn tax-cash-edit"
                onClick={openAdd}
              >
                Add
              </button>
            )}
          </div>

          {isAdding && (
            <form className="tax-cash-form" onSubmit={handleAdd}>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Amount to add"
                aria-label="Deposit amount in ILS"
                autoFocus
              />
              <button type="submit" className="auth-btn" disabled={isSaving}>
                {isSaving ? 'Adding…' : 'Add'}
              </button>
              <button
                type="button"
                className="auth-btn secondary"
                onClick={cancelAdd}
                disabled={isSaving}
              >
                Cancel
              </button>
            </form>
          )}

          {taxOwedIls !== null && remainingIls !== null ? (
            <div className="tax-cash-breakdown">
              <span>
                Tax due {formatIls(taxOwedIls)}
                <span className="tax-cash-sep">·</span>
                Left{' '}
                <span
                  className={
                    remainingIls >= 0 ? 'total-positive' : 'total-negative'
                  }
                >
                  {formatIls(remainingIls)}
                </span>
              </span>
              {needsMore && (
                <p className="tax-cash-warning" role="status">
                  Deposit short — add at least {formatIls(shortfallIls)} more
                </p>
              )}
            </div>
          ) : (
            <span className="stat-total-note">Loading tax due…</span>
          )}

          {deposits.length > 0 && (
            <div className="tax-cash-history">
              <button
                type="button"
                className="tax-cash-history-toggle"
                onClick={() => setShowHistory((open) => !open)}
              >
                {showHistory ? 'Hide' : 'Show'} deposits ({deposits.length})
              </button>
              {showHistory && (
                <ul className="tax-cash-history-list">
                  {deposits.map((deposit) => (
                    <li key={deposit.id}>
                      <span className="tax-cash-history-amount">
                        {formatIls(deposit.amountIls)}
                      </span>
                      <span className="tax-cash-history-date">
                        {formatDepositDate(deposit.createdAt)}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          className="delete-btn tax-cash-history-delete"
                          onClick={() => {
                            void handleDelete(deposit)
                          }}
                        >
                          Remove
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
      {error && <p className="tax-cash-error">{error}</p>}
    </div>
  )
}
