import { NextResponse } from 'next/server'
import { execFileSync, execSync } from 'child_process'

const BUILTIN_SECRETS = [
  { name: 'CLAUDE_CODE_OAUTH_TOKEN', group: 'Core', description: 'Claude Code OAuth token (set via Authenticate button)', either: 'auth' },
  { name: 'ANTHROPIC_API_KEY', group: 'Model Providers', description: 'Anthropic API key — Claude family. Get one at console.anthropic.com/settings/keys', either: 'auth' },
  { name: 'OPENAI_API_KEY', group: 'Model Providers', description: 'OpenAI API key — GPT and o-series. Get one at platform.openai.com/api-keys' },
  { name: 'GOOGLE_GENERATIVE_AI_API_KEY', group: 'Model Providers', description: 'Google AI Studio key — Gemini 3 family. Get one at aistudio.google.com/apikey' },
  { name: 'OPENROUTER_API_KEY', group: 'Model Providers', description: 'OpenRouter key — one key fronts every model. Get one at openrouter.ai/keys' },
  { name: 'BANKR_API_KEY', group: 'Model Providers', description: 'Bankr Gateway key — PortalFND-native router. Get one at bankr.run/docs' },
  { name: 'OLLAMA_BASE_URL', group: 'Model Providers', description: 'Local Ollama / LM Studio endpoint, e.g. http://localhost:11434. Optional, no key needed.' },
  { name: 'BANKR_LLM_KEY', group: 'Core', description: 'Legacy Bankr Gateway key (bk_...) — kept for back-compat with older Claws.' },
  { name: 'TELEGRAM_BOT_TOKEN', group: 'Telegram', description: 'Bot token from @BotFather' },
  { name: 'TELEGRAM_CHAT_ID', group: 'Telegram', description: 'Your chat ID' },
  { name: 'DISCORD_BOT_TOKEN', group: 'Discord', description: 'Discord bot token' },
  { name: 'DISCORD_CHANNEL_ID', group: 'Discord', description: 'Channel ID for messages' },
  { name: 'DISCORD_WEBHOOK_URL', group: 'Discord', description: 'Webhook URL for notifications' },
  { name: 'SLACK_BOT_TOKEN', group: 'Slack', description: 'Slack bot OAuth token' },
  { name: 'SLACK_CHANNEL_ID', group: 'Slack', description: 'Channel ID for messages' },
  { name: 'SLACK_WEBHOOK_URL', group: 'Slack', description: 'Webhook URL for notifications' },
  { name: 'SENDGRID_API_KEY', group: 'Email', description: 'SendGrid API key — create at sendgrid.com/settings/api_keys' },
  { name: 'NOTIFY_EMAIL_TO', group: 'Email', description: 'Recipient email address for skill notifications' },
  { name: 'DEVTO_API_KEY', group: 'Distribution', description: 'Dev.to API key — generate at dev.to/settings/extensions' },
  { name: 'NEYNAR_API_KEY', group: 'Distribution', description: 'Neynar API key — used by farcaster-digest (read) and syndicate-article (cast)' },
  { name: 'NEYNAR_SIGNER_UUID', group: 'Distribution', description: 'Neynar managed signer UUID — required to publish Farcaster casts' },
  { name: 'XAI_API_KEY', group: 'Skill Keys', description: 'xAI/Grok API key (for tweet skills)' },
  { name: 'COINGECKO_API_KEY', group: 'Skill Keys', description: 'CoinGecko API key (for crypto skills)' },
  { name: 'ALCHEMY_API_KEY', group: 'Skill Keys', description: 'Alchemy API key (for on-chain skills)' },
  { name: 'GH_GLOBAL', group: 'Skill Keys', description: 'GitHub PAT with cross-repo access' },
  { name: 'CLAWTRL_WALLET_PRIVATE_KEY', group: 'Wallet', description: 'Base agent wallet private key (0x…). Generate via wallet:init.' },
  { name: 'CLAWTRL_WALLET_ADDRESS', group: 'Wallet', description: 'Public address of the agent wallet (display only).' },
  { name: 'CLAWTRL_WALLET_NETWORK', group: 'Wallet', description: '"base" or "base-sepolia". Defaults to base.' },
  { name: 'CLAWTRL_WALLET_DAILY_CAP_USDC', group: 'Wallet', description: 'Hard daily spend cap in USDC. 0 disables (NOT recommended).' },
  { name: 'X402_TARGETS', group: 'Wallet', description: 'Newline-separated "<label> <url>" pairs the paywatcher fetches.' },
  { name: 'OPENAI_API_KEY', group: 'Memory', description: 'Used by claw-index for OpenAI text-embedding-3-small (preferred). ~$0.02 per million tokens.' },
  { name: 'VOYAGE_API_KEY', group: 'Memory', description: 'Fallback embeddings via Voyage AI (voyage-3-lite). Only needed if not using OpenAI.' },
  { name: 'WEBHOOK_PROXY_URL', group: 'Triggers', description: 'Optional. Cloudflare Worker base URL (e.g. https://clawtrl-webhook-proxy.workers.dev). When set, the dashboard renders HMAC-protected trigger snippets instead of raw GitHub API calls.' },
]

const BUILTIN_NAMES = new Set(BUILTIN_SECRETS.map(s => s.name))

// Valid env var name pattern
const VALID_SECRET_NAME = /^[A-Z][A-Z0-9_]{1,}$/

function ghAvailable(): boolean {
  try {
    execSync('gh auth status', { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function ghRepo(): string | null {
  try {
    const repo = execSync('gh repo set-default --view', { stdio: 'pipe' }).toString().trim()
    if (repo && !repo.startsWith('no default')) return repo
  } catch {}
  try {
    const repo = execSync('gh repo view --json nameWithOwner -q .nameWithOwner', { stdio: 'pipe' }).toString().trim()
    if (repo) return repo
  } catch {}
  return null
}

function ghArgsRepo(): string[] {
  const repo = ghRepo()
  return repo ? ['-R', repo] : []
}

function listSecrets(): string[] {
  try {
    const out = execFileSync('gh', ['secret', 'list', ...ghArgsRepo(), '--json', 'name', '-q', '.[].name'], {
      stdio: 'pipe',
      cwd: process.cwd(),
    }).toString().trim()
    return out ? out.split('\n').filter(Boolean) : []
  } catch {
    return []
  }
}

export async function GET() {
  if (!ghAvailable()) {
    return NextResponse.json({
      error: 'GitHub CLI not authenticated. Run: gh auth login',
      ghReady: false,
    }, { status: 503 })
  }

  const setSecrets = new Set(listSecrets())

  // Start with builtin secrets
  const secrets = BUILTIN_SECRETS.map(s => ({
    ...s,
    isSet: setSecrets.has(s.name),
  }))

  // Add any GitHub secrets not in builtins as custom "Skill Keys"
  for (const name of setSecrets) {
    if (!BUILTIN_NAMES.has(name)) {
      secrets.push({ name, group: 'Skill Keys', description: 'Custom secret', isSet: true })
    }
  }

  return NextResponse.json({ secrets, ghReady: true })
}

export async function POST(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name, value } = await request.json()

  if (!name || !value) {
    return NextResponse.json({ error: 'name and value required' }, { status: 400 })
  }

  // Allow any valid env var name (builtins + custom)
  if (!VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name — use UPPER_SNAKE_CASE' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'set', name, ...ghArgsRepo(), '-b', value], {
      stdio: 'pipe',
      cwd: process.cwd(),
    })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to set secret'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  if (!ghAvailable()) {
    return NextResponse.json({ error: 'GitHub CLI not authenticated' }, { status: 503 })
  }

  const { name } = await request.json()

  if (!name || !VALID_SECRET_NAME.test(name)) {
    return NextResponse.json({ error: 'Invalid secret name' }, { status: 400 })
  }

  try {
    execFileSync('gh', ['secret', 'delete', name, ...ghArgsRepo()], { stdio: 'pipe', cwd: process.cwd() })
    return NextResponse.json({ ok: true })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed to delete secret'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
