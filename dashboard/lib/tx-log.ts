import { existsSync, appendFileSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import type { TxLogEntry } from './types'

function getRepoRoot() { return resolve(process.cwd(), '..') }
function getTxLogPath() { return resolve(getRepoRoot(), 'wallet/tx-log.jsonl') }

function ensureDir(path: string) {
  const dir = resolve(path, '..')
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
}

export function appendTx(entry: TxLogEntry) {
  const txLogPath = getTxLogPath()
  ensureDir(txLogPath)
  const line = JSON.stringify(entry)
  appendFileSync(txLogPath, line + '\n', 'utf8')
}

export function readTxLog(limit = 50): TxLogEntry[] {
  const txLogPath = getTxLogPath()
  if (!existsSync(txLogPath)) return []
  const raw = readFileSync(txLogPath, 'utf8')
  const lines = raw.trim().split('\n').filter(Boolean)
  const entries: TxLogEntry[] = []
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line))
    } catch {}
  }
  return entries.slice(-limit)
}

export function getTodaySpentUsd(): number {
  const today = new Date().toISOString().slice(0, 10)
  const entries = readTxLog(500)
  let total = 0
  for (const e of entries) {
    if (!e.timestamp.startsWith(today)) continue
    if (e.status !== 'success') continue
    if (e.token?.toUpperCase() === 'USDC' && e.amount) {
      total += Number(e.amount)
    }
  }
  return total
}

export function getStats() {
  const entries = readTxLog(500)
  const today = new Date().toISOString().slice(0, 10)
  const transfers = entries.filter(e => e.type === 'transfer' && e.status === 'success').length
  const contractWrites = entries.filter(e => e.type === 'contract-write' && e.status === 'success').length
  const x402 = entries.filter(e => e.type === 'x402' && e.status === 'success').length
  const todayEntries = entries.filter(e => e.timestamp.startsWith(today))
  const usdcSpent = todayEntries.reduce((sum, e) => {
    if (e.status !== 'success') return sum
    if (e.token?.toUpperCase() === 'USDC' && e.amount) return sum + Number(e.amount)
    return sum
  }, 0)
  return { transfers, contractWrites, x402, totalEntries: entries.length, todayEntries: todayEntries.length, usdcSpentToday: usdcSpent }
}
