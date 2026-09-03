import { useEffect, useMemo, useState } from 'react'
import { fetchStockQuote } from '../api/stockQuote'
import { getClosedShareLotsForSymbol, type ShareLot } from '../db/shareLots'
import { buildPositionMap } from '../utils/matchPositions'
import {
  calcHoldingMarkToMarket,
  calcHoldingSummary,
  calcPremiumBreakEven,
} from '../utils/shareLots'
import {
  calcSymbolSummary,
  formatCurrency,
  getOpenOptionPositions,
} from '../utils/tradeCalculations'
import type { Trade } from '../types/trade'

type SymbolDrawerProps = {
  symbol: string | null
  trades: Trade[]
  shareLots: ShareLot[]
  canEdit: boolean
  onClose: () => void
  onRemoveAssignment: (lot: ShareLot) => void
}

const formatSinceDate = (date: string): string =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

const formatPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

export const SymbolDrawer = ({
  symbol,
  trades,
  shareLots,
  canEdit,
  onClose,
  onRemoveAssignment,
}: SymbolDrawerProps) => {
  const isOpen = symbol !== null
  const [quotePrice, setQuotePrice] = useState<number | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [isQuoteLoading, setIsQuoteLoading] = useState(false)

  const summary = useMemo(() => {
    if (!symbol) return null
    return calcSymbolSummary(trades, symbol)
  }, [symbol, trades])

  const positionMap = useMemo(() => buildPositionMap(trades), [trades])

  const holding = useMemo(() => {
    if (!symbol) return null
    return calcHoldingSummary(shareLots, symbol, trades, positionMap)
  }, [symbol, shareLots, trades, positionMap])

  const closedLots = useMemo(() => {
    if (!symbol) return []
    return getClosedShareLotsForSymbol(shareLots, symbol)
  }, [symbol, shareLots])

  const openOptions = useMemo(() => {
    if (!symbol) return []
    return getOpenOptionPositions(trades, symbol, positionMap)
  }, [symbol, trades, positionMap])

  const hasOpenPositions = holding != null || openOptions.length > 0

  const markToMarket = useMemo(() => {
    if (!holding || quotePrice == null) return null
    return calcHoldingMarkToMarket(holding, quotePrice)
  }, [holding, quotePrice])

  const premiumBreakEven = useMemo(() => {
    if (!holding || !summary) return null
    return calcPremiumBreakEven(
      holding.avgBasisPerShare,
      holding.quantity,
      summary.premiumAfterCommissions,
    )
  }, [holding, summary])

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || !symbol || !holding) {
      setQuotePrice(null)
      setQuoteError(null)
      setIsQuoteLoading(false)
      return
    }

    let cancelled = false
    setIsQuoteLoading(true)
    setQuoteError(null)
    setQuotePrice(null)

    fetchStockQuote(symbol)
      .then((quote) => {
        if (cancelled) return
        setQuotePrice(quote.price)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setQuoteError(
          error instanceof Error ? error.message : 'Could not load price',
        )
      })
      .finally(() => {
        if (!cancelled) setIsQuoteLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [isOpen, symbol, holding])

  return (
    <>
      <div
        className={`drawer-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        className={`drawer ${isOpen ? 'open' : ''}`}
        aria-hidden={!isOpen}
        role="dialog"
        aria-labelledby="symbol-drawer-title"
      >
        <div className="drawer-header">
          <h2 id="symbol-drawer-title">{symbol ?? 'Symbol'}</h2>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="drawer-body">
          {summary && (
            <div className="symbol-summary">
              <div className="symbol-summary-hero">
                <span className="symbol-summary-label">
                  Premium after commissions
                </span>
                <span
                  className={[
                    'symbol-summary-value',
                    summary.premiumAfterCommissions >= 0
                      ? 'total-positive'
                      : 'total-negative',
                  ].join(' ')}
                >
                  {formatCurrency(summary.premiumAfterCommissions)}
                </span>
                {summary.firstTradeDate && (
                  <span className="symbol-summary-note">
                    Since {formatSinceDate(summary.firstTradeDate)}
                  </span>
                )}
              </div>

              <dl className="symbol-summary-breakdown">
                <div>
                  <dt>Net premium</dt>
                  <dd
                    className={
                      summary.netTotal >= 0
                        ? 'total-positive'
                        : 'total-negative'
                    }
                  >
                    {formatCurrency(summary.netTotal)}
                  </dd>
                </div>
                <div>
                  <dt>Commissions</dt>
                  <dd className="total-negative">
                    {formatCurrency(-summary.commissions)}
                  </dd>
                </div>
                <div>
                  <dt>Trades</dt>
                  <dd>{summary.tradeCount}</dd>
                </div>
                <div>
                  <dt>Contracts</dt>
                  <dd>{summary.contractCount}</dd>
                </div>
                {summary.openCapitalAtRisk > 0 && (
                  <div className="symbol-summary-risk">
                    <dt>Capital at risk</dt>
                    <dd>{formatCurrency(summary.openCapitalAtRisk)}</dd>
                  </div>
                )}
              </dl>

              {hasOpenPositions && (
                <div className="symbol-holding">
                  <h3 className="symbol-holding-title">Open positions</h3>

                  {holding && (
                    <div className="symbol-open-position">
                      <p className="symbol-holding-line">
                        {holding.quantity} shares · avg{' '}
                        {formatCurrency(holding.avgBasisPerShare)}
                      </p>
                      <p className="symbol-summary-note">
                        Total cost {formatCurrency(holding.totalCost)} · since{' '}
                        {formatSinceDate(holding.firstAssignedAt)} · buy price
                        (assignment strike)
                      </p>

                      <div className="symbol-holding-mtm">
                        {isQuoteLoading && (
                          <p className="symbol-summary-note">Loading price…</p>
                        )}
                        {quoteError && (
                          <p className="symbol-holding-quote-error">
                            {quoteError}
                          </p>
                        )}
                        {markToMarket && (
                          <>
                            <p className="symbol-holding-line">
                              <span
                                className={
                                  markToMarket.unrealizedPnl >= 0
                                    ? 'total-positive'
                                    : 'total-negative'
                                }
                              >
                                {formatCurrency(markToMarket.unrealizedPnl)}
                              </span>
                              <span
                                className={[
                                  'symbol-holding-pct',
                                  markToMarket.unrealizedPnlPercent >= 0
                                    ? 'total-positive'
                                    : 'total-negative',
                                ].join(' ')}
                              >
                                {formatPercent(
                                  markToMarket.unrealizedPnlPercent,
                                )}
                              </span>
                            </p>
                            <p className="symbol-summary-note">
                              Last {formatCurrency(markToMarket.price)} ·
                              market {formatCurrency(markToMarket.marketValue)}{' '}
                              · delayed
                            </p>
                          </>
                        )}
                      </div>

                      <ul className="symbol-holding-lots">
                        {holding.lots.map((lot) => (
                          <li key={lot.id}>
                            <span>
                              {lot.quantity} @{' '}
                              {formatCurrency(lot.basisPerShare)}
                              <span className="symbol-summary-note">
                                {' '}
                                · {formatSinceDate(lot.assignedAt)}
                              </span>
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                className="delete-btn"
                                onClick={() => onRemoveAssignment(lot)}
                              >
                                Remove
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>

                      <dl className="symbol-summary-breakdown symbol-holding-breakdown">
                        <div className="symbol-summary-risk">
                          <dt>Break-even after all-time premium</dt>
                          <dd className="symbol-holding-breakeven">
                            {premiumBreakEven != null
                              ? formatCurrency(premiumBreakEven)
                              : '—'}
                            {premiumBreakEven != null && quotePrice != null && (
                              <span
                                className={[
                                  'symbol-holding-pct',
                                  quotePrice - premiumBreakEven >= 0
                                    ? 'total-positive'
                                    : 'total-negative',
                                ].join(' ')}
                              >
                                {formatPercent(
                                  ((quotePrice - premiumBreakEven) /
                                    premiumBreakEven) *
                                    100,
                                )}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}

                  {openOptions.length > 0 && (
                    <ul className="symbol-holding-lots symbol-open-options">
                      {openOptions.map((position) => {
                        const role =
                          position.direction === 'sell' ? 'short' : 'long'
                        const premiumLabel =
                          position.premium >= 0 ? 'credit' : 'debit'
                        return (
                          <li
                            key={`${position.type}-${position.direction}-${position.strike}-${position.expireDate}`}
                          >
                            <span>
                              {position.openQty} ×{' '}
                              {formatCurrency(position.strike)} {role}{' '}
                              {position.type}
                              <span className="symbol-summary-note">
                                {' '}
                                · expire {formatSinceDate(position.expireDate)}{' '}
                                · {premiumLabel}{' '}
                                {formatCurrency(Math.abs(position.premium))}
                                {position.capitalAtRisk > 0
                                  ? ` · risk ${formatCurrency(position.capitalAtRisk)}`
                                  : ''}
                              </span>
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )}

              {closedLots.length > 0 && (
                <div className="symbol-holding symbol-holding-history">
                  <h3 className="symbol-holding-title">Past assignments</h3>
                  <ul className="symbol-holding-lots">
                    {closedLots.map((lot) => (
                      <li key={lot.id}>
                        <span>
                          {lot.quantity} @ {formatCurrency(lot.basisPerShare)}
                          <span className="symbol-summary-note">
                            {' '}
                            · {formatSinceDate(lot.assignedAt)}
                            {lot.closedAt
                              ? ` → called away ${formatSinceDate(lot.closedAt)}`
                              : ''}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
