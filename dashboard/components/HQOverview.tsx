import Link from 'next/link'
import type { Skill, Run, WalletSnapshot } from '../lib/types'
import { DEPARTMENTS } from '../lib/constants'
import { timeAgo } from '../lib/utils'

interface HQOverviewProps {
  skills: Skill[]
  runs: Run[]
  enabledCount: number
  workingCount: number
  wallet: WalletSnapshot | null
  walletLoading: boolean
  onViewRun: (run: Run) => void
}

function formatAddress(addr: string | null) {
  if (!addr) return 'No wallet linked'
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function formatUsd(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return '$0'
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: value < 100 ? 2 : 0 })}`
}

export function HQOverview({ skills, runs, enabledCount, workingCount, wallet, walletLoading, onViewRun }: HQOverviewProps) {
  const departments = new Map<string, Skill[]>()
  skills.forEach(s => { const t = s.tags?.[0] || 'meta'; if (!departments.has(t)) departments.set(t, []); departments.get(t)!.push(s) })

  const stats = [
    { label: 'Fleet Size', value: skills.length, tone: 'text-primary-100' },
    { label: 'On Duty', value: enabledCount, tone: 'text-eva-green' },
    { label: 'Working', value: workingCount, tone: workingCount > 0 ? 'text-eva-orange' : 'text-primary-50' },
    { label: 'Domains', value: departments.size, tone: 'text-primary-70' }
  ]

  const walletStatus = walletLoading
    ? { label: 'Syncing', tone: 'text-primary-40', badge: 'sync' }
    : wallet?.health === 'alert'
      ? { label: 'Cap reached', tone: 'text-eva-orange', badge: 'alert' }
      : wallet?.health === 'warn'
        ? { label: 'Link wallet', tone: 'text-eva-amber', badge: 'pending' }
        : { label: 'Ready', tone: 'text-eva-green', badge: 'ok' }

  const heroMetrics = [
    { label: 'Fleet size', value: skills.length },
    { label: 'On duty', value: enabledCount },
    { label: 'Working', value: workingCount },
    { label: 'Domains', value: departments.size }
  ]

  const pulse = [
    { label: 'Runs logged', value: runs.length.toString(), caption: 'All missions' },
    { label: 'Wallet status', value: walletStatus.label, caption: wallet?.network?.toUpperCase() || 'BASE', tone: walletStatus.tone },
    { label: 'Autopay', value: wallet?.autopay?.enabled ? 'Active' : 'Off', caption: wallet?.autopay?.enabled ? `Outstanding ${formatUsd(wallet?.autopay?.outstandingUsd ?? null)}` : 'Manual only', tone: wallet?.autopay?.enabled ? 'text-eva-green' : 'text-primary-50' },
    { label: 'Spend today', value: formatUsd(wallet?.spentTodayUsd ?? null), caption: `Cap ${formatUsd(wallet?.dailyCapUsd ?? null)}` }
  ]

  const walletBalances = wallet?.balances?.filter(b => b.amount > 0) ?? []
  const walletSummaryCopy = walletLoading
    ? 'Telemetry syncing from clawtrl-wallet…'
    : wallet?.address
      ? 'Keys stay local. Use the wallet deck to queue actions and broadcast to Base.'
      : 'Bootstrap a Base wallet to unlock the command centre controls.'

  return (
    <div className="deck-layout">
      <section className="deck-hero deck-surface">
        <div className="deck-hero-intro">
          <span className="deck-tag">Workspace 01 // Fleet Bay</span>
          <h2 className="deck-title">Mission floor for the autonomous claw fleet</h2>
          <p className="deck-lede">
            Stage shifts, audit live missions, and escalate to the Treasury Vault the moment funds need to move. Every signal in this room is yours to act on.
          </p>
          <div className="deck-cta-row">
            <Link href="/wallet" className="deck-cta-primary">Open Treasury Vault</Link>
            <span className={`deck-status-pill ${walletStatus.tone}`}>{walletStatus.label}</span>
          </div>
        </div>
        <div className="deck-hero-metrics">
          {heroMetrics.map(metric => (
            <div key={metric.label} className="deck-metric">
              <span className="deck-metric-label">{metric.label}</span>
              <span className="deck-metric-value">{metric.value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="deck-panels">
        <article className="deck-panel deck-panel-span-2">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Live mission feed</span>
              <p className="deck-panel-note">Latest dispatched ops across every claw on duty.</p>
            </div>
            <span className="deck-chip">Live sync</span>
          </header>
          <div className="deck-feed">
            {runs.slice(0, 10).map(run => (
              <button
                key={run.id}
                onClick={() => onViewRun(run)}
                className="deck-feed-row"
              >
                <span className={`deck-feed-status ${run.conclusion === 'success' ? 'text-eva-green' : run.conclusion === 'failure' ? 'text-eva-red' : run.status === 'in_progress' ? 'text-eva-orange' : 'text-primary-40'}`}>
                  {run.conclusion === 'success' ? '\u2713' : run.conclusion === 'failure' ? '\u2717' : run.status === 'in_progress' ? '\u25cc' : '\u00b7'}
                </span>
                <span className="deck-feed-title">{run.workflow}</span>
                <span className="deck-feed-time">{timeAgo(run.created_at)}</span>
              </button>
            ))}
            {!runs.length && <div className="deck-empty">No claw missions deployed yet.</div>}
          </div>
        </article>

        <article className="deck-panel deck-holo">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Treasury digest</span>
              <p className="deck-panel-note">Vault snapshot before you open the full deck.</p>
            </div>
            <Link href="/wallet" className="deck-link">Inspect</Link>
          </header>
          <div className="deck-wallet-block">
            <div>
              <div className="deck-wallet-address">{walletLoading ? 'Syncing…' : formatAddress(wallet?.address ?? null)}</div>
              {wallet?.ens && <div className="deck-wallet-ens">{wallet.ens}</div>}
            </div>
            <div className="deck-wallet-grid">
              <div>
                <span className="deck-wallet-label">Network</span>
                <span className="deck-wallet-value">{wallet?.network?.toUpperCase() || 'BASE'}</span>
              </div>
              <div>
                <span className="deck-wallet-label">Daily cap</span>
                <span className="deck-wallet-value">{formatUsd(wallet?.dailyCapUsd ?? null)}</span>
              </div>
              <div>
                <span className="deck-wallet-label">Spend today</span>
                <span className="deck-wallet-value">{formatUsd(wallet?.spentTodayUsd ?? null)}</span>
              </div>
              <div>
                <span className="deck-wallet-label">Autopay</span>
                <span className={`deck-wallet-value ${wallet?.autopay?.enabled ? 'text-eva-green' : 'text-primary-40'}`}>{wallet?.autopay?.enabled ? 'Active' : 'Off'}</span>
              </div>
            </div>
          </div>
          <p className="deck-panel-footer">{walletSummaryCopy}</p>
        </article>

        <article className="deck-panel">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Ops pulse</span>
              <p className="deck-panel-note">System-wide health at a glance.</p>
            </div>
          </header>
          <div className="deck-pulse-grid">
            {pulse.map(item => (
              <div key={item.label} className="deck-pulse-tile">
                <span className="deck-pulse-label">{item.label}</span>
                <span className={`deck-pulse-value ${item.tone ?? ''}`}>{item.value}</span>
                {item.caption && <span className="deck-pulse-caption">{item.caption}</span>}
              </div>
            ))}
          </div>
        </article>

        <article className="deck-panel deck-panel-span-2">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Cells</span>
              <p className="deck-panel-note">Every operating cell mapped to active claws.</p>
            </div>
          </header>
          <div className="deck-domain-grid">
            {[...departments.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([tag, ts]) => {
              const d = DEPARTMENTS[tag] || DEPARTMENTS.meta
              const active = ts.filter(s => s.enabled).length
              return (
                <div key={tag} className="deck-domain-tile">
                  <span className="deck-domain-glyph" style={{ backgroundColor: d.color }}>{d.label.slice(0, 2).toUpperCase()}</span>
                  <div>
                    <div className="deck-domain-title">{d.label}</div>
                    <div className="deck-domain-meta">{ts.length} claws · {active} active</div>
                  </div>
                </div>
              )
            })}
          </div>
        </article>

        <article className="deck-panel">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Vault signals</span>
              <p className="deck-panel-note">On-chain telemetry events streamed from the Treasury Vault.</p>
            </div>
          </header>
          {wallet?.recentActivity?.length ? (
            <div className="deck-feed">
              {wallet.recentActivity.map((evt, i) => (
                <div key={`${evt.hash}-${i}`} className="deck-feed-row">
                  <span className="deck-feed-dot" />
                  <span className="deck-feed-title">{evt.label}</span>
                  <span className="deck-feed-time">{timeAgo(evt.timestamp)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="deck-empty">No on-chain signals yet. Run clawtrl-wallet to publish telemetry snapshots.</div>
          )}
        </article>

        <article className="deck-panel deck-panel-span-2 deck-holo">
          <header className="deck-panel-header">
            <div>
              <span className="deck-panel-title">Holdings lens</span>
              <p className="deck-panel-note">Top assets from the latest vault snapshot.</p>
            </div>
            <Link href="/wallet" className="deck-link">Open wallet</Link>
          </header>
          {walletBalances.length ? (
            <div className="deck-balance-grid">
              {walletBalances.slice(0, 8).map(b => (
                <div key={b.symbol} className="deck-balance-card">
                  <span className="deck-balance-label">{b.symbol}</span>
                  <span className="deck-balance-value">{b.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                  <span className="deck-balance-caption">{formatUsd(b.usd)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="deck-empty">No balance telemetry yet.</div>
          )}
        </article>
      </section>
    </div>
  )
}
