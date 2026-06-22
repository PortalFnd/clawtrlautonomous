export interface Skill { name: string; description: string; tags: string[]; enabled: boolean; schedule: string; var: string; model: string }
export interface Run { id: number; workflow: string; status: string; conclusion: string | null; created_at: string; url: string }
export interface Secret { name: string; group: string; description: string; isSet: boolean; either?: string }
export interface SkillOutput { filename: string; skill: string; timestamp: string; spec: { root: string; state?: Record<string, unknown>; elements: Record<string, SpecElement> } }
export interface SpecElement { type: string; props?: Record<string, unknown>; children?: string[] }

export interface WalletActivity {
  hash: string
  label: string
  timestamp: string
  txHash?: string
  queueId?: string
  status?: 'success' | 'reverted' | 'pending'
  amount?: string
  token?: string
}

export interface WalletSnapshot {
  network: string
  address: string | null
  ens?: string | null
  balances: Array<{ symbol: string; amount: number; usd: number }>
  dailyCapUsd?: number | null
  spentTodayUsd?: number | null
  autopay?: { enabled: boolean; outstandingUsd: number }
  recentActivity: WalletActivity[]
  health: 'ok' | 'warn' | 'alert'
}

export type WalletActionType = 'transfer' | 'approve' | 'autopay' | 'cap' | 'sync'

export interface WalletAction {
  id: string
  type: WalletActionType
  payload: Record<string, string>
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
  executedAt?: string
  txHash?: string
  gasUsed?: string
  error?: string
  notes?: string
}

export interface TxLogEntry {
  timestamp: string
  wallet: string
  type: 'transfer' | 'contract-write' | 'approve' | 'x402' | 'sync'
  hash?: string
  to?: string
  amount?: string
  token?: string
  gasUsed?: string
  status: 'success' | 'reverted' | 'pending'
  label?: string
  queueId?: string
  notes?: string
}
