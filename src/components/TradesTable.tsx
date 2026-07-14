import { Fragment, useEffect, useMemo, useState } from 'react'
import { fetchUsdToIls, type UsdToIlsRate } from '../api/exchangeRate'
import { fetchOptionPrices } from '../api/optionPrices'
import { deleteTrade } from '../db/trades'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { buildPositionMap, isOpenShort } from '../utils/matchPositions'
import type { ClosePositionContext } from './TradeDrawer'
import { getTradeDate } from '../utils/tradeDate'
import { getTradeStatus, getStatusLabel, TRADE_STATUSES, type StatusFilter } from '../utils/tradeStatus'
import {
  getNextSortDirection,
  sortTrades,
  type SortDirection,
  type SortField,
} from '../utils/sortTrades'
import { toDisplayTrades, getGroupedTradeDateLabel } from '../utils/groupTrades'
import {
  calcOpenCapitalAtRisk,
  calcSignedTotal,
  calcTradeSummary,
  formatCurrency,
  formatIls,
} from '../utils/tradeCalculations'
import type { Trade } from '../types/trade'
import { TaxCashCard } from './TaxCashCard'

type TradesTableProps = {
  trades: Trade[]
  canEdit?: boolean
  onEdit: (trade: Trade) => void
  onClosePosition: (context: ClosePositionContext) => void
  onTradeDeleted: () => void
}

type SortableHeaderProps = {
  field: SortField
  label: string
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  className?: string
}

const SortableHeader = ({
  field,
  label,
  sortField,
  sortDirection,
  onSort,
  className,
}: SortableHeaderProps) => (
  <th className={className}>
    <button
      type="button"
      className={`sort-btn ${sortField === field ? 'active' : ''}`}
      onClick={() => onSort(field)}
    >
      {label}
      {sortField === field && (
        <span className="sort-indicator">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  </th>
)

type RowActionsProps = {
  isGrouped: boolean
  sourceTradesCount: number
  isOpenSell: boolean
  primaryOpenSell: Trade | undefined
  primaryOpenQty: number
  trade: Trade
  onClosePosition: (context: ClosePositionContext) => void
  onEdit: (trade: Trade) => void
  onDelete: (id: string, symbol: string) => void
}

const RowActions = ({
  isGrouped,
  sourceTradesCount,
  isOpenSell,
  primaryOpenSell,
  primaryOpenQty,
  trade,
  onClosePosition,
  onEdit,
  onDelete,
}: RowActionsProps) => (
  <div className="action-buttons">
    {isGrouped ? (
      <span className="grouped-actions-note">
        {sourceTradesCount} trades
      </span>
    ) : (
      <>
        {isOpenSell && primaryOpenSell && (
          <button
            type="button"
            className="close-btn"
            onClick={(event) => {
              event.stopPropagation()
              onClosePosition({
                sellTrade: primaryOpenSell,
                openQty: primaryOpenQty,
              })
            }}
          >
            Close
          </button>
        )}
        <button
          type="button"
          className="edit-btn"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(trade)
          }}
        >
          Edit
        </button>
        <button
          type="button"
          className="delete-btn"
          onClick={(event) => {
            event.stopPropagation()
            onDelete(trade.id, trade.symbol)
          }}
        >
          Delete
        </button>
      </>
    )}
  </div>
)

export const TradesTable = ({
  trades,
  canEdit = false,
  onEdit,
  onClosePosition,
  onTradeDeleted,
}: TradesTableProps) => {
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [exchangeRate, setExchangeRate] = useState<UsdToIlsRate | null>(null)
  const [rateError, setRateError] = useState<string | null>(null)
  const [lastPrices, setLastPrices] = useState<Record<string, number>>({})
  const [isUpdatingPrices, setIsUpdatingPrices] = useState(false)
  const [priceError, setPriceError] = useState<string | null>(null)
  const [pricesUpdatedAt, setPricesUpdatedAt] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>('date')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [groupByContract, setGroupByContract] = useState(true)

  useEffect(() => {
    fetchUsdToIls()
      .then(setExchangeRate)
      .catch(() => setRateError('Could not load USD/ILS rate'))
  }, [])

  useEffect(() => {
    if (!isMobile) setExpandedId(null)
  }, [isMobile])

  const handleDelete = async (id: string, symbol: string) => {
    if (!window.confirm(`Delete ${symbol} trade?`)) return

    await deleteTrade(id)
    onTradeDeleted()
  }

  const positionMap = useMemo(() => buildPositionMap(trades), [trades])

  const capitalAtRisk = useMemo(
    () => calcOpenCapitalAtRisk(trades),
    [trades],
  )

  const taxOwedIls = useMemo(() => {
    if (!exchangeRate) return null
    return calcTradeSummary(trades).tax * exchangeRate.rate
  }, [trades, exchangeRate])

  const filteredTrades = useMemo(() => {
    if (statusFilter === 'all') return trades
    return trades.filter(
      (trade) => getTradeStatus(trade, positionMap) === statusFilter,
    )
  }, [trades, statusFilter, positionMap])

  const openShortTrades = useMemo(
    () => trades.filter((trade) => isOpenShort(trade, positionMap)),
    [trades, positionMap],
  )

  const handleUpdatePrices = async () => {
    if (openShortTrades.length === 0) {
      setPriceError('No open short positions to update')
      return
    }

    setIsUpdatingPrices(true)
    setPriceError(null)

    try {
      const results = await fetchOptionPrices(openShortTrades)
      const prices: Record<string, number> = {}

      for (const result of results) {
        if (result.lastPrice != null) {
          prices[result.id] = result.lastPrice
        }
      }

      setLastPrices(prices)
      setPricesUpdatedAt(new Date().toLocaleTimeString())

      const failed = results.filter((result) => result.lastPrice == null)
      if (failed.length > 0) {
        const detail = failed.find((result) => result.error)?.error
        setPriceError(
          detail
            ? `${failed.length} contract(s) failed: ${detail}`
            : `${failed.length} ongoing contract(s) had no price available`,
        )
      }
    } catch {
      setPriceError('Failed to fetch option prices from Yahoo Finance')
    } finally {
      setIsUpdatingPrices(false)
    }
  }

  const {
    netTotal,
    contractCount: totalQty,
    commissions,
    tax,
    afterTax,
  } = calcTradeSummary(filteredTrades)
  const afterTaxIls = exchangeRate ? afterTax * exchangeRate.rate : null

  const handleSort = (field: SortField) => {
    setSortDirection(getNextSortDirection(field, sortField, sortDirection))
    setSortField(field)
  }

  const sortedDisplayTrades = useMemo(() => {
    const displayRows = toDisplayTrades(filteredTrades, groupByContract)
    const sortContext = {
      lastPrices,
      positionMap,
      calcSignedTotal,
    }
    const sorted = sortTrades(
      displayRows.map((row) => row.trade),
      sortField,
      sortDirection,
      sortContext,
    )
    const rowByTradeId = new Map(
      displayRows.map((row) => [row.trade.id, row]),
    )

    return sorted
      .map((trade) => rowByTradeId.get(trade.id))
      .filter((row): row is NonNullable<typeof row> => row != null)
  }, [
    filteredTrades,
    groupByContract,
    sortField,
    sortDirection,
    lastPrices,
    positionMap,
  ])

  if (trades.length === 0) {
    return (
      <div>
        <div className="trades-stats-row">
          <div className="stat-total">
            <span className="stat-total-label">Capital at risk</span>
            <span className="stat-total-value">{formatCurrency(0)}</span>
            <span className="stat-total-note">
              Open short puts (strike × contracts × 100)
            </span>
          </div>
          {canEdit && <TaxCashCard canEdit={canEdit} taxOwedIls={taxOwedIls} />}
        </div>
        <div className="empty-state">
          <p>No trades saved yet. Add your first option trade above.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="trades-stats-row">
        <div className="stat-total">
          <span className="stat-total-label">Capital at risk</span>
          <span className="stat-total-value">
            {formatCurrency(capitalAtRisk)}
          </span>
          <span className="stat-total-note">
            Open short puts (strike × contracts × 100)
          </span>
        </div>
        {canEdit && <TaxCashCard canEdit={canEdit} taxOwedIls={taxOwedIls} />}
      </div>
      <div className="table-toolbar">
        <div className="status-filter">
          <span className="status-filter-label">Status</span>
          <div className="status-filter-options">
            <button
              type="button"
              className={`status-filter-btn ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All
            </button>
            {TRADE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`status-filter-btn ${status} ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(status)}
              >
                {getStatusLabel(status)}
              </button>
            ))}
          </div>
        </div>
        <div className="group-filter">
          <span className="status-filter-label">Group</span>
          <label className={`group-toggle ${groupByContract ? 'active' : ''}`}>
            <input
              type="checkbox"
              checked={groupByContract}
              onChange={(event) => setGroupByContract(event.target.checked)}
            />
            <span className="group-toggle-box" aria-hidden="true">
              <span className="group-toggle-check" />
            </span>
            <span className="group-toggle-label">Same contract</span>
          </label>
        </div>
        <button
          type="button"
          className="update-prices-btn"
          onClick={handleUpdatePrices}
          disabled={isUpdatingPrices || openShortTrades.length === 0}
        >
          {isUpdatingPrices ? 'Updating...' : 'Update Prices'}
        </button>
        {openShortTrades.length === 0 && (
          <span className="prices-updated">No open short positions</span>
        )}
        {pricesUpdatedAt && (
          <span className="prices-updated">
            Last updated {pricesUpdatedAt}
          </span>
        )}
        {priceError && <span className="price-error">{priceError}</span>}
      </div>

      <div className="table-wrapper">
      <table className="trades-table">
        <thead>
          <tr>
            <SortableHeader className="col-detail" field="date" label="Date" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-primary" field="symbol" label="Symbol" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="strike" label="Strike" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="expire" label="Expire" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-primary" field="status" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="type" label="Type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-primary" field="direction" label="Direction" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="qty" label="Qty" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="cost" label="Cost" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="lastPrice" label="Last Price" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-detail" field="realized" label="Realized" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            <SortableHeader className="col-primary" field="total" label="Total" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
            {canEdit && <th className="col-detail">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sortedDisplayTrades.length === 0 ? (
            <tr>
              <td colSpan={13} className="empty-filter">
                No {statusFilter === 'all' ? '' : `${getStatusLabel(statusFilter).toLowerCase()} `}
                trades match this filter.
              </td>
            </tr>
          ) : (
          sortedDisplayTrades.map((row) => {
            const { trade, trades: sourceTrades, isGrouped } = row
            const status = isGrouped
              ? sourceTrades.reduce<ReturnType<typeof getTradeStatus>>(
                  (worst, sourceTrade) => {
                    const next = getTradeStatus(sourceTrade, positionMap)
                    if (worst === 'ongoing' || next === 'ongoing') return 'ongoing'
                    if (worst === 'closed' || next === 'closed') return 'closed'
                    return 'done'
                  },
                  'done',
                )
              : getTradeStatus(trade, positionMap)
            const signedTotal = isGrouped
              ? sourceTrades.reduce((sum, sourceTrade) => sum + calcSignedTotal(sourceTrade), 0)
              : calcSignedTotal(trade)
            const showLastPrice = sourceTrades.some((sourceTrade) =>
              isOpenShort(sourceTrade, positionMap),
            )
            const isOpenSell = showLastPrice
            const groupedRealizedPnl = sourceTrades
              .filter((sourceTrade) => sourceTrade.direction === 'sell')
              .reduce(
                (sum, sourceTrade) =>
                  sum + (positionMap.get(sourceTrade.id)?.realizedPnl ?? 0),
                0,
              )
            const showRealized =
              sourceTrades.some(
                (sourceTrade) =>
                  sourceTrade.direction === 'sell' &&
                  (positionMap.get(sourceTrade.id)?.matchedQty ?? 0) > 0,
              )
            const lastPrice = sourceTrades
              .map((sourceTrade) => lastPrices[sourceTrade.id])
              .find((price) => price != null)
            const primaryOpenSell = sourceTrades.find(
              (sourceTrade) => isOpenShort(sourceTrade, positionMap),
            )
            const primaryOpenQty = primaryOpenSell
              ? positionMap.get(primaryOpenSell.id)?.openQty ?? 0
              : 0
            const isExpanded = isMobile && expandedId === trade.id
            const dateLabel = isGrouped
              ? getGroupedTradeDateLabel(sourceTrades)
              : getTradeDate(trade)
            const qtyLabel = (
              <>
                {trade.quantity}
                {isGrouped && (
                  <span className="group-count" title={`${sourceTrades.length} trades combined`}>
                    ×{sourceTrades.length}
                  </span>
                )}
              </>
            )
            const costLabel = (
              <>
                {formatCurrency(trade.cost)}
                {isGrouped && <span className="avg-cost-label">avg</span>}
              </>
            )
            const lastPriceLabel =
              showLastPrice && lastPrice != null
                ? formatCurrency(lastPrice)
                : '—'
            const realizedLabel = showRealized
              ? formatCurrency(groupedRealizedPnl)
              : '—'
            const actions = canEdit ? (
              <RowActions
                isGrouped={isGrouped}
                sourceTradesCount={sourceTrades.length}
                isOpenSell={isOpenSell}
                primaryOpenSell={primaryOpenSell}
                primaryOpenQty={primaryOpenQty}
                trade={trade}
                onClosePosition={onClosePosition}
                onEdit={onEdit}
                onDelete={handleDelete}
              />
            ) : null

            return (
            <Fragment key={trade.id}>
            <tr
              className={[
                'trade-row',
                isGrouped ? 'grouped-row' : '',
                isExpanded ? 'expanded' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={
                isMobile
                  ? () =>
                      setExpandedId((current) =>
                        current === trade.id ? null : trade.id,
                      )
                  : undefined
              }
            >
              <td className="col-detail">{dateLabel}</td>
              <td className="col-primary symbol">
                <span className="symbol-cell">
                  {isMobile && (
                    <span
                      className={`expand-chevron ${isExpanded ? 'expanded' : ''}`}
                      aria-hidden="true"
                    >
                      ›
                    </span>
                  )}
                  {trade.symbol}
                </span>
              </td>
              <td className="col-detail">{formatCurrency(trade.strike)}</td>
              <td className="col-detail">{trade.expireDate}</td>
              <td className="col-primary">
                <span className={`status ${status}`}>
                  {getStatusLabel(status)}
                </span>
              </td>
              <td className="col-detail type">{trade.type.toUpperCase()}</td>
              <td className="col-primary">
                <span className={`direction ${trade.direction}`}>
                  {trade.direction === 'buy' ? 'Buy' : 'Sell'}
                </span>
              </td>
              <td className="col-detail">{qtyLabel}</td>
              <td className="col-detail">{costLabel}</td>
              <td className="col-detail">{lastPriceLabel}</td>
              <td
                className={[
                  'col-detail',
                  showRealized
                    ? groupedRealizedPnl >= 0
                      ? 'total-positive'
                      : 'total-negative'
                    : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {realizedLabel}
              </td>
              <td
                className={[
                  'col-primary',
                  signedTotal >= 0 ? 'total-positive' : 'total-negative',
                ].join(' ')}
              >
                {formatCurrency(signedTotal)}
              </td>
              {canEdit && <td className="col-detail">{actions}</td>}
            </tr>
            {isExpanded && (
              <tr className="trade-detail-row">
                <td colSpan={13}>
                  <div className="trade-detail-panel">
                    <dl className="trade-detail-grid">
                      <div>
                        <dt>Date</dt>
                        <dd>{dateLabel}</dd>
                      </div>
                      <div>
                        <dt>Strike</dt>
                        <dd>{formatCurrency(trade.strike)}</dd>
                      </div>
                      <div>
                        <dt>Expire</dt>
                        <dd>{trade.expireDate}</dd>
                      </div>
                      <div>
                        <dt>Type</dt>
                        <dd className="type">{trade.type.toUpperCase()}</dd>
                      </div>
                      <div>
                        <dt>Qty</dt>
                        <dd>{qtyLabel}</dd>
                      </div>
                      <div>
                        <dt>Cost</dt>
                        <dd>{costLabel}</dd>
                      </div>
                      <div>
                        <dt>Last Price</dt>
                        <dd>{lastPriceLabel}</dd>
                      </div>
                      <div>
                        <dt>Realized</dt>
                        <dd
                          className={
                            showRealized
                              ? groupedRealizedPnl >= 0
                                ? 'total-positive'
                                : 'total-negative'
                              : undefined
                          }
                        >
                          {realizedLabel}
                        </dd>
                      </div>
                    </dl>
                    {canEdit && (
                      <div className="trade-detail-actions">{actions}</div>
                    )}
                  </div>
                </td>
              </tr>
            )}
            </Fragment>
            )
          })
          )}
        </tbody>
        <tfoot>
          {isMobile ? (
            <>
              <tr className="total-row mobile-footer-row">
                <td colSpan={13}>
                  <div className="mobile-footer-line">
                    <span>
                      Net Total
                      <span className="footer-qty-note"> · {totalQty} qty</span>
                    </span>
                    <span
                      className={
                        netTotal >= 0 ? 'total-positive' : 'total-negative'
                      }
                    >
                      {formatCurrency(netTotal)}
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="total-row mobile-footer-row">
                <td colSpan={13}>
                  <div className="mobile-footer-line">
                    <span>Commissions ($2/contract)</span>
                    <span className="total-negative">
                      {formatCurrency(-commissions)}
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="total-row mobile-footer-row">
                <td colSpan={13}>
                  <div className="mobile-footer-line">
                    <span>Tax (25%)</span>
                    <span className="total-negative">
                      {formatCurrency(-tax)}
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="total-row mobile-footer-row">
                <td colSpan={13}>
                  <div className="mobile-footer-line">
                    <span>After Tax</span>
                    <span
                      className={
                        afterTax >= 0 ? 'total-positive' : 'total-negative'
                      }
                    >
                      {formatCurrency(afterTax)}
                    </span>
                  </div>
                </td>
              </tr>
              {afterTaxIls !== null && (
                <tr className="total-row mobile-footer-row">
                  <td colSpan={13}>
                    <div className="mobile-footer-line">
                      <span>
                        After Tax (ILS)
                        <span className="rate-note">
                          {' '}
                          @ {exchangeRate!.rate.toFixed(2)} ({exchangeRate!.date})
                        </span>
                      </span>
                      <span
                        className={
                          afterTaxIls >= 0 ? 'total-positive' : 'total-negative'
                        }
                      >
                        {formatIls(afterTaxIls)}
                      </span>
                    </div>
                  </td>
                </tr>
              )}
              {rateError && (
                <tr className="total-row">
                  <td colSpan={13} className="rate-error">
                    {rateError}
                  </td>
                </tr>
              )}
            </>
          ) : (
            <>
              <tr className="total-row">
                <td colSpan={7}>Net Total</td>
                <td>{totalQty}</td>
                <td />
                <td />
                <td />
                <td className={netTotal >= 0 ? 'total-positive' : 'total-negative'}>
                  {formatCurrency(netTotal)}
                </td>
                <td />
              </tr>
              <tr className="total-row">
                <td colSpan={11}>
                  Commissions ($2/contract)
                </td>
                <td className="total-negative">{formatCurrency(-commissions)}</td>
                <td />
              </tr>
              <tr className="total-row">
                <td colSpan={11}>Tax (25%)</td>
                <td className="total-negative">{formatCurrency(-tax)}</td>
                <td />
              </tr>
              <tr className="total-row">
                <td colSpan={11}>After Tax</td>
                <td className={afterTax >= 0 ? 'total-positive' : 'total-negative'}>
                  {formatCurrency(afterTax)}
                </td>
                <td />
              </tr>
              {afterTaxIls !== null && (
                <tr className="total-row">
                  <td colSpan={11}>
                    After Tax (ILS)
                    <span className="rate-note">
                      {' '}
                      @ {exchangeRate!.rate.toFixed(2)} ({exchangeRate!.date})
                    </span>
                  </td>
                  <td className={afterTaxIls >= 0 ? 'total-positive' : 'total-negative'}>
                    {formatIls(afterTaxIls)}
                  </td>
                  <td />
                </tr>
              )}
              {rateError && (
                <tr className="total-row">
                  <td colSpan={13} className="rate-error">{rateError}</td>
                </tr>
              )}
            </>
          )}
        </tfoot>
      </table>
      </div>
    </div>
  )
}
