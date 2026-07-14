import { useCallback, useEffect, useState } from 'react'
import { seedTrades, tradeKey } from './data/seedTrades'
import { getAllTrades, seedTradesDeduped } from './db/trades'
import { AuthBar } from './components/AuthBar'
import {
  TradeDrawer,
  type ClosePositionContext,
} from './components/TradeDrawer'
import { MonthlyRevenueChart } from './components/MonthlyRevenueChart'
import { TradesTable } from './components/TradesTable'
import { useAuth } from './hooks/useAuth'
import { useHashPage } from './hooks/useHashPage'
import type { NewTrade, Trade } from './types/trade'

const isDuplicateTrade = (existing: Trade, incoming: NewTrade): boolean =>
  tradeKey(existing) === tradeKey(incoming)

export const App = () => {
  const { user, isLoading: isAuthLoading, canEdit, signIn, signOut } = useAuth()
  const { page, setPage } = useHashPage()
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [closingPosition, setClosingPosition] =
    useState<ClosePositionContext | null>(null)

  const loadTrades = useCallback(async () => {
    setIsLoading(true)
    try {
      if (canEdit) {
        await seedTradesDeduped(seedTrades, isDuplicateTrade)
      }
      const data = await getAllTrades()
      setTrades(data)
    } finally {
      setIsLoading(false)
    }
  }, [canEdit])

  useEffect(() => {
    if (isAuthLoading) return
    void loadTrades()
  }, [isAuthLoading, loadTrades])

  const openAddDrawer = () => {
    if (!canEdit) return
    setEditingTrade(null)
    setClosingPosition(null)
    setIsDrawerOpen(true)
  }

  const handleEdit = (trade: Trade) => {
    if (!canEdit) return
    setEditingTrade(trade)
    setClosingPosition(null)
    setIsDrawerOpen(true)
  }

  const handleClosePosition = (context: ClosePositionContext) => {
    if (!canEdit) return
    setEditingTrade(null)
    setClosingPosition(context)
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setEditingTrade(null)
    setClosingPosition(null)
  }

  const handleSaved = () => {
    closeDrawer()
    void loadTrades()
  }

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Options Trade Tracker</h1>
          <p className="subtitle">Public view · owner can edit when signed in</p>
          <nav className="app-nav" aria-label="Main">
            <button
              type="button"
              className={`nav-link ${page === 'trades' ? 'active' : ''}`}
              onClick={() => setPage('trades')}
            >
              Trades
            </button>
            <button
              type="button"
              className={`nav-link ${page === 'stats' ? 'active' : ''}`}
              onClick={() => setPage('stats')}
            >
              Statistics
            </button>
          </nav>
        </div>
        <div className="header-actions">
          <AuthBar
            canEdit={canEdit}
            userEmail={user?.email ?? null}
            isAuthLoading={isAuthLoading}
            onSignIn={signIn}
            onSignOut={signOut}
          />
          {canEdit && page === 'trades' && (
            <button
              type="button"
              className="add-trade-btn"
              onClick={openAddDrawer}
            >
              Add Trade
            </button>
          )}
        </div>
      </header>

      {page === 'stats' ? (
        <section className="card card-stats">
          <h2>Monthly Revenue</h2>
          {isLoading ? (
            <p className="loading">Loading chart...</p>
          ) : (
            <MonthlyRevenueChart trades={trades} />
          )}
        </section>
      ) : (
        <section className="card card-trades">
          <h2>Your Trades</h2>
          {isLoading ? (
            <p className="loading">Loading trades...</p>
          ) : (
            <TradesTable
              trades={trades}
              canEdit={canEdit}
              onEdit={handleEdit}
              onClosePosition={handleClosePosition}
              onTradeDeleted={loadTrades}
            />
          )}
        </section>
      )}

      {canEdit && (
        <TradeDrawer
          isOpen={isDrawerOpen}
          editingTrade={editingTrade}
          closingPosition={closingPosition}
          onClose={closeDrawer}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
