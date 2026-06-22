'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'

interface BridgeStats {
  claws: { total: number; onDuty: number; working: number }
  missions: { recent: number; running: number }
  treasury: { healthLabel: string; healthTone: 'ok' | 'warn' | 'alert' | 'idle'; capUsage: number; capUsd: number | null; spentUsd: number; network: string; address: string | null }
  sync: { behind: number; hasChanges: boolean }
}

const EMPTY: BridgeStats = {
  claws: { total: 0, onDuty: 0, working: 0 },
  missions: { recent: 0, running: 0 },
  treasury: { healthLabel: 'Idle', healthTone: 'idle', capUsage: 0, capUsd: null, spentUsd: 0, network: 'BASE', address: null },
  sync: { behind: 0, hasChanges: false },
}

function clockFor(date: Date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export function CommandBridge() {
  const router = useRouter()
  const pathname = usePathname()
  const [stats, setStats] = useState<BridgeStats>(EMPTY)
  const [now, setNow] = useState<string>(clockFor(new Date()))

  useEffect(() => {
    const tick = () => setNow(clockFor(new Date()))
    const i = setInterval(tick, 1000)
    return () => clearInterval(i)
  }, [])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const [skillsRes, runsRes, walletRes, syncRes] = await Promise.all([
          fetch('/api/skills').catch(() => null),
          fetch('/api/runs').catch(() => null),
          fetch('/api/wallet').catch(() => null),
          fetch('/api/sync').catch(() => null),
        ])
        const skills = skillsRes && skillsRes.ok ? (await skillsRes.json()).skills ?? [] : []
        const runs = runsRes && runsRes.ok ? (await runsRes.json()).runs ?? [] : []
        const walletData = walletRes && walletRes.ok ? await walletRes.json() : null
        const syncData = syncRes && syncRes.ok ? await syncRes.json() : null

        const onDuty = skills.filter((s: { enabled: boolean }) => s.enabled).length
        const working = runs.filter((r: { status: string }) => r.status === 'in_progress').length
        const wallet = walletData?.wallet
        const cap = wallet?.dailyCapUsd ?? null
        const spent = wallet?.spentTodayUsd ?? 0
        const usage = cap ? Math.min(100, Math.round((spent / cap) * 100)) : 0
        const tone: BridgeStats['treasury']['healthTone'] = wallet?.health === 'alert' ? 'alert' : wallet?.health === 'warn' ? 'warn' : wallet?.address ? 'ok' : 'idle'
        const label = tone === 'alert' ? 'Alert' : tone === 'warn' ? 'Attention' : tone === 'ok' ? 'Online' : 'Idle'

        if (cancelled) return
        setStats({
          claws: { total: skills.length, onDuty, working },
          missions: { recent: runs.length, running: working },
          treasury: { healthLabel: label, healthTone: tone, capUsage: usage, capUsd: cap, spentUsd: spent, network: (wallet?.network || 'BASE').toString().toUpperCase(), address: wallet?.address ?? null },
          sync: { behind: syncData?.behind ?? 0, hasChanges: !!syncData?.hasChanges },
        })
      } catch {
        if (!cancelled) setStats(EMPTY)
      }
    }
    load()
    const i = setInterval(load, 15000)
    return () => { cancelled = true; clearInterval(i) }
  }, [])

  const inFleet = pathname === '/' || pathname?.startsWith('/dashboard')
  const inVault = pathname === '/wallet'

  return (
    <header className="bridge-shell">
      <div className="bridge-row">
        <div className="bridge-brand">
          <div className="bridge-mark" aria-hidden>
            <img src="/clawtrl.jpg" alt="Clawtrl" />
          </div>
          <div className="bridge-brand-meta">
            <span className="bridge-kicker">PortalFND // Clawtrl Ops</span>
            <span className="bridge-title">Command Bridge</span>
          </div>
        </div>

        <nav className="bridge-switcher" aria-label="Workspaces">
          <button
            className={`bridge-switch ${inFleet ? 'is-active' : ''}`}
            onClick={() => router.push('/')}
            type="button"
          >
            <span className="bridge-switch-id">01</span>
            <span className="bridge-switch-label">Fleet Bay</span>
            <span className="bridge-switch-meta">{stats.claws.onDuty}/{stats.claws.total} on duty</span>
          </button>
          <button
            className={`bridge-switch ${inVault ? 'is-active' : ''}`}
            onClick={() => router.push('/wallet')}
            type="button"
          >
            <span className="bridge-switch-id">02</span>
            <span className="bridge-switch-label">Treasury Vault</span>
            <span className="bridge-switch-meta">{stats.treasury.healthLabel} · {stats.treasury.network}</span>
          </button>
        </nav>

        <div className="bridge-pulse">
          <Gauge label="Fleet" primary={`${stats.claws.onDuty}`} secondary={`/ ${stats.claws.total}`} caption={`${stats.claws.working} working`} percent={stats.claws.total ? Math.round((stats.claws.onDuty / stats.claws.total) * 100) : 0} tone={stats.claws.working > 0 ? 'active' : 'neutral'} />
          <Gauge label="Missions" primary={`${stats.missions.running}`} secondary={`live`} caption={`${stats.missions.recent} logged`} percent={Math.min(100, stats.missions.recent ? (stats.missions.running / Math.max(1, stats.missions.recent)) * 100 + 6 : 0)} tone={stats.missions.running > 0 ? 'active' : 'neutral'} />
          <Gauge label="Cap usage" primary={`${stats.treasury.capUsage}%`} secondary={stats.treasury.capUsd ? `cap` : 'unset'} caption={stats.treasury.capUsd ? `${formatUsd(stats.treasury.spentUsd)} / ${formatUsd(stats.treasury.capUsd)}` : 'No cap configured'} percent={stats.treasury.capUsage} tone={stats.treasury.capUsage >= 90 ? 'alert' : stats.treasury.capUsage >= 60 ? 'warn' : 'neutral'} />
        </div>

        <div className="bridge-clock">
          <span className="bridge-clock-time">{now}</span>
          <span className="bridge-clock-zone">UTC LOCAL</span>
          <div className="bridge-sync-flags">
            <span className={`bridge-flag ${stats.sync.behind ? 'is-warn' : ''}`}>↓ {stats.sync.behind}</span>
            <span className={`bridge-flag ${stats.sync.hasChanges ? 'is-active' : ''}`}>↑ {stats.sync.hasChanges ? '1' : '0'}</span>
          </div>
        </div>
      </div>
    </header>
  )
}

function Gauge({ label, primary, secondary, caption, percent, tone }: { label: string; primary: string; secondary?: string; caption?: string; percent: number; tone: 'neutral' | 'active' | 'warn' | 'alert' }) {
  return (
    <div className={`bridge-gauge tone-${tone}`}>
      <div className="bridge-gauge-head">
        <span className="bridge-gauge-label">{label}</span>
        <span className="bridge-gauge-caption">{caption}</span>
      </div>
      <div className="bridge-gauge-value">
        <span className="bridge-gauge-primary">{primary}</span>
        {secondary && <span className="bridge-gauge-secondary">{secondary}</span>}
      </div>
      <div className="bridge-gauge-track" aria-hidden>
        <span className="bridge-gauge-fill" style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
    </div>
  )
}

function formatUsd(v: number | null | undefined) {
  if (!v && v !== 0) return '$0'
  if (Number.isNaN(v)) return '$0'
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: v < 100 ? 2 : 0 })}`
}
