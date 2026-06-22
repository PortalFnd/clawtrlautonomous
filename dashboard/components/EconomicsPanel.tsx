'use client'

import { useEffect, useState } from 'react'
import { displayName } from '../lib/utils'

interface EconRow {
  skill: string
  model: string | null
  runs: number
  successes: number
  failures: number
  avgDurationSec: number
  totalDurationSec: number
  estCostUsd: number
  articles: number
  enabled: boolean
}

interface EconResponse {
  days: number
  generatedAt: string
  rows: EconRow[]
  totals: {
    runs: number
    successes: number
    failures: number
    estCostUsd: number
    walletSpendUsd: number
    articles: number
  }
}

const labelCls = 'text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40'
const cardCls = 'bg-[rgba(5,12,32,0.55)] border border-[rgba(228,236,255,0.10)] rounded'

const PRESETS: Array<{ days: number; label: string }> = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
]

function fmtUsd(n: number): string {
  if (n === 0) return '$0'
  if (n < 0.01) return `<$0.01`
  if (n < 1) return `$${n.toFixed(3)}`
  return `$${n.toFixed(2)}`
}

function fmtPct(num: number, denom: number): string {
  if (denom === 0) return '—'
  return `${Math.round((num / denom) * 100)}%`
}

function fmtDur(sec: number): string {
  if (sec < 60) return `${Math.round(sec)}s`
  return `${(sec / 60).toFixed(1)}m`
}

export function EconomicsPanel() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<EconResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    fetch(`/api/economics?days=${days}`)
      .then(async r => {
        if (!r.ok) throw new Error((await r.json()).error || `HTTP ${r.status}`)
        return r.json()
      })
      .then((d: EconResponse) => { if (!cancelled) setData(d) })
      .catch(e => { if (!cancelled) setErr(String(e.message || e)) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [days])

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <section className={`${cardCls} p-4`}>
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <div className="font-display text-sm text-white leading-tight">Economics</div>
            <div className="text-[10px] font-mono text-primary-40 mt-1">Cost vs output, per Claw. Estimates derived from run duration × model price.</div>
          </div>
          <div className="flex gap-1">
            {PRESETS.map(p => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                  days === p.days
                    ? 'border-eva-green text-eva-green bg-[rgba(51,240,183,0.08)]'
                    : 'border-[rgba(228,236,255,0.14)] text-primary-40 hover:text-primary-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="text-xs font-mono text-primary-40">Loading…</div>}
        {err && <div className="text-xs font-mono text-eva-red">Error: {err}</div>}

        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
            <Stat label="Total runs" value={String(data.totals.runs)} sub={`${fmtPct(data.totals.successes, data.totals.runs)} success`} />
            <Stat label="Est. tokens spend" value={fmtUsd(data.totals.estCostUsd)} sub={`over ${data.days}d`} />
            <Stat label="Wallet (USDC)" value={fmtUsd(data.totals.walletSpendUsd)} sub="lifetime ledger" />
            <Stat label="Articles produced" value={String(data.totals.articles)} sub="all-time" />
          </div>
        )}
      </section>

      {data && (
        <section>
          <div className="flex items-center justify-between mb-2 px-1">
            <span className={labelCls}>Per Claw</span>
            <span className="text-[10px] font-mono text-primary-35">{data.rows.length} active in window</span>
          </div>
          <div className={`${cardCls} overflow-hidden`}>
            <div className="grid grid-cols-12 px-3 py-2 border-b border-[rgba(228,236,255,0.08)] text-[10px] font-mono text-primary-40">
              <div className="col-span-3">Skill</div>
              <div className="col-span-2">Model</div>
              <div className="col-span-1 text-right">Runs</div>
              <div className="col-span-2 text-right">Success</div>
              <div className="col-span-1 text-right">Avg dur</div>
              <div className="col-span-2 text-right">Est. cost</div>
              <div className="col-span-1 text-right">Articles</div>
            </div>
            {data.rows.length === 0 && (
              <div className="px-3 py-10 text-center text-xs text-primary-40 font-mono">
                No runs in the last {data.days} days. Enable a Claw on the Fleet Bay to start producing data.
              </div>
            )}
            {data.rows.map(r => (
              <div key={r.skill} className="grid grid-cols-12 px-3 py-2 border-b border-[rgba(228,236,255,0.04)] text-[11px] font-mono items-center">
                <div className="col-span-3 text-primary-100 truncate flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${r.enabled ? 'bg-eva-green' : 'bg-primary-40'}`} />
                  {displayName(r.skill)}
                </div>
                <div className="col-span-2 text-primary-50 truncate">{r.model || '—'}</div>
                <div className="col-span-1 text-right text-primary-100 tabular-nums">{r.runs}</div>
                <div className="col-span-2 text-right tabular-nums">
                  <span className={r.failures > 0 ? 'text-eva-orange' : 'text-eva-green'}>
                    {fmtPct(r.successes, r.runs)}
                  </span>
                  <span className="text-primary-40 ml-1">({r.successes}/{r.runs})</span>
                </div>
                <div className="col-span-1 text-right text-primary-50 tabular-nums">{fmtDur(r.avgDurationSec)}</div>
                <div className="col-span-2 text-right text-primary-100 tabular-nums">{fmtUsd(r.estCostUsd)}</div>
                <div className="col-span-1 text-right text-primary-50 tabular-nums">{r.articles}</div>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-mono text-primary-35 mt-2 px-1 leading-relaxed">
            Cost is approximate: <span className="text-primary-50">duration × ~80 tok/s × blended model price (30% input, 70% output)</span>.
            Local models report $0. Wallet spend is read directly from <code>wallet/tx-log.jsonl</code> and reflects actual on-chain settlement.
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[rgba(0,0,0,0.25)] border border-[rgba(228,236,255,0.08)] rounded p-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.16em] text-primary-40">{label}</div>
      <div className="font-display text-xl text-white mt-1 tabular-nums">{value}</div>
      {sub && <div className="text-[10px] font-mono text-primary-40 mt-0.5">{sub}</div>}
    </div>
  )
}
