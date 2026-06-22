import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { NextResponse } from 'next/server'

import type { WalletSnapshot } from '../../../lib/types'
import { getConfig, getWalletInfo, hasWalletCredentials } from '../../../lib/wallet-engine'
import { getStats, getTodaySpentUsd, readTxLog } from '../../../lib/tx-log'

const REPO_ROOT = resolve(process.cwd(), '..')
const SNAPSHOT_PATH = resolve(REPO_ROOT, 'telemetry/clawtrl-wallet.json')

function loadSnapshot(): Partial<WalletSnapshot> | null {
  try {
    if (!existsSync(SNAPSHOT_PATH)) return null
    const raw = readFileSync(SNAPSHOT_PATH, 'utf-8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function GET() {
  const config = getConfig()
  const fallback: WalletSnapshot = {
    network: config.network || 'base',
    address: config.address ?? null,
    ens: process.env.CLAWTRL_WALLET_ENS || null,
    balances: [],
    dailyCapUsd: config.dailyCap || null,
    spentTodayUsd: null,
    autopay: {
      enabled: process.env.CLAWTRL_WALLET_AUTOPAY === '1',
      outstandingUsd: 0,
    },
    recentActivity: [],
    health: 'warn',
  }

  const file = loadSnapshot()

  const telemetryBalances = file?.balances && Array.isArray(file.balances) ? [...file.balances] : []
  const mergedBalances = [...telemetryBalances]

  const liveBalances: Array<{ symbol: string; amount: number; usd?: number }> = []
  if (hasWalletCredentials()) {
    const info = await getWalletInfo().catch(() => null)
    if (info) {
      const ethEntry = telemetryBalances.find(b => b.symbol.toUpperCase() === 'ETH')
      const ethAmount = Number(info.ethBalance || 0)
      liveBalances.push({ symbol: 'ETH', amount: ethAmount, usd: ethEntry?.usd ?? 0 })

      const usdcEntry = telemetryBalances.find(b => b.symbol.toUpperCase() === 'USDC')
      const usdcAmount = Number(info.usdcBalance || 0)
      liveBalances.push({ symbol: 'USDC', amount: usdcAmount, usd: usdcEntry?.usd ?? usdcAmount })
    }
  }

  for (const live of liveBalances) {
    const idx = mergedBalances.findIndex(b => b.symbol.toUpperCase() === live.symbol.toUpperCase())
    if (idx >= 0) {
      mergedBalances[idx] = {
        ...mergedBalances[idx],
        amount: live.amount,
        usd: live.usd ?? mergedBalances[idx].usd ?? 0,
      }
    } else {
      mergedBalances.push({ symbol: live.symbol, amount: live.amount, usd: live.usd ?? 0 })
    }
  }

  const stats = getStats()
  const spentToday = getTodaySpentUsd()

  const recentActivity = file?.recentActivity && Array.isArray(file.recentActivity)
    ? file.recentActivity.slice(0, 6)
    : readTxLog(6)
        .reverse()
        .map(entry => ({
          hash: entry.hash ?? `${entry.timestamp}-${entry.type}`,
          label: entry.label || `${entry.type} ${entry.token ? `— ${entry.token}` : ''}`.trim(),
          timestamp: entry.timestamp,
        }))

  const autopay = file?.autopay
    ? { ...fallback.autopay, ...file.autopay }
    : fallback.autopay

  const merged: WalletSnapshot = {
    ...fallback,
    ...(file ?? {}),
    network: config.network || fallback.network,
    address: config.address ?? file?.address ?? fallback.address,
    balances: mergedBalances,
    dailyCapUsd: config.dailyCap || file?.dailyCapUsd || fallback.dailyCapUsd,
    spentTodayUsd: spentToday || file?.spentTodayUsd || fallback.spentTodayUsd,
    autopay,
    recentActivity,
  }

  const cap = merged.dailyCapUsd || 0
  const spent = merged.spentTodayUsd || 0
  if (!merged.address) {
    merged.health = 'warn'
  } else if (cap > 0 && spent >= cap) {
    merged.health = 'alert'
  } else {
    merged.health = 'ok'
  }

  return NextResponse.json({
    wallet: merged,
    generatedAt: new Date().toISOString(),
    stats,
  })
}
