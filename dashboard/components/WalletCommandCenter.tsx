'use client'

import { useState, useEffect } from 'react'
import type { WalletSnapshot, WalletAction, WalletActionType } from '../lib/types'

type FormState = {
  transfer: { to: string; amount: string; token: string }
  approve: { spender: string; amount: string; token: string }
  autopay: { enabled: boolean; capUsd: string }
  cap: { dailyCapUsd: string }
}

const defaultForm: FormState = {
  transfer: { to: '', amount: '', token: 'USDC' },
  approve: { spender: '', amount: '', token: 'USDC' },
  autopay: { enabled: false, capUsd: '0' },
  cap: { dailyCapUsd: '50' }
}

interface WalletCommandCenterProps {
  wallet: WalletSnapshot | null
  onActionComplete?: (action: WalletAction) => void
  className?: string
  variant?: 'card' | 'panel'
}

const tabs: Array<{ id: WalletActionType; label: string; description: string }> = [
  { id: 'transfer', label: 'Transfer', description: 'Send tokens from the Base wallet.' },
  { id: 'approve', label: 'Allowance', description: 'Set ERC20 allowances for contracts.' },
  { id: 'autopay', label: 'Autopay', description: 'Toggle autopay campaigns and thresholds.' },
  { id: 'cap', label: 'Caps', description: 'Adjust daily spend caps in USD.' },
  { id: 'sync', label: 'Sync', description: 'Request a fresh telemetry snapshot from clawtrl-wallet.' }
]

export function WalletCommandCenter({ wallet, onActionComplete, className, variant = 'card' }: WalletCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<WalletActionType>('transfer')
  const [form, setForm] = useState<FormState>(defaultForm)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [toastTone, setToastTone] = useState<'ok' | 'err'>('ok')
  const [confirmPin, setConfirmPin] = useState('')
  const [writeProtected, setWriteProtected] = useState(false)

  const updateForm = <T extends keyof FormState, K extends keyof FormState[T]>(tab: T, field: K, value: FormState[T][K]) => {
    setForm((prev) => ({ ...prev, [tab]: { ...prev[tab], [field]: value } }))
  }

  useEffect(() => {
    fetch('/api/wallet/protected').then(r => r.ok ? r.json() : null).then(d => {
      if (d?.protected) setWriteProtected(true)
    }).catch(() => {})
  }, [])

  const submit = async () => {
    setBusy(true)
    setToast('')
    try {
      const payload = (() => {
        switch (activeTab) {
          case 'transfer':
            return form.transfer
          case 'approve':
            return form.approve
          case 'autopay':
            return { enabled: String(form.autopay.enabled), capUsd: form.autopay.capUsd }
          case 'cap':
            return form.cap
          case 'sync':
          default:
            return { scope: 'full' }
        }
      })()

      const destructive = ['transfer', 'approve'].includes(activeTab)
      const res = await fetch('/api/wallet/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: activeTab,
          payload,
          execute: true,
          ...(destructive && writeProtected ? { confirmToken: confirmPin } : {}),
        })
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const data = await res.json() as { action: WalletAction }
      if (onActionComplete) onActionComplete(data.action)
      if (data.action.status === 'failed') {
        setToastTone('err')
        setToast(data.action.error || `${data.action.type} failed`)
      } else {
        setToastTone('ok')
        setToast(`${data.action.type.toUpperCase()} ${data.action.status === 'completed' ? 'executed' : 'queued'}`)
      }
      if (activeTab === 'transfer') setForm((prev) => ({ ...prev, transfer: { ...defaultForm.transfer, token: prev.transfer.token } }))
      if (activeTab === 'approve') setForm((prev) => ({ ...prev, approve: { ...defaultForm.approve, token: prev.approve.token } }))
    } catch (err) {
      setToastTone('err')
      setToast((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const containerClass = [
    variant === 'panel' ? 'wallet-command-panel' : 'card-hst wallet-command-slab',
    'overflow-hidden',
    className
  ].filter(Boolean).join(' ')

  return (
    <div className={containerClass}>
      <div className="wallet-tab-wrapper">
        <nav className="wallet-tab-nav wallet-tab-row">
          {tabs.map((tab) => {
            const active = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`wallet-tab ${active ? 'wallet-tab-active' : ''}`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>
      </div>
      <div className="wallet-panel-body">
        <div>
          <div className="text-label">{tabs.find(tab => tab.id === activeTab)?.label}</div>
          <p className="text-sm text-primary-40 mt-1">
            {tabs.find(tab => tab.id === activeTab)?.description}
          </p>
        </div>

        {activeTab === 'transfer' && (
          <div className="wallet-grid cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Recipient</label>
              <input value={form.transfer.to} onChange={e => updateForm('transfer', 'to', e.target.value)} placeholder="0x..." className="input-holo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Amount</label>
              <input value={form.transfer.amount} onChange={e => updateForm('transfer', 'amount', e.target.value)} placeholder="100" className="input-holo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Token</label>
              <input value={form.transfer.token} onChange={e => updateForm('transfer', 'token', e.target.value.toUpperCase())} className="input-holo" />
            </div>
            <div className="wallet-command-hint">Use `BASE-SEPOLIA` network for dry runs.</div>
          </div>
        )}

        {activeTab === 'approve' && (
          <div className="wallet-grid cols-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Spender</label>
              <input value={form.approve.spender} onChange={e => updateForm('approve', 'spender', e.target.value)} placeholder="0x..." className="input-holo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Amount</label>
              <input value={form.approve.amount} onChange={e => updateForm('approve', 'amount', e.target.value)} placeholder="100" className="input-holo" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Token</label>
              <input value={form.approve.token} onChange={e => updateForm('approve', 'token', e.target.value.toUpperCase())} className="input-holo" />
            </div>
            <div className="wallet-command-hint">Approvals execute on Base; confirm spender address carefully.</div>
          </div>
        )}

        {activeTab === 'autopay' && (
          <div className="wallet-grid cols-2">
            <div className="flex gap-2 items-center text-[11px] font-mono text-primary-50">
              <input type="checkbox" checked={form.autopay.enabled} onChange={e => updateForm('autopay', 'enabled', e.target.checked)} className="h-4 w-4" />
              Enable Autopay Campaigns
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Outstanding Cap (USD)</label>
              <input value={form.autopay.capUsd} onChange={e => updateForm('autopay', 'capUsd', e.target.value)} className="input-holo" />
            </div>
          </div>
        )}

        {activeTab === 'cap' && (
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Daily Spend Cap (USD)</label>
            <input value={form.cap.dailyCapUsd} onChange={e => updateForm('cap', 'dailyCapUsd', e.target.value)} className="input-holo" />
          </div>
        )}

        {activeTab === 'sync' && (
          <div className="text-[11px] text-primary-40 font-mono">
            Trigger the telemetry generator to refresh balances, caps, and recent activity snapshots. Works best when the `clawtrl-wallet` skill watches for new action files.
          </div>
        )}

        {writeProtected && ['transfer', 'approve'].includes(activeTab) && (
          <div className="flex flex-col gap-1 max-w-xs">
            <label className="text-[10px] text-primary-40 font-mono uppercase tracking-[2px]">Confirmation PIN</label>
            <input
              type="password"
              value={confirmPin}
              onChange={e => setConfirmPin(e.target.value)}
              placeholder="Enter PIN to authorize"
              className="input-holo"
            />
          </div>
        )}

        <div className="flex items-center gap-3">
          <button onClick={submit} disabled={busy} className="portal-button">
            {busy ? 'QUEUING…' : 'Queue Action'}
          </button>
          <span className={`text-[11px] font-mono truncate ${toastTone === 'err' ? 'text-eva-red' : 'text-primary-40'}`}>
            {toast || `Wallet: ${wallet?.address ? wallet.address.slice(0, 8) + '…' : 'not linked'}`}
          </span>
        </div>
      </div>
    </div>
  )
}
