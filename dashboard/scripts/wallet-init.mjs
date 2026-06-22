#!/usr/bin/env node
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Buffer } from 'node:buffer'
import { mnemonicToSeedSync, generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'
import { keccak_256 } from '@noble/hashes/sha3'
import { getPublicKey } from '@noble/secp256k1'

const __dirname = dirname(fileURLToPath(import.meta.url))
const telemetryDir = join(__dirname, '..', '..', 'telemetry')
const envPath = join(__dirname, '..', '..', '.env.local')
const force = process.argv.includes('--force')

function writeEnv(lines) {
  writeFileSync(envPath, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 })
  chmodSync(envPath, 0o600)
}

if (!existsSync(telemetryDir)) {
  mkdirSync(telemetryDir, { recursive: true })
}

if (existsSync(envPath) && !force) {
  const existing = readFileSync(envPath, 'utf8')
  if (existing.trim().length > 0) {
    console.error(`\n⛔  ${envPath} already exists. Use --force to overwrite, or edit manually.`)
    process.exit(1)
  }
}

const mnemonic = generateMnemonic(wordlist, randomBytes(16))
const seed = mnemonicToSeedSync(mnemonic)
const hd = HDKey.fromMasterSeed(seed)
const child = hd.derive("m/44'/60'/0'/0/0")

if (!child.privateKey) {
  console.error('\n⛔  Failed to derive private key. Try running again.')
  process.exit(1)
}

const privateKeyHex = Buffer.from(child.privateKey).toString('hex')
const publicKey = getPublicKey(child.privateKey, false).slice(1)
const addressBytes = keccak_256(publicKey).slice(-20)
const address = '0x' + Buffer.from(addressBytes).toString('hex')

const lines = [
  '# Clawtrl wallet bootstrap values',
  '# DO NOT COMMIT. Generated on ' + new Date().toISOString(),
  'CLAWTRL_WALLET_NETWORK=base',
  `CLAWTRL_WALLET_MNEMONIC="${mnemonic}"`,
  `CLAWTRL_WALLET_PRIVATE_KEY=0x${privateKeyHex}`,
  `CLAWTRL_WALLET_ADDRESS=${address}`,
  '# Optional: ENS or display label',
  'CLAWTRL_WALLET_ENS=',
  '# Optional: daily spend cap in USDC',
  'CLAWTRL_WALLET_DAILY_CAP_USDC=50',
  '# Optional: autopay toggle',
  'CLAWTRL_WALLET_AUTOPAY=false'
]

writeEnv(lines)

console.log('\n⚡  Generated Portal Base wallet material')
console.log('  Address :', address)
console.log('  Mnemonic:', mnemonic)
console.log('\nSaved secrets to', envPath)
console.log('File permissions set to 600 (owner read/write).')
console.log('\nReminder: never commit .env.local or expose keys. Mirror required values into GitHub secrets manually.')
console.log('\nRe-run with --force to regenerate.')
