import { useCallback, useEffect, useMemo, useState } from 'react'
import AuthScreen from './AuthScreen.jsx'
import WorkspaceSetup from './WorkspaceSetup.jsx'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'
import './App.css'
import './Auth.css'

const EMPTY_BOARD = { machines: [], jobs: [] }

const iconShapes = {
  overview: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
  jobs: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5h6M9 10h6M9 14h6M9 18h3" /><path d="M8 2.5h8" /></>,
  machines: <><path d="M3 20V8l4-3 4 3v12M11 12h10v8H3M15 12V8h3l3 4M7 12h.01M7 16h.01M15 16h.01" /><path d="M14 20v-3h4v3" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  check: <><path d="m5 12 4 4L19 6" /></>,
  edit: <><path d="m14 5 5 5M4 20l4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="M13 20h7" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  chevron: <><path d="m8 10 4 4 4-4" /></>,
}

const todayISO = (offset = 0) => {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function mapMachine(row) {
  return {
    id: row.id,
    make: row.make,
    name: row.name,
    type: row.type,
    status: row.status,
    utilization: row.utilization,
  }
}

function mapJob(row) {
  return {
    id: `JOB-${row.job_number}`,
    partNumber: row.part_number,
    title: row.title,
    material: row.material,
    quantity: row.quantity,
    status: row.status,
    machineId: row.machine_id ?? '',
    progress: row.progress,
    dueDate: row.due_date,
    dueTime: row.due_time?.slice(0, 5) ?? '15:00',
    priority: row.priority,
    operator: row.operator,
    operation: row.operation,
    isDemo: row.is_demo,
  }
}

function jobNumber(jobId) {
  return Number(String(jobId).replace(/^JOB-/, ''))
}

function Icon({ name, size = 18 }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {iconShapes[name]}
    </svg>
  )
}

function formatTime(time) {
  if (!time) return ''
  const [hour, minute] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(hour, minute, 0, 0)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

function formatDue(job) {
  const today = todayISO()
  const tomorrow = todayISO(1)
  const label = job.dueDate === today ? 'Today' : job.dueDate === tomorrow ? 'Tomorrow' : new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${job.dueDate}T12:00:00`))
  return `${label} · ${formatTime(job.dueTime)}`
}

function getStatusLabel(status) {
  return ({ 'in-progress': 'In progress', queued: 'Queued', paused: 'Paused', complete: 'Complete' })[status] ?? status
}

function App() {
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured)
  const [shops, setShops] = useState([])
  const [shop, setShop] = useState(null)
  const [shopReady, setShopReady] = useState(false)
  const [board, setBoard] = useState(EMPTY_BOARD)
  const [boardReady, setBoardReady] = useState(false)
  const [view, setView] = useState('overview')
  const [filter, setFilter] = useState('open')
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(null)
  const [machineDraft, setMachineDraft] = useState(null)
  const [appError, setAppError] = useState('')
  const [saving, setSaving] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteCopied, setInviteCopied] = useState(false)

  const { machines, jobs } = board

  useEffect(() => {
    if (!supabase) return undefined

    let active = true
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAppError(error.message)
      setSession(data.session)
      setAuthReady(true)
      if (!data.session) {
        setShopReady(true)
        setBoardReady(true)
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession)
      setAuthReady(true)
      if (!currentSession) {
        setShops([])
        setShop(null)
        setBoard(EMPTY_BOARD)
        setShopReady(true)
        setBoardReady(true)
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const refreshShops = useCallback(async (preferredShopId = null) => {
    if (!supabase || !session?.user?.id) return null

    setAppError('')
    setShopReady(false)
    const { data: memberships, error: membershipError } = await supabase
      .from('shop_members')
      .select('shop_id, role')
      .eq('user_id', session.user.id)
    if (membershipError) {
      setAppError(membershipError.message)
      setShopReady(true)
      return null
    }

    const membershipByShop = new Map((memberships ?? []).map((membership) => [membership.shop_id, membership.role]))
    const shopIds = [...membershipByShop.keys()]
    if (!shopIds.length) {
      setShops([])
      setShop(null)
      setShopReady(true)
      return null
    }

    const { data, error } = await supabase
      .from('shops')
      .select('id, name, created_at')
      .in('id', shopIds)
      .order('created_at', { ascending: true })
    if (error) {
      setAppError(error.message)
      setShopReady(true)
      return null
    }

    const nextShops = (data ?? []).map((item) => ({ ...item, role: membershipByShop.get(item.id) }))
    setShops(nextShops)
    const nextShop = nextShops.find((item) => item.id === preferredShopId) ?? nextShops[0] ?? null
    setBoardReady(false)
    setShop(nextShop)
    setShopReady(true)
    return nextShop
  }, [session])

  useEffect(() => {
    if (!authReady || !session) return
    const timer = window.setTimeout(() => { void refreshShops() }, 0)
    return () => window.clearTimeout(timer)
  }, [authReady, refreshShops, session])

  const refreshBoard = useCallback(async (showLoading = false) => {
    if (!supabase || !shop?.id) return
    if (showLoading) setBoardReady(false)

    const [machineResult, jobResult] = await Promise.all([
      supabase.from('machines').select('*').eq('shop_id', shop.id).order('id'),
      supabase.from('jobs').select('*').eq('shop_id', shop.id).order('job_number', { ascending: false }),
    ])
    if (machineResult.error || jobResult.error) {
      setAppError(machineResult.error?.message ?? jobResult.error?.message ?? 'Could not load shop data.')
      setBoardReady(true)
      return
    }

    setBoard({
      machines: (machineResult.data ?? []).map(mapMachine),
      jobs: (jobResult.data ?? []).map(mapJob),
    })
    setAppError('')
    setBoardReady(true)
  }, [shop])

  useEffect(() => {
    if (!shop?.id) return undefined

    const loadTimer = window.setTimeout(() => { void refreshBoard(true) }, 0)
    const channel = supabase
      .channel(`shopfloor-${shop.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs', filter: `shop_id=eq.${shop.id}` }, () => refreshBoard())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines', filter: `shop_id=eq.${shop.id}` }, () => refreshBoard())
      .subscribe()

    return () => {
      window.clearTimeout(loadTimer)
      supabase.removeChannel(channel)
    }
  }, [refreshBoard, shop?.id])

  const stats = useMemo(() => {
    const runningMachines = machines.filter((machine) => machine.status === 'running').length
    const openJobs = jobs.filter((job) => job.status !== 'complete').length
    const dueToday = jobs.filter((job) => job.status !== 'complete' && job.dueDate === todayISO()).length
    const averageLoad = machines.length ? Math.round(machines.reduce((sum, machine) => sum + machine.utilization, 0) / machines.length) : 0
    return { runningMachines, openJobs, dueToday, averageLoad }
  }, [jobs, machines])

  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return jobs
      .filter((job) => {
        if (filter === 'open' && job.status === 'complete') return false
        if (filter !== 'open' && job.status !== filter) return false
        if (!normalizedQuery) return true
        const machine = machines.find((item) => item.id === job.machineId)
        return [job.id, job.title, job.partNumber, job.material, machine?.name]
          .some((value) => value?.toLowerCase().includes(normalizedQuery))
      })
      .sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2 }
        if (a.status === 'complete' && b.status !== 'complete') return 1
        if (b.status === 'complete' && a.status !== 'complete') return -1
        return (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2) || a.dueDate.localeCompare(b.dueDate)
      })
  }, [filter, jobs, machines, query])

  function openNewJob() {
    const availableMachine = machines.find((machine) => machine.status === 'idle' || machine.status === 'setup')
    setDraft({
      id: '',
      title: '',
      partNumber: '',
      material: '6061-T6 aluminum',
      quantity: 1,
      machineId: availableMachine?.id ?? machines[0]?.id ?? '',
      progress: 0,
      status: 'queued',
      dueDate: todayISO(1),
      dueTime: '15:00',
      priority: 'normal',
      operator: '',
      operation: 'Op 1 of 1',
    })
  }

  function openNewMachine() {
    const nextNumber = machines.reduce((highest, machine) => {
      const number = Number(machine.id.replace(/^M-/, '')) || 0
      return Math.max(highest, number)
    }, 0) + 1
    setMachineDraft({
      id: `M-${String(nextNumber).padStart(2, '0')}`,
      make: '',
      name: '',
      type: '',
      status: 'idle',
      utilization: 0,
      originalId: '',
    })
  }

  async function saveMachine(event) {
    event.preventDefault()
    if (!machineDraft || !shop) return
    setSaving(true)
    setAppError('')
    const machineDetails = {
      shop_id: shop.id,
      id: machineDraft.id.trim().toUpperCase(),
      make: machineDraft.make.trim(),
      name: machineDraft.name.trim(),
      type: machineDraft.type.trim(),
    }
    const result = machineDraft.originalId
      ? await supabase.from('machines').update(machineDetails).eq('shop_id', shop.id).eq('id', machineDraft.originalId)
      : await supabase.from('machines').insert({
          ...machineDetails,
          status: machineDraft.status,
          utilization: Number(machineDraft.utilization),
        })
    setSaving(false)
    if (result.error) {
      setAppError(result.error.message)
      return
    }
    setMachineDraft(null)
    await refreshBoard()
  }

  async function saveJob(event) {
    event.preventDefault()
    if (!draft || !shop) return
    setSaving(true)
    setAppError('')

    const payload = {
      shop_id: shop.id,
      part_number: draft.partNumber.trim(),
      title: draft.title.trim(),
      material: draft.material.trim(),
      quantity: Number(draft.quantity),
      status: draft.id ? draft.status : 'queued',
      machine_id: draft.machineId || null,
      progress: draft.id ? Number(draft.progress) : 0,
      due_date: draft.dueDate,
      due_time: draft.dueTime,
      priority: draft.priority,
      operator: draft.operator.trim(),
      operation: draft.operation?.trim() ?? '',
      is_demo: false,
    }

    const result = draft.id
      ? await supabase.from('jobs').update(payload).eq('shop_id', shop.id).eq('job_number', jobNumber(draft.id)).select('*').single()
      : await supabase.from('jobs').insert(payload).select('*').single()

    setSaving(false)
    if (result.error) {
      setAppError(result.error.message)
      return
    }
    setDraft(null)
    await refreshBoard()
  }

  async function changeJobStatus(job, status) {
    if (!shop) return
    setSaving(true)
    setAppError('')
    const { error } = await supabase.rpc('change_job_status', {
      p_shop_id: shop.id,
      p_job_number: jobNumber(job.id),
      p_status: status,
    })
    setSaving(false)
    if (error) {
      setAppError(error.message)
      return
    }
    await refreshBoard()
  }

  async function toggleMachine(machine) {
    if (!shop) return
    setSaving(true)
    setAppError('')
    const { error } = await supabase.rpc('toggle_machine', {
      p_shop_id: shop.id,
      p_machine_id: machine.id,
    })
    setSaving(false)
    if (error) {
      setAppError(error.message)
      return
    }
    await refreshBoard()
  }

  async function createInvite() {
    if (!shop) return
    setInviteBusy(true)
    setAppError('')
    const { data, error } = await supabase.rpc('create_shop_invite', { p_shop_id: shop.id })
    setInviteBusy(false)
    if (error) {
      setAppError(error.message)
      return
    }
    setInviteCopied(false)
    setInviteCode(data)
  }

  async function copyInviteCode() {
    try {
      await navigator.clipboard.writeText(inviteCode)
      setInviteCopied(true)
    } catch {
      setAppError('Could not copy automatically. Select and copy the invite code instead.')
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setAppError(error.message)
  }

  const avatarInitials = (session?.user?.email?.slice(0, 2) || 'SF').toUpperCase()
  const hasStarterData = jobs.some((job) => job.isDemo)

  const title = view === 'jobs' ? 'Job queue' : view === 'machines' ? 'Machines' : 'Production overview'
  const subtitle = view === 'jobs'
    ? 'Prioritize work, assign machines, and keep every part moving.'
    : view === 'machines'
      ? 'Availability and utilization across your shop floor.'
      : 'A clear view of what is running, what is next, and what needs attention.'
  const activeJobs = visibleJobs.filter((job) => job.status !== 'complete')
  const displayedJobs = view === 'overview' ? activeJobs.slice(0, 4) : visibleJobs

  if (!isSupabaseConfigured) {
    return (
      <main className="access-shell">
        <section className="access-card setup-required-card">
          <a className="brand access-brand" href="/">
            <span className="brand-mark"><span /><span /><span /><span /></span>
            <span className="brand-name">shopfloor<span>.</span></span>
          </a>
          <p className="eyebrow">ONE-TIME SETUP</p>
          <h1>Connect ShopFloor to its database</h1>
          <p className="access-copy">Add your Supabase project URL and publishable key as <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>. Run the SQL migration in <code>supabase/migrations</code> first.</p>
          <p className="access-footnote">The setup steps are in the project README. Never use a Supabase service-role key in browser settings.</p>
        </section>
      </main>
    )
  }

  if (!authReady) {
    return <main className="access-shell"><p className="access-loading">Checking your ShopFloor session…</p></main>
  }

  if (!session) return <AuthScreen supabase={supabase} />

  if (!shopReady) {
    return <main className="access-shell"><p className="access-loading">Loading your shops…</p></main>
  }

  if (!shops.length) {
    return <WorkspaceSetup supabase={supabase} onComplete={refreshShops} connectionError={appError} />
  }

  if (!shop || !boardReady) {
    return <main className="access-shell"><p className="access-loading">Loading the production board…</p></main>
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={(event) => { event.preventDefault(); setView('overview') }}>
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">shopfloor<span>.</span></span>
        </a>

        <label className="workspace-switcher">
          <span className="workspace-avatar">{shop.name.slice(0, 1).toUpperCase()}</span>
          <span className="workspace-copy"><strong>{shop.name}</strong><small>Shared workspace</small></span>
          <select aria-label="Choose shop workspace" value={shop.id} onChange={(event) => { setBoardReady(false); setShop(shops.find((item) => item.id === event.target.value) ?? null) }}>
            {shops.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Icon name="chevron" size={16} />
        </label>

        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'jobs', label: 'Job queue' },
            { id: 'machines', label: 'Machines' },
          ].map((item) => (
            <button className={`nav-item ${view === item.id ? 'active' : ''}`} key={item.id} onClick={() => setView(item.id)} type="button">
              <Icon name={item.id} size={18} />
              <span>{item.label}</span>
              {item.id === 'jobs' && <span className="nav-count">{stats.openJobs}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="shift-card">
            <div className="shift-card-top"><span className="live-dot" /> <span>DAY SHIFT</span><span className="shift-time">06:00–14:30</span></div>
            <strong>Shift in progress</strong>
            <div className="shift-meter"><span style={{ width: '72%' }} /></div>
            <small>2h 18m remaining</small>
          </div>
          <div className="user-profile">
            <span className="user-avatar">{avatarInitials}</span>
            <span className="user-copy"><strong>{session.user.email}</strong><small>Signed in</small></span>
            <button type="button" className="profile-menu" onClick={signOut} aria-label="Sign out" title="Sign out">↗</button>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Operations</span><span className="breadcrumb-separator">/</span><strong>{title}</strong></div>
          <div className="topbar-right">
            <span className="sample-label"><span className="sample-dot" /> {hasStarterData ? 'Starter data' : 'Shared data'}</span>
            {shop.role === 'owner' && <button type="button" className="share-button" onClick={createInvite} disabled={inviteBusy}>{inviteBusy ? 'Creating…' : 'Invite teammate'}</button>}
            <span className="date-label">{new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</span>
            <span className="top-avatar">{avatarInitials}</span>
          </div>
        </header>

        <div className="page-content">
          {appError && <p className="app-alert" role="alert">{appError}<button type="button" aria-label="Dismiss error" onClick={() => setAppError('')}><Icon name="close" size={15} /></button></p>}
          <section className="page-heading">
            <div>
              <p className="eyebrow">{new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date()).toUpperCase()} · DAY SHIFT</p>
              <h1>{title}</h1>
              <p className="page-subtitle">{subtitle}</p>
            </div>
            {view === 'machines'
              ? <button className="button button-primary" type="button" onClick={openNewMachine}><Icon name="plus" size={17} /> Add machine</button>
              : <button className="button button-primary" type="button" onClick={openNewJob}><Icon name="plus" size={17} /> New job</button>}
          </section>

          {view !== 'machines' && (
            <>
              <section className="stats-grid" aria-label="Production summary">
                <article className="stat-card">
                  <div className="stat-top"><span className="stat-label">Machines running</span><span className="stat-icon green"><Icon name="machines" size={17} /></span></div>
                  <div className="stat-value">{stats.runningMachines}<span className="stat-total"> / {machines.length}</span></div>
                  <div className="stat-foot"><span className="status-pill status-running"><span className="status-dot" /> Shared shop status</span></div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span className="stat-label">Open jobs</span><span className="stat-icon blue"><Icon name="jobs" size={17} /></span></div>
                  <div className="stat-value">{stats.openJobs}<span className="stat-total"> jobs</span></div>
                  <div className="stat-foot"><span className="stat-foot-strong">{stats.dueToday} due today</span><span className="stat-muted"> · across the shop</span></div>
                </article>
                <article className="stat-card">
                  <div className="stat-top"><span className="stat-label">Average utilization</span><span className="stat-icon amber"><span className="utilization-glyph">◔</span></span></div>
                  <div className="stat-value">{stats.averageLoad}<span className="stat-total">%</span></div>
                  <div className="stat-foot"><span className="utilization-track"><span style={{ width: `${stats.averageLoad}%` }} /></span><span className="stat-muted"> shop-wide</span></div>
                </article>
              </section>

              <section className="notice-bar">
                <span className="notice-icon"><Icon name="clock" size={17} /></span>
                <span><strong>Shift handoff at 2:30 PM</strong><span className="notice-copy"> · {stats.dueToday} job{stats.dueToday === 1 ? '' : 's'} due before the end of the day.</span></span>
                <button type="button" className="notice-link" onClick={() => { setView('jobs'); setFilter('open') }}>Review queue <Icon name="arrow" size={15} /></button>
              </section>
            </>
          )}

          <div className={`dashboard-grid ${view === 'machines' ? 'single-column' : ''}`}>
            {view !== 'machines' && (
              <section className="panel jobs-panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-title-row"><h2>{view === 'overview' ? 'Today’s production' : 'All jobs'}</h2><span className="subtle-count">{activeJobs.length} active</span></div>
                    <p className="panel-subtitle">{view === 'overview' ? 'Keep priority work moving through the shop.' : 'Search, prioritize, and update the production queue.'}</p>
                  </div>
                  <button className="icon-button search-trigger" type="button" aria-label="Focus job search" onClick={() => document.getElementById('job-search')?.focus()}><Icon name="search" size={18} /></button>
                </div>

                <div className="job-toolbar">
                  <div className="filter-tabs" role="group" aria-label="Filter jobs">
                    {[
                      { id: 'open', label: 'Open' },
                      { id: 'in-progress', label: 'In progress' },
                      { id: 'queued', label: 'Queued' },
                      { id: 'complete', label: 'Complete' },
                    ].map((item) => (
                      <button type="button" key={item.id} className={`filter-tab ${filter === item.id ? 'selected' : ''}`} onClick={() => setFilter(item.id)}>{item.label}</button>
                    ))}
                  </div>
                  <label className="search-field"><Icon name="search" size={16} /><input id="job-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a job..." aria-label="Search jobs" /></label>
                </div>

                <div className="job-list">
                  {displayedJobs.length === 0 ? (
                    <div className="empty-state"><span className="empty-icon"><Icon name="jobs" size={21} /></span><strong>No jobs found</strong><p>Try a different search or add a job to the queue.</p><button type="button" className="button button-secondary" onClick={openNewJob}><Icon name="plus" size={16} /> Add a job</button></div>
                  ) : displayedJobs.map((job) => {
                    const machine = machines.find((item) => item.id === job.machineId)
                    const canStart = machine?.status === 'idle'
                    return (
                      <article className={`job-row ${job.status === 'complete' ? 'job-complete' : ''}`} key={job.id}>
                        <div className="job-main">
                          <div className="job-id-line"><span className="job-id">{job.id}</span><span className={`priority-dot priority-${job.priority}`} /><span className={`priority-label priority-text-${job.priority}`}>{job.priority}</span></div>
                          <button type="button" className="job-title" onClick={() => setDraft({ ...job })}>{job.title}<span className="part-number"> · {job.partNumber}</span></button>
                          <div className="job-meta"><span>{job.quantity} pcs</span><span className="meta-divider" /><span>{job.material}</span><span className="meta-divider" /><span>{job.operation}</span></div>
                        </div>
                        <div className="job-machine"><span className="column-label">MACHINE</span><span className="machine-assignment"><span className={`machine-status-dot ${machine?.status ?? 'idle'}`} />{machine ? `${machine.make} ${machine.name}` : 'Unassigned'}</span></div>
                        <div className="job-due"><span className="column-label">DUE</span><span className={job.dueDate === todayISO() && job.status !== 'complete' ? 'due-today' : ''}><Icon name="clock" size={14} />{formatDue(job)}</span></div>
                        <div className="job-progress">
                          <div className="progress-label"><span>{getStatusLabel(job.status)}</span><strong>{job.progress}%</strong></div>
                          <div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div>
                        </div>
                        <div className="job-operator" title={`Operator ${job.operator || 'unassigned'}`}><span className="operator-avatar">{job.operator || '—'}</span><span>{job.operator || 'Unassigned'}</span></div>
                        <div className="job-actions">
                          {job.status === 'complete' ? (
                            <span className="complete-check"><Icon name="check" size={17} /></span>
                          ) : (
                            <button type="button" className={`row-action ${job.status === 'in-progress' ? 'row-action-complete' : ''}`} onClick={() => changeJobStatus(job, job.status === 'in-progress' ? 'complete' : 'in-progress')} disabled={saving || (job.status !== 'in-progress' && !canStart)} title={job.status === 'in-progress' ? 'Mark complete' : canStart ? 'Start job' : 'Assigned machine is busy'} aria-label={job.status === 'in-progress' ? `Complete ${job.id}` : `Start ${job.id}`}>
                              <Icon name={job.status === 'in-progress' ? 'check' : 'arrow'} size={17} />
                            </button>
                          )}
                        </div>
                      </article>
                    )
                  })}
                </div>
                {view === 'overview' && jobs.filter((job) => job.status !== 'complete').length > 4 && (
                  <button type="button" className="view-all-link" onClick={() => setView('jobs')}>View all {jobs.filter((job) => job.status !== 'complete').length} open jobs <Icon name="arrow" size={15} /></button>
                )}
                <p className="prototype-note">{hasStarterData ? 'Starter work orders · Changes sync across shop members' : 'Changes sync across signed-in shop members'}</p>
              </section>
            )}

            {view !== 'jobs' && (
              <section className="panel machines-panel">
                <div className="panel-heading">
                  <div>
                    <div className="panel-title-row"><h2>{view === 'overview' ? 'Machine status' : 'Shop machines'}</h2><span className="live-indicator"><span className="live-dot" /> SHARED</span></div>
                    <p className="panel-subtitle">Availability and current utilization.</p>
                  </div>
                  <button type="button" className="text-button" onClick={() => setView('machines')}>View all <Icon name="arrow" size={15} /></button>
                </div>
                <div className="machine-list">
                  {machines.length === 0
                    ? <div className="machine-empty-state"><strong>No machines yet</strong><p>Add the machines on your floor to start tracking capacity.</p><button className="button button-secondary" type="button" onClick={openNewMachine}><Icon name="plus" size={16} /> Add a machine</button></div>
                    : machines.map((machine) => {
                    const currentJob = jobs.find((job) => job.machineId === machine.id && job.status === 'in-progress')
                    return (
                      <article className="machine-card" key={machine.id}>
                        <div className="machine-card-top">
                          <div className="machine-avatar"><Icon name="machines" size={19} /></div>
                          <div className="machine-name-wrap"><span className="machine-make">{machine.make} · {machine.id}</span><strong>{machine.name}</strong><span className="machine-type">{machine.type}</span></div>
                          <span className={`machine-state state-${machine.status}`}><span className="status-dot" />{machine.status}</span>
                        </div>
                        <div className="machine-current">
                          <span className="column-label">CURRENT JOB</span>
                          {currentJob ? <span><strong>{currentJob.id}</strong> · {currentJob.title}</span> : <span className="machine-empty">{machine.status === 'setup' ? 'Setup in progress' : 'No active job'}</span>}
                        </div>
                        <div className="machine-card-bottom">
                          <div className="machine-utilization"><div className="progress-label"><span>Utilization</span><strong>{machine.utilization}%</strong></div><div className="progress-track"><span style={{ width: `${machine.utilization}%` }} /></div></div>
                          <div className="machine-actions">
                            <button type="button" className="machine-edit" onClick={() => setMachineDraft({ ...machine, originalId: machine.id })}>Edit</button>
                            <button type="button" className="machine-toggle" onClick={() => toggleMachine(machine)} disabled={saving || machine.status === 'maintenance'}>{machine.status === 'running' ? 'Pause' : machine.status === 'setup' ? 'Set ready' : machine.status === 'maintenance' ? 'In service' : 'Set running'}</button>
                          </div>
                        </div>
                      </article>
                    )
                  })}
                </div>
                <div className="machine-legend"><span><i className="legend-dot running" />Running</span><span><i className="legend-dot idle" />Idle</span><span><i className="legend-dot setup" />Setup</span></div>
              </section>
            )}
          </div>
        </div>
      </main>

      {draft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDraft(null) }}>
          <section className="job-modal" role="dialog" aria-modal="true" aria-labelledby="job-modal-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{draft.id ? 'UPDATE WORK ORDER' : 'ADD TO PRODUCTION'}</p><h2 id="job-modal-title">{draft.id ? 'Edit job' : 'New job'}</h2></div>
              <button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setDraft(null)}><Icon name="close" size={19} /></button>
            </div>
            <form onSubmit={saveJob}>
              <label className="form-field full-field"><span>Part or job name</span><input required autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="e.g. Valve housing" /></label>
              <div className="form-grid">
                <label className="form-field"><span>Part number</span><input required value={draft.partNumber} onChange={(event) => setDraft({ ...draft, partNumber: event.target.value })} placeholder="e.g. V-104" /></label>
                <label className="form-field"><span>Quantity</span><input required type="number" min="1" step="1" value={draft.quantity} onChange={(event) => setDraft({ ...draft, quantity: event.target.value })} /></label>
                <label className="form-field"><span>Material</span><input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} placeholder="e.g. 6061-T6 aluminum" /></label>
              <label className="form-field"><span>Machine</span><select disabled={Boolean(draft.id && draft.status !== 'queued')} value={draft.machineId} onChange={(event) => setDraft({ ...draft, machineId: event.target.value })}><option value="">Unassigned</option>{machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.make} {machine.name} · {machine.status}</option>)}</select></label>
                <label className="form-field"><span>Due date</span><input required type="date" value={draft.dueDate} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value })} /></label>
                <label className="form-field"><span>Due time</span><input required type="time" value={draft.dueTime} onChange={(event) => setDraft({ ...draft, dueTime: event.target.value })} /></label>
                <label className="form-field"><span>Priority</span><select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}><option value="urgent">Urgent</option><option value="high">High</option><option value="normal">Normal</option></select></label>
                <label className="form-field"><span>Operator initials</span><input maxLength="4" value={draft.operator} onChange={(event) => setDraft({ ...draft, operator: event.target.value.toUpperCase() })} placeholder="e.g. KM" /></label>
              </div>
              <div className="modal-footer"><p>Shared with {shop.name}</p><button type="button" className="button button-secondary" onClick={() => setDraft(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add to queue'}</button></div>
            </form>
          </section>
        </div>
      )}
      {machineDraft && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMachineDraft(null) }}>
          <section className="job-modal machine-modal" role="dialog" aria-modal="true" aria-labelledby="machine-modal-title">
            <div className="modal-heading">
              <div><p className="eyebrow">{machineDraft.originalId ? 'UPDATE SHOP EQUIPMENT' : 'ADD TO SHOP CAPACITY'}</p><h2 id="machine-modal-title">{machineDraft.originalId ? 'Edit machine' : 'Add machine'}</h2></div>
              <button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setMachineDraft(null)}><Icon name="close" size={19} /></button>
            </div>
            <form onSubmit={saveMachine}>
              <div className="form-grid">
                <label className="form-field"><span>Machine ID</span><input required maxLength={24} value={machineDraft.id} onChange={(event) => setMachineDraft({ ...machineDraft, id: event.target.value })} placeholder="e.g. M-01" /></label>
                <label className="form-field"><span>Make</span><input value={machineDraft.make} onChange={(event) => setMachineDraft({ ...machineDraft, make: event.target.value })} placeholder="e.g. HAAS" /></label>
                <label className="form-field"><span>Model or name</span><input required value={machineDraft.name} onChange={(event) => setMachineDraft({ ...machineDraft, name: event.target.value })} placeholder="e.g. VF-2" /></label>
                <label className="form-field"><span>Machine type</span><input value={machineDraft.type} onChange={(event) => setMachineDraft({ ...machineDraft, type: event.target.value })} placeholder="e.g. 3-axis VMC" /></label>
              </div>
              <div className="modal-footer"><p>Machine capacity is shared with {shop.name}</p><button type="button" className="button button-secondary" onClick={() => setMachineDraft(null)}>Cancel</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? 'Saving…' : 'Save machine'}</button></div>
            </form>
          </section>
        </div>
      )}
      {inviteCode && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInviteCode('') }}>
          <section className="invite-modal" role="dialog" aria-modal="true" aria-labelledby="invite-modal-title">
            <div className="modal-heading">
              <div><p className="eyebrow">ADD A TEAMMATE</p><h2 id="invite-modal-title">Invite to {shop.name}</h2></div>
              <button type="button" className="icon-button" aria-label="Close dialog" onClick={() => setInviteCode('')}><Icon name="close" size={19} /></button>
            </div>
            <p className="invite-copy">Share this one-time code with a teammate. They’ll need a ShopFloor account to join; the code expires in seven days.</p>
            <code className="invite-code">{inviteCode}</code>
            <div className="invite-actions">
              <button type="button" className="button button-secondary" onClick={createInvite} disabled={inviteBusy}>Create another code</button>
              <button type="button" className="button button-primary" onClick={copyInviteCode}>{inviteCopied ? 'Copied' : 'Copy code'}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
