import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const ownerEmail = (
  import.meta.env.VITE_OWNER_EMAIL || 'ron5054@gmail.com'
)
  .trim()
  .toLowerCase()

export const isOwnerUser = (user: User | null | undefined): boolean => {
  if (!user?.email || !ownerEmail) return false
  return user.email.toLowerCase() === ownerEmail
}

export const useAuth = () => {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setIsLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const user = session?.user ?? null
  const canEdit = isOwnerUser(user)

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    session,
    user,
    isLoading,
    canEdit,
    signIn,
    signOut,
  }
}
