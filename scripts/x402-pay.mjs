#!/usr/bin/env node
/**
 * x402 payment helper.
 *
 * Usage:
 *   node scripts/x402-pay.mjs <url> [--label foo] [--max-usdc 0.5] [--out data/x402-cache/<today>/foo.json]
 *
 * Env:
 *   CLAWTRL_WALLET_PRIVATE_KEY   required
 *   CLAWTRL_WALLET_NETWORK       'base' | 'base-sepolia' (default 'base')
 *
 * Flow:
 *   1. GET url (no payment). If 200 → save body, exit.
 *   2. If 402 → parse challenge, sanity-check, sign EIP-3009, retry with X-Payment.
 *   3. Write body to --out, append a JSONL receipt to wallet/x402-receipts.jsonl.
 *
 * This is intentionally minimal — no deps beyond viem (already in dashboard deps).
 * Run via `node --experimental-fetch` not needed on Node 22.
 */

import { mkdir, appendFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { createWalletClient, http, hexToBytes, parseUnits } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
const MAX_PER_CALL_USDC = 0.5

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

function die(msg, code = 1) {
  process.stderr.write(`x402-pay: ${msg}\n`)
  process.exit(code)
}

const url = process.argv[2]
if (!url || url.startsWith('--')) die('usage: x402-pay.mjs <url> [--label foo] [--out path]')

const label = arg('label', 'unnamed')
const out = arg('out', `data/x402-cache/${new Date().toISOString().slice(0,10)}/${label}.json`)
const maxUsdc = Number(arg('max-usdc', String(MAX_PER_CALL_USDC)))
if (!Number.isFinite(maxUsdc) || maxUsdc > MAX_PER_CALL_USDC) die(`--max-usdc must be <= ${MAX_PER_CALL_USDC}`)

const pk = process.env.CLAWTRL_WALLET_PRIVATE_KEY
if (!pk) die('CLAWTRL_WALLET_PRIVATE_KEY not set')

const network = process.env.CLAWTRL_WALLET_NETWORK || 'base'
const chain = network === 'base-sepolia' ? baseSepolia : base
const usdc = network === 'base-sepolia' ? USDC_BASE_SEPOLIA : USDC_BASE

const account = privateKeyToAccount(pk)
const wallet = createWalletClient({ account, chain, transport: http() })

async function saveBody(body) {
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, body)
}

async function appendReceipt(rec) {
  await mkdir('wallet', { recursive: true })
  await appendFile('wallet/x402-receipts.jsonl', JSON.stringify(rec) + '\n')
}

// EIP-3009 typed data for USDC
function buildTypedData({ from, to, value, validAfter, validBefore, nonce, chainId, verifyingContract }) {
  return {
    domain: { name: 'USD Coin', version: '2', chainId, verifyingContract },
    types: {
      TransferWithAuthorization: [
        { name: 'from',         type: 'address' },
        { name: 'to',           type: 'address' },
        { name: 'value',        type: 'uint256' },
        { name: 'validAfter',   type: 'uint256' },
        { name: 'validBefore',  type: 'uint256' },
        { name: 'nonce',        type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    message: { from, to, value, validAfter, validBefore, nonce },
  }
}

function randomNonceHex() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return '0x' + Array.from(buf, b => b.toString(16).padStart(2, '0')).join('')
}

// --- Step 1: unauthenticated probe ---
let resp = await fetch(url, { method: 'GET' })
if (resp.ok) {
  const body = await resp.text()
  await saveBody(body)
  console.log(`x402-pay: ${label} 200 (no payment), ${body.length}B → ${out}`)
  process.exit(0)
}
if (resp.status !== 402) die(`unexpected status ${resp.status} on first probe`)

// --- Step 2: parse challenge ---
const challengeJson = await resp.json()
const accepts = Array.isArray(challengeJson?.accepts) ? challengeJson.accepts : [challengeJson]
const accept = accepts.find(a => (a.network === network) && (a.scheme === 'exact' || !a.scheme))
if (!accept) die(`no acceptable payment requirement for network=${network}`)
if (accept.asset && accept.asset.toLowerCase() !== usdc.toLowerCase()) die(`challenge asset ${accept.asset} != USDC ${usdc}`)

const amountAtomic = BigInt(accept.maxAmountRequired ?? accept.amount ?? 0)
if (amountAtomic <= 0n) die('challenge amount is zero')
const amountUsd = Number(amountAtomic) / 1e6
if (amountUsd > maxUsdc) die(`challenge ${amountUsd} USDC exceeds per-call ceiling ${maxUsdc}`)

const payTo = accept.payTo || accept.recipient
if (!payTo) die('challenge missing payTo/recipient')

const now = Math.floor(Date.now() / 1000)
const validAfter  = BigInt(now - 60)
const validBefore = BigInt(now + 600)
const nonce = randomNonceHex()

const typed = buildTypedData({
  from: account.address,
  to: payTo,
  value: amountAtomic,
  validAfter,
  validBefore,
  nonce,
  chainId: chain.id,
  verifyingContract: usdc,
})

const signature = await wallet.signTypedData({ account, ...typed })

// X-Payment header per x402 spec: base64(JSON({ x402Version, scheme, network, payload }))
const payload = {
  signature,
  authorization: {
    from: account.address,
    to: payTo,
    value: amountAtomic.toString(),
    validAfter: validAfter.toString(),
    validBefore: validBefore.toString(),
    nonce,
  },
}
const headerJson = JSON.stringify({
  x402Version: 1,
  scheme: accept.scheme || 'exact',
  network,
  payload,
})
const xPayment = Buffer.from(headerJson, 'utf-8').toString('base64')

// --- Step 3: retry with payment ---
resp = await fetch(url, { method: 'GET', headers: { 'X-Payment': xPayment } })
if (!resp.ok) {
  const text = await resp.text().catch(() => '')
  die(`retry failed status=${resp.status} body=${text.slice(0, 200)}`)
}

const body = await resp.text()
await saveBody(body)

const txHash = resp.headers.get('x-payment-response')
  ? (() => { try { return JSON.parse(Buffer.from(resp.headers.get('x-payment-response'), 'base64').toString()).transaction } catch { return null } })()
  : null

await appendReceipt({
  ts: new Date().toISOString(),
  label, url,
  amount_usd: amountUsd,
  tx_hash: txHash,
  status: 'settled',
  network,
})

// Mirror to general tx-log so daily-cap accounting includes x402 spend.
await appendFile('wallet/tx-log.jsonl', JSON.stringify({
  ts: new Date().toISOString(),
  kind: 'x402',
  amount_usd: amountUsd,
  hash: txHash,
  label,
}) + '\n')

console.log(`x402-pay: ${label} settled ${amountUsd} USDC → ${out}${txHash ? ` (tx ${txHash})` : ''}`)
