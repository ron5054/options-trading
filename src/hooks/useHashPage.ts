import { useEffect, useState } from 'react'

export type AppPage = 'trades' | 'stats'

const parseHash = (): AppPage =>
  window.location.hash === '#stats' ? 'stats' : 'trades'

export const useHashPage = () => {
  const [page, setPageState] = useState<AppPage>(parseHash)

  useEffect(() => {
    const onHashChange = () => setPageState(parseHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const setPage = (next: AppPage) => {
    const hash = next === 'stats' ? '#stats' : '#trades'
    if (window.location.hash !== hash) {
      window.location.hash = hash
    } else {
      setPageState(next)
    }
  }

  return { page, setPage }
}
