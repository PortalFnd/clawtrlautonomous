import type { Skill } from '../lib/types'
import { DEPARTMENTS } from '../lib/constants'
import { groupedModels } from '../lib/providers'
import { displayName } from '../lib/utils'

interface TopBarProps {
  skill: Skill | null
  view: 'hq' | 'secrets' | 'economics'
  repo: string
  model: string
  gateway: 'direct' | 'bankr'
  authStatus: { authenticated: boolean } | null
  authLoading: boolean
  pulling: boolean
  syncing: boolean
  hasChanges: boolean
  behind: number
  onSetupAuth: () => void
  onUpdateModel: (m: string) => void
  onShowImport: () => void
  onPull: () => void
  onSync: () => void
}

export function TopBar({ skill, view, repo, model, gateway, authStatus, authLoading, pulling, syncing, hasChanges, behind, onSetupAuth, onUpdateModel, onShowImport, onPull, onSync }: TopBarProps) {
  const dept = skill?.tags?.[0] ? DEPARTMENTS[skill.tags[0]] : null
  const groups = groupedModels()

  // Shared button shell: locks every control to the same height so the bar never wraps.
  const btn = 'h-7 px-3 inline-flex items-center justify-center whitespace-nowrap text-[11px] font-mono rounded transition-colors disabled:opacity-50'
  const ghost = `${btn} border border-[rgba(228,236,255,0.14)] text-primary-50 hover:text-white hover:border-[rgba(91,124,255,0.55)] hover:bg-[rgba(91,124,255,0.08)]`
  const Divider = () => <span aria-hidden className="w-px h-5 bg-[rgba(228,236,255,0.12)] mx-1" />

  const title = skill
    ? displayName(skill.name)
    : view === 'secrets'
      ? 'Console'
      : view === 'economics'
        ? 'Economics'
        : 'Fleet Bay // Mission Floor'

  return (
    <div className="h-12 border-b border-[rgba(228,236,255,0.12)] flex items-center justify-between px-4 shrink-0 bg-[rgba(5,12,32,0.65)] backdrop-blur-xl">
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-display text-base truncate">{title}</span>
        {skill && dept && (
          <span className="text-[10px] font-mono uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm whitespace-nowrap" style={{ backgroundColor: dept.color + '20', color: dept.color }}>
            {dept.label}
          </span>
        )}
        {!skill && view === 'hq' && (
          <span className="text-[10px] font-mono tracking-[2px] uppercase text-primary-35 whitespace-nowrap">Workspace 01</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* Identity section */}
        {gateway === 'bankr' && (
          <span className="text-[10px] font-mono px-2 h-7 inline-flex items-center bg-eva-orange/15 text-eva-orange uppercase tracking-[1.5px] rounded">Bankr</span>
        )}
        {authStatus && !authStatus.authenticated && (
          <button
            onClick={onSetupAuth}
            disabled={authLoading}
            className={`${btn} bg-eva-orange text-white uppercase tracking-[1.5px] hover:opacity-90`}
          >
            {authLoading ? '…' : 'Auth'}
          </button>
        )}
        <select
          value={model}
          onChange={(e) => onUpdateModel(e.target.value)}
          className="h-7 px-2 text-[11px] font-mono bg-[rgba(255,255,255,0.06)] text-primary-100 border border-[rgba(228,236,255,0.14)] outline-none cursor-pointer rounded max-w-[200px] hover:border-[rgba(91,124,255,0.55)] transition-colors"
        >
          {groups.map(({ provider, models }) => (
            <optgroup key={provider.id} label={provider.label}>
              {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>

        <Divider />

        {/* Fleet section */}
        <button
          onClick={onShowImport}
          className={`${btn} bg-[rgba(51,240,183,0.16)] text-white border border-[rgba(51,240,183,0.5)] hover:bg-[rgba(51,240,183,0.26)] uppercase tracking-[1.5px]`}
        >
          + Recruit
        </button>

        <Divider />

        {/* Source section */}
        {repo && (
          <a
            href={`https://github.com/${repo}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ghost}
            title={`Open ${repo} on GitHub`}
          >
            GitHub
          </a>
        )}
        <button onClick={onPull} disabled={pulling} className={`${ghost} relative`}>
          {behind > 0 && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-eva-orange" />}
          {pulling ? '…' : 'Pull'}
        </button>
        <button
          onClick={onSync}
          disabled={syncing || !hasChanges}
          className={`${btn} relative border ${
            hasChanges
              ? 'border-[rgba(51,240,183,0.55)] text-white bg-[rgba(51,240,183,0.12)] hover:bg-[rgba(51,240,183,0.22)]'
              : 'border-[rgba(228,236,255,0.14)] text-primary-50'
          }`}
        >
          {hasChanges && <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-eva-green" />}
          {syncing ? '…' : 'Deploy'}
        </button>
      </div>
    </div>
  )
}
