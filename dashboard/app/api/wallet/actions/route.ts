import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { NextResponse } from 'next/server'
import type { WalletAction } from '../../../../lib/types'
import { hasWalletCredentials, sendETH, sendUSDC, approveToken, checkDailyCap, getWalletInfo } from '../../../../lib/wallet-engine'
import { verifyConfirmToken, isWalletWriteProtected } from '../../../../lib/wallet-auth'
import { isAddressAllowed } from '../allowlist/route'

const REPO_ROOT = resolve(process.cwd(), '..')
const ACTIONS_PATH = resolve(REPO_ROOT, 'telemetry/clawtrl-wallet-actions.json')

function ensureDir(path: string) {
  const dir = resolve(path, '..')
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
}

function loadActions(): WalletAction[] {
  try {
    if (!existsSync(ACTIONS_PATH)) return []
    const raw = readFileSync(ACTIONS_PATH, 'utf8')
    if (!raw.trim()) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveActions(actions: WalletAction[]) {
  ensureDir(ACTIONS_PATH)
  writeFileSync(ACTIONS_PATH, JSON.stringify(actions, null, 2), 'utf8')
}

function generateId() {
  return `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

async function executeAction(action: WalletAction): Promise<WalletAction> {
  if (!hasWalletCredentials()) {
    return { ...action, status: 'failed', error: 'Wallet not initialized. Run wallet:init first.' }
  }

  try {
    switch (action.type) {
      case 'transfer': {
        const token = action.payload.token?.toLowerCase() || 'eth'
        const amount = action.payload.amount
        const to = action.payload.to
        if (!to || !amount) throw new Error('Missing to or amount')

        if (!isAddressAllowed(to)) {
          throw new Error('Recipient address is not in the allowlist. Add it via /api/wallet/allowlist first.')
        }

        if (token === 'usdc') {
          const capOk = await checkDailyCap(Number(amount))
          if (!capOk) throw new Error('Daily cap would be exceeded')
          const hash = await sendUSDC(to, amount)
          return { ...action, status: 'completed', txHash: hash, executedAt: new Date().toISOString() }
        } else {
          const hash = await sendETH(to, amount)
          return { ...action, status: 'completed', txHash: hash, executedAt: new Date().toISOString() }
        }
      }
      case 'approve': {
        const tokenAddress = action.payload.tokenAddress
        const spender = action.payload.spender
        const amount = action.payload.amount
        if (!tokenAddress || !spender || !amount) throw new Error('Missing tokenAddress, spender, or amount')
        const hash = await approveToken(tokenAddress, spender, amount)
        return { ...action, status: 'completed', txHash: hash, executedAt: new Date().toISOString() }
      }
      case 'cap': {
        return { ...action, status: 'completed', notes: 'Cap updated in environment', executedAt: new Date().toISOString() }
      }
      case 'autopay': {
        return { ...action, status: 'completed', notes: 'Autopay toggled in environment', executedAt: new Date().toISOString() }
      }
      case 'sync': {
        const info = await getWalletInfo()
        return { ...action, status: 'completed', notes: `Synced ${info.address} — ETH: ${info.ethBalance} USDC: ${info.usdcBalance}`, executedAt: new Date().toISOString() }
      }
      default:
        throw new Error(`Unknown action type: ${action.type}`)
    }
  } catch (err: any) {
    return { ...action, status: 'failed', error: err.message || String(err), executedAt: new Date().toISOString() }
  }
}

export async function GET() {
  const actions = loadActions()
  return NextResponse.json({ actions })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, payload, execute = true, confirmToken } = body

    if (!type || !payload) {
      return NextResponse.json({ error: 'Missing type or payload' }, { status: 400 })
    }

    const destructiveTypes = ['transfer', 'approve']
    if (destructiveTypes.includes(type) && isWalletWriteProtected()) {
      if (!verifyConfirmToken(confirmToken)) {
        return NextResponse.json(
          { error: 'Confirmation token required for wallet write operations. Set CLAWTRL_WALLET_CONFIRM_PIN and pass confirmToken.' },
          { status: 403 },
        )
      }
    }

    const action: WalletAction = {
      id: generateId(),
      type,
      payload,
      status: 'pending',
      createdAt: new Date().toISOString(),
    }

    const actions = loadActions()

    if (execute) {
      const executed = await executeAction(action)
      actions.unshift(executed)
    } else {
      actions.unshift(action)
    }

    saveActions(actions)
    return NextResponse.json({ action: actions[0] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}
