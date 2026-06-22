import { createHash, randomBytes } from 'crypto'

export function isWalletWriteProtected(): boolean {
  return Boolean(process.env.CLAWTRL_WALLET_CONFIRM_PIN || '')
}

export function verifyConfirmToken(token: string | undefined | null): boolean {
  const pin = process.env.CLAWTRL_WALLET_CONFIRM_PIN || ''
  if (!pin) return true
  if (!token) return false
  const expected = createHash('sha256').update(pin).digest('hex')
  const provided = createHash('sha256').update(token).digest('hex')
  if (expected.length !== provided.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i)
  return diff === 0
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString('hex')
}
