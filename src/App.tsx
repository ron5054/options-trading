import { useCallback, useEffect, useState } from 'react'
import { seedTrades, tradeKey } from './data/seedTrades'
import { getAllTrades, seedTradesDeduped } from './db/trades'
import {
  TradeDrawer,
  type ClosePositionContext,
} from './components/TradeDrawer'
import { MonthlyRevenueChart } from './components/MonthlyRevenueChart'
import { TradesTable } from './components/TradesTable'
import type { NewTrade, Trade } from './types/trade'

const isDuplicateTrade = (existing: Trade, incoming: NewTrade): boolean =>
  tradeKey(existing) === tradeKey(incoming)

export const App = () => {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null)
  const [closingPosition, setClosingPosition] =
    useState<ClosePositionContext | null>(null)

  const loadTrades = useCallback(async () => {
    await seedTradesDeduped(seedTrades, isDuplicateTrade)
    const data = await getAllTrades()
    setTrades(data)
    setIsLoading(false)
  }, [])

  useEffect(() => {
    loadTrades()
  }, [loadTrades])

  const openAddDrawer = () => {
    setEditingTrade(null)
    setClosingPosition(null)
    setIsDrawerOpen(true)
  }

  const handleEdit = (trade: Trade) => {
    setEditingTrade(trade)
    setClosingPosition(null)
    setIsDrawerOpen(true)
  }

  const handleClosePosition = (context: ClosePositionContext) => {
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
    loadTrades()
  }

  return (
    <div className='app'>
      <header className='app-header'>
        <div>
          <h1>Options Trade Tracker</h1>
          <p className='subtitle'>
            Track your options trades locally in your browser
          </p>
        </div>
        <button type='button' className='add-trade-btn' onClick={openAddDrawer}>
          Add Trade
        </button>
      </header>

      <section className='card'>
        <h2>Monthly Revenue</h2>
        {isLoading ? (
          <p className='loading'>Loading chart...</p>
        ) : (
          <MonthlyRevenueChart trades={trades} />
        )}
      </section>

      <section className='card'>
        <h2>Your Trades</h2>
        {isLoading ? (
          <p className='loading'>Loading trades...</p>
        ) : (
          <TradesTable
            trades={trades}
            onEdit={handleEdit}
            onClosePosition={handleClosePosition}
            onTradeDeleted={loadTrades}
          />
        )}
      </section>

      <TradeDrawer
        isOpen={isDrawerOpen}
        editingTrade={editingTrade}
        closingPosition={closingPosition}
        onClose={closeDrawer}
        onSaved={handleSaved}
      />
    </div>
  )
}
