import { useEffect } from 'react'
import { TradeForm } from './TradeForm'
import type { Trade } from '../types/trade'

export type ClosePositionContext = {
  sellTrade: Trade
  openQty: number
}

type TradeDrawerProps = {
  isOpen: boolean
  editingTrade: Trade | null
  closingPosition: ClosePositionContext | null
  onClose: () => void
  onSaved: () => void
}

export const TradeDrawer = ({
  isOpen,
  editingTrade,
  closingPosition,
  onClose,
  onSaved,
}: TradeDrawerProps) => {
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
        aria-labelledby="drawer-title"
      >
        <div className="drawer-header">
          <h2 id="drawer-title">
            {closingPosition
              ? 'Close Position'
              : editingTrade
                ? 'Edit Trade'
                : 'Add Trade'}
          </h2>
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
          <TradeForm
            editingTrade={editingTrade}
            closingPosition={closingPosition}
            onSaved={onSaved}
            onClose={onClose}
          />
        </div>
      </aside>
    </>
  )
}
