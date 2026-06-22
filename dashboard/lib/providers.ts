/**
 * Provider registry for Clawtrl Ops.
 *
 * Single source of truth for every model the fleet can talk to. Adding a new
 * model means adding a row here. Pricing is in USD per million tokens
 * (input / output) so we can roll up real spend in Telemetry.
 *
 * `kind`:
 *   - 'cloud'   direct vendor API (Anthropic, OpenAI, Gemini)
 *   - 'router'  aggregator that fronts many models behind one key (OpenRouter, Bankr)
 *   - 'local'   on-device endpoint, zero-cost, no key required (Ollama / LM Studio)
 */

export type ProviderKind = 'cloud' | 'router' | 'local'

export type ModelCapability = 'tools' | 'vision' | 'long-context' | 'json-mode' | 'reasoning'

export interface ModelInfo {
  id: string
  label: string
  providerId: string
  contextWindow: number
  inputUsdPerMTok: number
  outputUsdPerMTok: number
  capabilities: ModelCapability[]
  description?: string
}

export interface Provider {
  id: string
  label: string
  kind: ProviderKind
  envVar: string
  baseUrl: string
  docsUrl: string
  description: string
  /** Order in dropdowns; lower first. */
  weight: number
  /** Models published by this provider. */
  models: ModelInfo[]
}

const ANTHROPIC: Provider = {
  id: 'anthropic',
  label: 'Anthropic',
  kind: 'cloud',
  envVar: 'ANTHROPIC_API_KEY',
  baseUrl: 'https://api.anthropic.com',
  docsUrl: 'https://console.anthropic.com/settings/keys',
  description: 'Claude family. Default for the fleet.',
  weight: 10,
  models: [
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', providerId: 'anthropic', contextWindow: 200_000, inputUsdPerMTok: 15, outputUsdPerMTok: 75, capabilities: ['tools', 'vision', 'long-context', 'reasoning'], description: 'Heaviest reasoning, slowest, most expensive.' },
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', providerId: 'anthropic', contextWindow: 200_000, inputUsdPerMTok: 3, outputUsdPerMTok: 15, capabilities: ['tools', 'vision', 'long-context'], description: 'Balanced default for most Claws.' },
    { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5', providerId: 'anthropic', contextWindow: 200_000, inputUsdPerMTok: 0.8, outputUsdPerMTok: 4, capabilities: ['tools', 'vision'], description: 'Cheap and fast. Good for high-frequency Claws.' },
  ],
}

const OPENAI: Provider = {
  id: 'openai',
  label: 'OpenAI',
  kind: 'cloud',
  envVar: 'OPENAI_API_KEY',
  baseUrl: 'https://api.openai.com/v1',
  docsUrl: 'https://platform.openai.com/api-keys',
  description: 'GPT family with reasoning models.',
  weight: 20,
  models: [
    { id: 'gpt-5.2', label: 'GPT-5.2', providerId: 'openai', contextWindow: 400_000, inputUsdPerMTok: 5, outputUsdPerMTok: 20, capabilities: ['tools', 'vision', 'long-context', 'json-mode', 'reasoning'] },
    { id: 'gpt-5.2-mini', label: 'GPT-5.2 Mini', providerId: 'openai', contextWindow: 400_000, inputUsdPerMTok: 0.5, outputUsdPerMTok: 2, capabilities: ['tools', 'vision', 'json-mode'] },
    { id: 'o4-mini', label: 'o4-mini (reasoning)', providerId: 'openai', contextWindow: 200_000, inputUsdPerMTok: 1.1, outputUsdPerMTok: 4.4, capabilities: ['tools', 'reasoning', 'json-mode'] },
  ],
}

const GEMINI: Provider = {
  id: 'gemini',
  label: 'Google Gemini',
  kind: 'cloud',
  envVar: 'GOOGLE_GENERATIVE_AI_API_KEY',
  baseUrl: 'https://generativelanguage.googleapis.com',
  docsUrl: 'https://aistudio.google.com/apikey',
  description: 'Gemini 3 family. Strong long context, very cheap Flash tier.',
  weight: 30,
  models: [
    { id: 'gemini-3-pro', label: 'Gemini 3 Pro', providerId: 'gemini', contextWindow: 2_000_000, inputUsdPerMTok: 1.25, outputUsdPerMTok: 5, capabilities: ['tools', 'vision', 'long-context', 'json-mode'] },
    { id: 'gemini-3-flash', label: 'Gemini 3 Flash', providerId: 'gemini', contextWindow: 1_000_000, inputUsdPerMTok: 0.075, outputUsdPerMTok: 0.3, capabilities: ['tools', 'vision', 'long-context', 'json-mode'], description: 'Cheapest cloud option for high volume.' },
  ],
}

const OPENROUTER: Provider = {
  id: 'openrouter',
  label: 'OpenRouter',
  kind: 'router',
  envVar: 'OPENROUTER_API_KEY',
  baseUrl: 'https://openrouter.ai/api/v1',
  docsUrl: 'https://openrouter.ai/keys',
  description: 'One key, every model. Pricing varies per model.',
  weight: 40,
  models: [
    { id: 'openrouter/auto', label: 'OpenRouter Auto', providerId: 'openrouter', contextWindow: 200_000, inputUsdPerMTok: 3, outputUsdPerMTok: 12, capabilities: ['tools'], description: 'Lets OpenRouter pick the best model for the brief.' },
    { id: 'anthropic/claude-sonnet-4-6', label: 'Sonnet 4.6 (via OR)', providerId: 'openrouter', contextWindow: 200_000, inputUsdPerMTok: 3, outputUsdPerMTok: 15, capabilities: ['tools', 'vision', 'long-context'] },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', providerId: 'openrouter', contextWindow: 128_000, inputUsdPerMTok: 0.59, outputUsdPerMTok: 0.79, capabilities: ['tools', 'long-context'] },
    { id: 'qwen/qwen3-coder', label: 'Qwen3 Coder', providerId: 'openrouter', contextWindow: 256_000, inputUsdPerMTok: 0.4, outputUsdPerMTok: 1.6, capabilities: ['tools', 'long-context'] },
    { id: 'moonshotai/kimi-k2.5', label: 'Kimi K2.5', providerId: 'openrouter', contextWindow: 200_000, inputUsdPerMTok: 0.6, outputUsdPerMTok: 2.5, capabilities: ['tools', 'long-context'] },
  ],
}

const BANKR: Provider = {
  id: 'bankr',
  label: 'Bankr Gateway',
  kind: 'router',
  envVar: 'BANKR_API_KEY',
  baseUrl: 'https://gateway.bankr.run/v1',
  docsUrl: 'https://bankr.run/docs',
  description: 'PortalFND-native router. Same key, every supported model.',
  weight: 50,
  models: [
    { id: 'bankr/claude-sonnet-4-6', label: 'Sonnet 4.6 (Bankr)', providerId: 'bankr', contextWindow: 200_000, inputUsdPerMTok: 3, outputUsdPerMTok: 15, capabilities: ['tools', 'vision', 'long-context'] },
    { id: 'bankr/gemini-3-pro', label: 'Gemini 3 Pro (Bankr)', providerId: 'bankr', contextWindow: 2_000_000, inputUsdPerMTok: 1.25, outputUsdPerMTok: 5, capabilities: ['tools', 'long-context'] },
    { id: 'bankr/gpt-5.2', label: 'GPT-5.2 (Bankr)', providerId: 'bankr', contextWindow: 400_000, inputUsdPerMTok: 5, outputUsdPerMTok: 20, capabilities: ['tools', 'reasoning'] },
  ],
}

const OLLAMA: Provider = {
  id: 'ollama',
  label: 'Local (Ollama / LM Studio)',
  kind: 'local',
  envVar: 'OLLAMA_BASE_URL',
  baseUrl: 'http://localhost:11434',
  docsUrl: 'https://ollama.com',
  description: 'On-device models. Zero cost, fully private. Set the URL not a key.',
  weight: 90,
  models: [
    { id: 'ollama/llama3.3:70b', label: 'Llama 3.3 70B (local)', providerId: 'ollama', contextWindow: 128_000, inputUsdPerMTok: 0, outputUsdPerMTok: 0, capabilities: ['tools', 'long-context'] },
    { id: 'ollama/qwen2.5:32b', label: 'Qwen 2.5 32B (local)', providerId: 'ollama', contextWindow: 128_000, inputUsdPerMTok: 0, outputUsdPerMTok: 0, capabilities: ['tools', 'long-context'] },
    { id: 'ollama/gemma3:27b', label: 'Gemma 3 27B (local)', providerId: 'ollama', contextWindow: 128_000, inputUsdPerMTok: 0, outputUsdPerMTok: 0, capabilities: [] },
  ],
}

export const PROVIDERS: Provider[] = [ANTHROPIC, OPENAI, GEMINI, OPENROUTER, BANKR, OLLAMA]

/** Flat list of every supported model, ordered by provider weight then by label. */
export const ALL_MODELS: ModelInfo[] = PROVIDERS
  .slice()
  .sort((a, b) => a.weight - b.weight)
  .flatMap(p => p.models)

/**
 * Look up a model by id. Returns undefined if unknown.
 */
export function getModel(id: string | null | undefined): ModelInfo | undefined {
  if (!id) return undefined
  return ALL_MODELS.find(m => m.id === id)
}

/**
 * Look up the provider that owns a model id.
 */
export function getProviderForModel(id: string | null | undefined): Provider | undefined {
  const m = getModel(id)
  if (!m) return undefined
  return PROVIDERS.find(p => p.id === m.providerId)
}

/**
 * Compute the USD cost of a single mission given input / output token counts.
 * Returns 0 for local models or unknown ids.
 */
export function priceMission(modelId: string, tokensIn: number, tokensOut: number): number {
  const m = getModel(modelId)
  if (!m) return 0
  const inCost = (tokensIn / 1_000_000) * m.inputUsdPerMTok
  const outCost = (tokensOut / 1_000_000) * m.outputUsdPerMTok
  return Math.round((inCost + outCost) * 10_000) / 10_000
}

/**
 * Models grouped by provider for use in <optgroup> dropdowns.
 */
export function groupedModels(): Array<{ provider: Provider; models: ModelInfo[] }> {
  return PROVIDERS
    .slice()
    .sort((a, b) => a.weight - b.weight)
    .map(p => ({ provider: p, models: p.models }))
    .filter(g => g.models.length > 0)
}

/**
 * Provider env-var entries for the Console secrets surface.
 */
export function providerSecretEntries() {
  return PROVIDERS.map(p => ({
    name: p.envVar,
    providerId: p.id,
    providerLabel: p.label,
    providerKind: p.kind,
    description: p.description,
    docsUrl: p.docsUrl,
    isUrlField: p.kind === 'local',
  }))
}
