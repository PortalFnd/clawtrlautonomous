import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { resolve } from 'path'

const REPO_ROOT = resolve(process.cwd(), '..')

export async function GET() {
  const clawYml = existsSync(resolve(REPO_ROOT, 'claw.yml'))
  const memoryDir = existsSync(resolve(REPO_ROOT, 'memory'))
  const skillsDir = existsSync(resolve(REPO_ROOT, 'skills'))
  const walletDir = existsSync(resolve(REPO_ROOT, 'wallet'))

  const hasGithubToken = Boolean(process.env.GITHUB_TOKEN || process.env.CLAWTRL_TOKEN)
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY)
  const hasWalletKey = Boolean(
    process.env.CLAWTRL_WALLET_PRIVATE_KEY || process.env.AGENT_WALLET_PRIVATE_KEY,
  )

  const checks = {
    clawYml,
    skillsDir,
    memoryDir,
    walletDir,
    githubToken: hasGithubToken,
    anthropicKey: hasAnthropicKey,
    walletKey: hasWalletKey,
  }

  const allOk = Object.values(checks).every(Boolean)
  const status = allOk ? 'healthy' : 'degraded'

  return NextResponse.json({
    status,
    checks,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
}
