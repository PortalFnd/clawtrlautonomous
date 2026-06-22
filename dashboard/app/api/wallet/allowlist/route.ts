import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { NextResponse } from 'next/server'

const REPO_ROOT = resolve(process.cwd(), '..')
const ALLOWLIST_PATH = resolve(REPO_ROOT, 'wallet/address-allowlist.json')

interface AllowlistEntry {
  address: string
  label: string
  addedAt: string
}

function loadAllowlist(): AllowlistEntry[] {
  try {
    if (!existsSync(ALLOWLIST_PATH)) return []
    const raw = readFileSync(ALLOWLIST_PATH, 'utf8')
    if (!raw.trim()) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function saveAllowlist(entries: AllowlistEntry[]) {
  const dir = resolve(ALLOWLIST_PATH, '..')
  if (!existsSync(dir)) {
    const { mkdirSync } = require('fs')
    mkdirSync(dir, { recursive: true })
  }
  writeFileSync(ALLOWLIST_PATH, JSON.stringify(entries, null, 2), 'utf8')
}

export async function GET() {
  return NextResponse.json({ allowlist: loadAllowlist() })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { address, label } = body

    if (!address || !address.startsWith('0x') || address.length < 42) {
      return NextResponse.json({ error: 'Valid address required' }, { status: 400 })
    }

    const entries = loadAllowlist()
    if (entries.some(e => e.address.toLowerCase() === address.toLowerCase())) {
      return NextResponse.json({ error: 'Address already in allowlist' }, { status: 409 })
    }

    entries.push({
      address: address.toLowerCase(),
      label: label || '',
      addedAt: new Date().toISOString(),
    })
    saveAllowlist(entries)
    return NextResponse.json({ allowlist: entries })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { address } = body

    if (!address) {
      return NextResponse.json({ error: 'Address required' }, { status: 400 })
    }

    const entries = loadAllowlist()
    const filtered = entries.filter(e => e.address.toLowerCase() !== address.toLowerCase())
    saveAllowlist(filtered)
    return NextResponse.json({ allowlist: filtered })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 })
  }
}

export function isAddressAllowed(address: string): boolean {
  const entries = loadAllowlist()
  if (entries.length === 0) return true
  return entries.some(e => e.address.toLowerCase() === address.toLowerCase())
}
