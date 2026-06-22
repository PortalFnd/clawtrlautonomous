'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { WalletCommandCenter } from '../../components/WalletCommandCenter'
import { CommandBridge } from '../../components/CommandBridge'
import type { WalletSnapshot, WalletAction } from '../../lib/types'
import { timeAgo } from '../../lib/utils'

export default function WalletDeckPage() {
  const [snapshot, setSnapshot] = useState<WalletSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState<WalletAction[]>([])
  const [lastSynced, setLastSynced] = useState<string>('')
  const [stats, setStats] = useState<{ transfers: number; contractWrites: number; x402: number; totalEntries: number; todayEntries: number; usdcSpentToday: number } | null>(null)
  const [copied, setCopied] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [setupMode, setSetupMode] = useState<'generate' | 'import'>('generate')
  const [importKey, setImportKey] = useState('')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState('')
  const [generatedMnemonic, setGeneratedMnemonic] = useState('')
  const [setupSuccess, setSetupSuccess] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch('/api/wallet').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.wallet) {
        setSnapshot(data.wallet)
        setLastSynced(data.generatedAt ? timeAgo(data.generatedAt) : 'just now')
        if (data.stats) setStats(data.stats)
      }
    }).finally(() => setLoading(false))

    fetch('/api/wallet/actions').then(r => r.ok ? r.json() : null).then(data => {
      if (Array.isArray(data?.actions)) {
        setActions(data.actions)
      }
    }).catch(() => {})
  }, [])

  const balances = useMemo(() => snapshot?.balances?.filter(b => b.amount > 0) ?? [], [snapshot])
  const totalValueUsd = useMemo(() => balances.reduce((sum, asset) => sum + (asset.usd || 0), 0), [balances])
  const dailyCapUsd = snapshot?.dailyCapUsd ?? null
  const spentTodayUsd = snapshot?.spentTodayUsd ?? null
  const capUsage = dailyCapUsd && spentTodayUsd ? Math.min(100, Math.round((spentTodayUsd / dailyCapUsd) * 100)) : 0
  const autopayEnabled = snapshot?.autopay?.enabled ?? false
  const autopayOutstanding = snapshot?.autopay?.outstandingUsd ?? 0

  const insights = useMemo(() => {
    const notes: string[] = []
    if (!snapshot?.address) notes.push('Wallet not linked. Click "Link Wallet" to generate or import credentials.')
    if (!balances.length) notes.push('No balance telemetry captured. Queue a sync action from the command centre.')
    if (dailyCapUsd) {
      notes.push(`Daily spend cap set at ${formatUsd(dailyCapUsd)} with ${capUsage}% utilised today.`)
    } else {
      notes.push('Daily spend cap is not configured. Add a cap to enforce guardrails.')
    }
    if (autopayEnabled) notes.push(`Autopay is active with ${formatUsd(autopayOutstanding)} queued for settlement.`)
    return notes
  }, [snapshot, balances, dailyCapUsd, capUsage, autopayEnabled, autopayOutstanding])

  const healthLabel = loading ? 'Syncing' : snapshot?.health === 'alert' ? 'Alert' : snapshot?.health === 'warn' ? 'Attention' : 'Ready'

  const handleCopy = () => {
    if (!snapshot?.address || typeof navigator === 'undefined') return
    navigator.clipboard?.writeText(snapshot.address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  const handleSetup = async () => {
    setSetupLoading(true)
    setSetupError('')
    setGeneratedMnemonic('')
    try {
      const res = await fetch('/api/wallet/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setupMode === 'import' ? { mode: 'import', privateKey: importKey } : { mode: 'generate' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSetupError(data.error || 'Setup failed')
        return
      }
      if (data.mnemonic) setGeneratedMnemonic(data.mnemonic)
      setSetupSuccess(true)
      // Refresh wallet data
      fetch('/api/wallet').then(r => r.ok ? r.json() : null).then(d => {
        if (d?.wallet) { setSnapshot(d.wallet); setLastSynced(d.generatedAt ? timeAgo(d.generatedAt) : 'just now') }
      })
    } catch (err: any) {
      setSetupError(err.message || 'Network error')
    } finally {
      setSetupLoading(false)
    }
  }

  const walletLinked = !!snapshot?.address

  return (
    <div className="mission-root min-h-screen flex flex-col">
      <CommandBridge />
      <div className="wallet-shell">
      <div className="wallet-atmosphere" aria-hidden="true">
        <span className="wallet-glow wallet-glow-a" />
        <span className="wallet-glow wallet-glow-b" />
      </div>

      <header className="wallet-header">
        <div className="wallet-brand">
          <span className="wallet-brand-kicker">Workspace 02 // Treasury Vault</span>
          <h1 className="wallet-brand-title">Treasury Vault — Base L2 ops</h1>
          <p className="wallet-brand-sub">Live treasury controls, guardrails, and on-chain telemetry. Every move stays inside the configured caps.</p>
        </div>
        <div className="wallet-header-meta">
          <span className={`wallet-status-pill wallet-status-${snapshot?.health ?? 'idle'}`}>{healthLabel}</span>
          <span className="wallet-meta-chip">{snapshot?.network || 'Network: pending'}</span>
          <span className="wallet-meta-chip">Snapshot {loading ? 'syncing…' : lastSynced || '—'}</span>
          <Link href="/" className="wallet-link-btn">Return to Fleet Bay</Link>
        </div>
      </header>

      <section className="wallet-hero">
        <div className="wallet-hero-copy">
          <div className="wallet-metric-grid">
            <div className="wallet-metric-card">
              <span className="wallet-metric-label">Treasury value</span>
              <span className="wallet-metric-value">{formatUsd(totalValueUsd)}</span>
              <span className="wallet-metric-sub">Across {balances.length} asset{balances.length === 1 ? '' : 's'}</span>
            </div>
            <div className="wallet-metric-card">
              <span className="wallet-metric-label">Spend usage</span>
              <span className="wallet-metric-value">{formatUsd(spentTodayUsd)}</span>
              <div className="wallet-progress">
                <div className="wallet-progress-fill" style={{ width: dailyCapUsd ? `${capUsage}%` : spentTodayUsd ? '14%' : '0%' }} />
              </div>
              <span className="wallet-metric-sub">{dailyCapUsd ? `${capUsage}% of ${formatUsd(dailyCapUsd)}` : 'No daily cap configured'}</span>
            </div>
            <div className="wallet-metric-card">
              <span className="wallet-metric-label">Autopay status</span>
              <span className={`wallet-metric-value ${autopayEnabled ? 'text-eva-green' : ''}`}>{autopayEnabled ? 'Active' : 'Disabled'}</span>
              <span className="wallet-metric-sub">Outstanding {formatUsd(autopayOutstanding)}</span>
            </div>
            <div className="wallet-metric-card">
              <span className="wallet-metric-label">Today’s spend</span>
              <span className="wallet-metric-value text-eva-green">{formatUsd(spentTodayUsd)}</span>
              <span className="wallet-metric-sub">{stats ? `${stats.todayEntries} actions • ${formatUsd(stats.usdcSpentToday)}` : 'Awaiting telemetry'}</span>
            </div>
          </div>
        </div>

        <div className="wallet-identity-card">
          <div className="wallet-identity-header">
            <span className="wallet-identity-label">Wallet identity</span>
            <button className="wallet-copy-btn" onClick={handleCopy} disabled={!snapshot?.address}>
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
          <span className="wallet-identity-value">{snapshot?.address ? formatAddress(snapshot.address) : 'Wallet not linked'}</span>
          {!walletLinked && !loading && (
            <button className="wallet-link-btn" onClick={() => setShowSetup(true)} style={{ marginTop: '0.5rem' }}>
              Link Wallet
            </button>
          )}
          <div className="wallet-identity-meta">
            <div>
              <span className="wallet-meta-label">Link status</span>
              <span className="wallet-meta-value">{snapshot?.address ? 'Secured locally' : 'Bootstrap required'}</span>
            </div>
            <div>
              <span className="wallet-meta-label">ENS</span>
              <span className="wallet-meta-value">{snapshot?.ens || '—'}</span>
            </div>
            <div>
              <span className="wallet-meta-label">Guardrails</span>
              <span className="wallet-meta-value">{dailyCapUsd ? `${formatUsd(dailyCapUsd)} cap` : 'No cap set'}</span>
            </div>
            <div>
              <span className="wallet-meta-label">Telemetry</span>
              <span className="wallet-meta-value">{balances.length ? 'Live feed' : 'Awaiting sync'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="wallet-core-grid">
        <article className="wallet-core-command">
          <header className="wallet-panel-header">
            <div>
              <span className="wallet-panel-title">Command centre</span>
              <p className="wallet-panel-note">Queue Base wallet actions. Clawtrl-wallet executes under the configured guardrails.</p>
            </div>
            <span className="wallet-panel-chip">Safe by default</span>
          </header>
          <WalletCommandCenter
            wallet={snapshot}
            onActionComplete={(action) => setActions(prev => [action, ...prev])}
            variant="panel"
            className="wallet-command"
          />
          <div className="wallet-guardrail-list">
            <span className="wallet-meta-label">Operational signals</span>
            <ul>
              {insights.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>
        </article>

        <aside className="wallet-core-sidebar">
          <div className="wallet-side-card">
            <header>
              <span className="wallet-side-title">Top balances</span>
              <span className="wallet-side-sub">Sorted by USD weight</span>
            </header>
            {balances.length ? (
              <ul className="wallet-side-list">
                {balances.slice(0, 5).map(asset => {
                  const share = totalValueUsd ? Math.round((asset.usd / totalValueUsd) * 100) : 0
                  return (
                    <li key={asset.symbol}>
                      <div className="wallet-side-row">
                        <span className="wallet-side-symbol">{asset.symbol}</span>
                        <span className="wallet-side-value">{formatUsd(asset.usd)}</span>
                      </div>
                      <div className="wallet-progress slim">
                        <div className="wallet-progress-fill" style={{ width: `${share}%` }} />
                      </div>
                      <span className="wallet-side-share">{share}% of treasury • {asset.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="wallet-empty">Balances will populate after the first sync run.</div>
            )}
          </div>

          <div className="wallet-side-card">
            <header>
              <span className="wallet-side-title">Runbook</span>
              <span className="wallet-side-sub">Suggested next actions</span>
            </header>
            <ul className="wallet-runbook">
              <li>1. Link your wallet (generate new or import existing private key).</li>
              <li>2. Launch <code>clawtrl-wallet</code> agent to ingest telemetry.</li>
              <li>3. Queue a <strong>Sync</strong> action to publish the first snapshot.</li>
              <li>4. Configure daily spend caps and autopay guardrails.</li>
            </ul>
          </div>
        </aside>
      </section>

      <section className="wallet-stream-grid">
        <div className="wallet-stream-card">
          <header className="wallet-panel-header">
            <div>
              <span className="wallet-panel-title">Action queue</span>
              <p className="wallet-panel-note">Recent and pending commands awaiting clawtrl-wallet execution.</p>
            </div>
          </header>
          {actions.length ? (
            <div className="wallet-ledger">
              {actions.map(action => {
                const amount = action.payload.amount
                const token = action.payload.token
                const hash = action.txHash
                return (
                  <div key={action.id} className="wallet-ledger-row">
                    <div className="wallet-ledger-meta">
                      <span className="wallet-ledger-title">{action.type.toUpperCase()} #{action.id.slice(-6)}</span>
                      <span className="wallet-ledger-caption">{timeAgo(action.createdAt)} • {amount ? `${amount} ${token || ''}` : 'payload queued'}</span>
                      {hash ? (
                        <a href={`https://basescan.org/tx/${hash}`} target="_blank" rel="noreferrer" className="wallet-ledger-link">View tx</a>
                      ) : null}
                    </div>
                    <span className={`wallet-ledger-status ${statusTone(action.status)}`}>{action.status}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="wallet-empty">No actions queued yet. Use the command centre to draft one.</div>
          )}
        </div>

        <div className="wallet-stream-card">
          <header className="wallet-panel-header">
            <div>
              <span className="wallet-panel-title">Recent wallet signals</span>
              <p className="wallet-panel-note">On-chain telemetry streamed from clawtrl-wallet.</p>
            </div>
          </header>
          {snapshot?.recentActivity?.length ? (
            <div className="wallet-activity">
              {snapshot.recentActivity.map(evt => (
                <div key={evt.hash} className="wallet-activity-row">
                  <span className="wallet-activity-dot" />
                  <div className="wallet-activity-copy">
                    <span className="wallet-activity-title">{evt.label}</span>
                    <span className="wallet-activity-time">{timeAgo(evt.timestamp)}</span>
                    {evt.queueId ? <span className="wallet-activity-queue-id">Queue ID: {evt.queueId}</span> : null}
                    {evt.txHash ? (
                      <a href={`https://basescan.org/tx/${evt.txHash}`} target="_blank" rel="noreferrer" className="wallet-ledger-link">View tx</a>
                    ) : null}
                    {evt.amount ? <span className="wallet-activity-amount">{evt.amount} {evt.token || ''}</span> : null}
                    {evt.status ? <span className={`wallet-activity-status ${statusTone(evt.status === 'success' ? 'completed' : evt.status === 'reverted' ? 'failed' : 'processing')}`}>{evt.status}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wallet-empty">No telemetry yet. Queue a sync action to refresh.</div>
          )}
        </div>
      </section>
      </div>

      {showSetup && (
        <div className="modal-overlay" onClick={() => !setupLoading && setShowSetup(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            {!setupSuccess ? (
              <>
                <h2 style={{ marginBottom: '0.5rem' }}>Link Wallet</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                  Generate a new Base wallet or import an existing private key. Credentials are stored locally in <code>.env.local</code> (never committed).
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <button
                    className={`wallet-link-btn ${setupMode === 'generate' ? '' : 'btn-secondary'}`}
                    onClick={() => setSetupMode('generate')}
                    disabled={setupLoading}
                  >Generate New</button>
                  <button
                    className={`wallet-link-btn ${setupMode === 'import' ? '' : 'btn-secondary'}`}
                    onClick={() => setSetupMode('import')}
                    disabled={setupLoading}
                  >Import Key</button>
                </div>

                {setupMode === 'import' && (
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.375rem' }}>
                      Private Key (0x-prefixed)
                    </label>
                    <input
                      type="password"
                      placeholder="0x..."
                      value={importKey}
                      onChange={e => setImportKey(e.target.value)}
                      disabled={setupLoading}
                      style={{ width: '100%', padding: '0.625rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.8125rem' }}
                    />
                  </div>
                )}

                {setupMode === 'generate' && (
                  <div style={{ marginBottom: '1rem', padding: '0.875rem', borderRadius: '0.5rem', background: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      A new 12-word mnemonic will be generated using BIP-39. The private key is derived at path <code>m/44'/60'/0'/0/0</code> and stored in <code>.env.local</code>.
                    </p>
                  </div>
                )}

                {setupError && (
                  <div style={{ marginBottom: '1rem', padding: '0.625rem 0.875rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', fontSize: '0.8125rem' }}>
                    {setupError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                  <button className="wallet-link-btn btn-secondary" onClick={() => setShowSetup(false)} disabled={setupLoading}>Cancel</button>
                  <button
                    className="wallet-link-btn"
                    onClick={handleSetup}
                    disabled={setupLoading || (setupMode === 'import' && (!importKey || importKey.length < 66))}
                  >{setupLoading ? 'Working…' : setupMode === 'generate' ? 'Generate Wallet' : 'Import Wallet'}</button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ marginBottom: '0.5rem' }}>Wallet Linked</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Your wallet has been configured. Credentials saved to <code>.env.local</code>.
                </p>
                {generatedMnemonic && (
                  <div style={{ marginBottom: '1rem', padding: '0.875rem', borderRadius: '0.5rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                    <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#ef4444', marginBottom: '0.375rem' }}>
                      Save your recovery phrase — it will not be shown again:
                    </p>
                    <p style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--text)', lineHeight: 1.6 }}>
                      {generatedMnemonic}
                    </p>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="wallet-link-btn" onClick={() => { setShowSetup(false); setSetupSuccess(false); setGeneratedMnemonic('') }}>
                    Done
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function formatUsd(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '$0'
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 100 ? 2 : 0 })}`
}

function formatAddress(address: string) {
  if (!address) return ''
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

function statusTone(status: WalletAction['status']) {
  switch (status) {
    case 'completed':
      return 'text-eva-green'
    case 'failed':
      return 'text-eva-orange'
    case 'processing':
      return 'text-primary-40'
    default:
      return 'text-primary-50'
  }
}
