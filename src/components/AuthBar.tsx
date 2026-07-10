import { useState, type FormEvent } from 'react'

type AuthBarProps = {
  canEdit: boolean
  userEmail: string | null
  isAuthLoading: boolean
  onSignIn: (email: string, password: string) => Promise<void>
  onSignOut: () => Promise<void>
}

export const AuthBar = ({
  canEdit,
  userEmail,
  isAuthLoading,
  onSignIn,
  onSignOut,
}: AuthBarProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSignIn(email.trim(), password)
      setPassword('')
      setIsOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthLoading) {
    return <div className="auth-bar" />
  }

  if (userEmail) {
    return (
      <div className="auth-bar">
        <span className="auth-email">
          {canEdit ? userEmail : `${userEmail} (view only)`}
        </span>
        <button
          type="button"
          className="auth-btn secondary"
          onClick={() => {
            void onSignOut()
          }}
        >
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="auth-bar">
      {isOpen ? (
        <form className="auth-form" onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            autoComplete="username"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button type="submit" className="auth-btn" disabled={isSubmitting}>
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
          <button
            type="button"
            className="auth-btn secondary"
            onClick={() => {
              setIsOpen(false)
              setError(null)
            }}
          >
            Cancel
          </button>
          {error && <p className="auth-error">{error}</p>}
        </form>
      ) : (
        <button
          type="button"
          className="auth-btn secondary"
          onClick={() => setIsOpen(true)}
        >
          Owner sign in
        </button>
      )}
    </div>
  )
}
