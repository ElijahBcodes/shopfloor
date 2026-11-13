import { useState } from 'react'

export default function AuthScreen({ supabase }) {
  const [mode, setMode] = useState('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    setError('')

    const result = mode === 'sign-in'
      ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
      : await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        })

    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    if (mode === 'sign-up' && !result.data.session) {
      setMessage('Check your email for a confirmation link, then come back here to sign in.')
    }
  }

  const isSignIn = mode === 'sign-in'

  return (
    <main className="access-shell">
      <section className="access-card" aria-labelledby="access-title">
        <a className="brand access-brand" href="/">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">shopfloor<span>.</span></span>
        </a>
        <p className="eyebrow">CNC SHOP OPERATIONS</p>
        <h1 id="access-title">{isSignIn ? 'Sign in to your shop' : 'Create your ShopFloor account'}</h1>
        <p className="access-copy">Keep the job queue and machine plan in sync with your crew.</p>

        <form className="access-form" onSubmit={submit}>
          <label className="form-field">
            <span>Email</span>
            <input
              autoComplete="email"
              autoFocus
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@shop.com"
            />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input
              autoComplete={isSignIn ? 'current-password' : 'new-password'}
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </label>
          {error && <p className="access-message error-message" role="alert">{error}</p>}
          {message && <p className="access-message success-message" role="status">{message}</p>}
          <button className="button button-primary access-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : isSignIn ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="access-switch">
          {isSignIn ? 'New to ShopFloor?' : 'Already have an account?'}{' '}
          <button type="button" onClick={() => { setMode(isSignIn ? 'sign-up' : 'sign-in'); setError(''); setMessage('') }}>
            {isSignIn ? 'Create an account' : 'Sign in'}
          </button>
        </p>
        <p className="access-footnote">Accounts are secured by Supabase Auth. Shop records are protected by database access policies.</p>
      </section>
    </main>
  )
}
