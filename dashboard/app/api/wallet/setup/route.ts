import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { resolve } from 'node:path'
import { Buffer } from 'node:buffer'
import { mnemonicToSeedSync, generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'
import { keccak_256 } from '@noble/hashes/sha3'
import { getPublicKey } from '@noble/secp256k1'
import { privateKeyToAccount } from 'viem/accounts'

const REPO_ROOT = resolve(process.cwd(), '..')
const ENV_PATH = resolve(process.cwd(), '.env.local')

function writeEnvFile(lines: string[]) {
  writeFileSync(ENV_PATH, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 })
  chmodSync(ENV_PATH, 0o600)
}

function readExistingEnv(): Record<string, string> {
  const map: Record<string, string> = {}
  if (!existsSync(ENV_PATH)) return map
  const raw = readFileSync(ENV_PATH, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    map[key] = val
  }
  return map
}

function mergeEnv(existing: Record<string, string>, updates: Record<string, string>): string[] {
  const merged = { ...existing }
  for (const [k, v] of Object.entries(updates)) {
    merged[k] = v
  }
  const lines: string[] = [
    '# Clawtrl wallet bootstrap values',
    '# DO NOT COMMIT. Generated on ' + new Date().toISOString(),
  ]
  for (const [k, v] of Object.entries(merged)) {
    if (k.startsWith('CLAWTRL_WALLET_MNEMONIC') || k.startsWith('CLAWTRL_WALLET_PRIVATE_KEY')) {
      lines.push(`${k}=${v}`)
    } else {
      lines.push(`${k}=${v}`)
    }
  }
  return lines
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const mode = body.mode || 'generate'

    if (mode === 'import') {
      const { privateKey } = body
      if (!privateKey || !privateKey.startsWith('0x') || privateKey.length !== 66) {
        return NextResponse.json({ error: 'Invalid private key format. Expected 0x-prefixed 32-byte hex string.' }, { status: 400 })
      }

      try {
        const account = privateKeyToAccount(privateKey as `0x${string}`)
        const existing = readExistingEnv()
        const updates: Record<string, string> = {
          CLAWTRL_WALLET_NETWORK: existing.CLAWTRL_WALLET_NETWORK || 'base',
          CLAWTRL_WALLET_PRIVATE_KEY: privateKey,
          CLAWTRL_WALLET_ADDRESS: account.address,
          CLAWTRL_WALLET_DAILY_CAP_USD: existing.CLAWTRL_WALLET_DAILY_CAP_USD || '50',
          CLAWTRL_WALLET_AUTOPAY: existing.CLAWTRL_WALLET_AUTOPAY || 'false',
        }
        writeEnvFile(mergeEnv(existing, updates))

        return NextResponse.json({
          ok: true,
          address: account.address,
          network: updates.CLAWTRL_WALLET_NETWORK,
          mode: 'import',
        })
      } catch (err: any) {
        return NextResponse.json({ error: `Invalid private key: ${err.message}` }, { status: 400 })
      }
    }

    // Generate mode
    const mnemonic = generateMnemonic(wordlist, 128)
    const seed = mnemonicToSeedSync(mnemonic)
    const hd = HDKey.fromMasterSeed(seed)
    const child = hd.derive("m/44'/60'/0'/0/0")

    if (!child.privateKey) {
      return NextResponse.json({ error: 'Failed to derive private key' }, { status: 500 })
    }

    const privateKeyHex = Buffer.from(child.privateKey).toString('hex')
    const publicKey = getPublicKey(child.privateKey, false).slice(1)
    const addressBytes = keccak_256(publicKey).slice(-20)
    const address = '0x' + Buffer.from(addressBytes).toString('hex')

    const existing = readExistingEnv()
    const updates: Record<string, string> = {
      CLAWTRL_WALLET_NETWORK: existing.CLAWTRL_WALLET_NETWORK || 'base',
      CLAWTRL_WALLET_MNEMONIC: `"${mnemonic}"`,
      CLAWTRL_WALLET_PRIVATE_KEY: `0x${privateKeyHex}`,
      CLAWTRL_WALLET_ADDRESS: address,
      CLAWTRL_WALLET_DAILY_CAP_USD: existing.CLAWTRL_WALLET_DAILY_CAP_USD || '50',
      CLAWTRL_WALLET_AUTOPAY: existing.CLAWTRL_WALLET_AUTOPAY || 'false',
    }
    writeEnvFile(mergeEnv(existing, updates))

    return NextResponse.json({
      ok: true,
      address,
      mnemonic,
      network: updates.CLAWTRL_WALLET_NETWORK,
      mode: 'generate',
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to setup wallet' }, { status: 500 })
  }
}
