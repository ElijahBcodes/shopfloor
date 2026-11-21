import { useState } from 'react'

export default function WorkspaceSetup({ supabase, onComplete, connectionError }) {
  const [mode, setMode] = useState('create')
  const [shopName, setShopName] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [loadExample, setLoadExample] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')

    const result = mode === 'create'
      ? await supabase.rpc('create_shop', { p_name: shopName.trim(), p_seed_demo: loadExample })
      : await supabase.rpc('join_shop', { p_invite_code: inviteCode.trim() })

    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    await onComplete(result.data)
  }

  return (
    <main className="access-shell">
      <section className="access-card workspace-card" aria-labelledby="workspace-title">
        <a className="brand access-brand" href="/">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">shopfloor<span>.</span></span>
        </a>
        <p className="eyebrow">YOUR WORKSPACE</p>
        <h1 id="workspace-title">{mode === 'create' ? 'Set up your shop' : 'Join a shop'}</h1>
        <p className="access-copy">A shop is a private workspace. Its signed-in members share the same jobs and machine capacity.</p>
        {connectionError && <p className="access-message error-message" role="alert">Could not load your shops: {connectionError}</p>}

        <div className="setup-tabs" role="group" aria-label="Workspace options">
          <button type="button" className={mode === 'create' ? 'selected' : ''} onClick={() => { setMode('create'); setError('') }}>Create a shop</button>
          <button type="button" className={mode === 'join' ? 'selected' : ''} onClick={() => { setMode('join'); setError('') }}>Join with a code</button>
        </div>

        <form className="access-form" onSubmit={submit}>
          {mode === 'create' ? (
            <>
              <label className="form-field">
                <span>Shop name</span>
                <input autoFocus required maxLength={80} value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="e.g. Main shop" />
              </label>
              <label className="example-choice">
                <input type="checkbox" checked={loadExample} onChange={(event) => setLoadExample(event.target.checked)} />
                <span><strong>Load an example board</strong><small>Add editable sample jobs and four sample machines to get started.</small></span>
              </label>
            </>
          ) : (
            <label className="form-field">
              <span>One-time invite code</span>
              <input autoFocus required autoComplete="off" value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Paste the code from your shop owner" />
              <small className="field-hint">Codes expire after seven days and can be used once.</small>
            </label>
          )}
          {error && <p className="access-message error-message" role="alert">{error}</p>}
          <button className="button button-primary access-submit" type="submit" disabled={busy}>
            {busy ? 'Setting things up…' : mode === 'create' ? 'Create shop' : 'Join shop'}
          </button>
        </form>
        <p className="access-footnote">You can invite teammates from inside the shop. Shop data is isolated from other workspaces.</p>
      </section>
    </main>
  )
}
