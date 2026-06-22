'use client'

import { useMemo, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import type { Skill, Run } from '../lib/types'
import { DEPARTMENTS } from '../lib/constants'
import { displayName, initials, getSkillStatus, statusDot } from '../lib/utils'

interface LeftSidebarProps {
  view: 'hq' | 'wallet' | 'secrets' | 'economics'
  onNavigate: (v: 'hq' | 'wallet' | 'secrets' | 'economics') => void
  selectedSkill: string | null
  setSelectedSkill: (s: string | null) => void
  skills: Skill[]
  runs: Run[]
  repo: string
  enabledCount: number
  workingCount: number
  onSkillSelect: (name: string) => void
}

type DenFilter = 'all' | 'on' | 'off' | 'live'

export function LeftSidebar({ view, onNavigate, selectedSkill, setSelectedSkill, skills, runs, repo, enabledCount, workingCount, onSkillSelect }: LeftSidebarProps) {
  const [skillSearch, setSkillSearch] = useState('')
  const [filter, setFilter] = useState<DenFilter>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const router = useRouter()
  const pathname = usePathname()

  const departments = useMemo(() => {
    const m = new Map<string, Skill[]>()
    skills.forEach(s => { const t = s.tags?.[0] || 'meta'; if (!m.has(t)) m.set(t, []); m.get(t)!.push(s) })
    return m
  }, [skills])

  const workingNames = useMemo(
    () => new Set(runs.filter(r => r.status === 'in_progress').map(r => r.workflow.toLowerCase())),
    [runs],
  )

  const matchesFilter = (s: Skill) => {
    if (filter === 'on') return s.enabled
    if (filter === 'off') return !s.enabled
    if (filter === 'live') return [...workingNames].some(w => w.includes(s.name))
    return true
  }

  const matchesSearch = (s: Skill) => {
    if (!skillSearch) return true
    const q = skillSearch.toLowerCase()
    return displayName(s.name).toLowerCase().includes(q) || s.name.includes(q)
  }

  const liveSkills = skills.filter(s => [...workingNames].some(w => w.includes(s.name)))

  const toggleCell = (tag: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(tag)) next.delete(tag); else next.add(tag)
      return next
    })
  }

  return (
    <div className="w-[260px] border-r border-[rgba(228,236,255,0.12)] flex flex-col shrink-0 bg-[rgba(5,12,32,0.65)] backdrop-blur-xl">
      {/* Brand */}
      <div className="px-4 py-4 border-b border-[rgba(228,236,255,0.12)]">
        <div className="flex items-center gap-3">
          <div className="brand-mark" aria-hidden>
            <img src="/clawtrl.jpg" alt="Clawtrl" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-mono uppercase tracking-[3px] text-[rgba(51,240,183,0.7)]">PortalFND // Ops</div>
            <div className="font-display text-lg leading-tight text-white">Clawtrl Ops</div>
            <div className="text-[11px] text-primary-40 font-mono">{enabledCount}/{skills.length} on duty{workingCount > 0 ? <span className="text-eva-orange"> · {workingCount} live</span> : ''}</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="px-2 py-2 border-b border-[rgba(228,236,255,0.12)] space-y-0.5">
        {[
          { id: 'hq', label: 'Fleet Bay', icon: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z', action: () => { setSelectedSkill(null); onNavigate('hq'); router.push('/') }, active: pathname === '/' && view === 'hq' && !selectedSkill },
          { id: 'wallet', label: 'Treasury Vault', icon: 'M3 5.25C3 4.00736 4.00736 3 5.25 3h13.5C19.9926 3 21 4.00736 21 5.25v13.5A2.25 2.25 0 0118.75 21H5.25A2.25 2.25 0 013 18.75V5.25zm3 2.25a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5A.75.75 0 016 7.5zm0 4a.75.75 0 01.75-.75h9.5a.75.75 0 010 1.5h-9.5A.75.75 0 016 11.5zm0 4a.75.75 0 01.75-.75h5.5a.75.75 0 010 1.5h-5.5A.75.75 0 016 15.5z', action: () => { setSelectedSkill(null); onNavigate('wallet'); router.push('/wallet') }, active: pathname === '/wallet' || view === 'wallet' },
          { id: 'secrets', label: 'Console', icon: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z', action: () => { setSelectedSkill(null); onNavigate('secrets'); router.push('/') }, active: view === 'secrets' && pathname !== '/wallet' },
          { id: 'economics', label: 'Economics', icon: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941', action: () => { setSelectedSkill(null); onNavigate('economics'); router.push('/') }, active: view === 'economics' && pathname !== '/wallet' },
        ].map(item => (
          <button key={item.id} onClick={item.action}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-mono transition-all border-l-2 ${item.active ? 'border-[rgba(51,240,183,0.85)] bg-[rgba(255,255,255,0.04)] text-white' : 'border-transparent text-primary-50 hover:text-primary-100 hover:bg-[rgba(255,255,255,0.04)]'}`}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d={item.icon} /></svg>
            {item.label}
          </button>
        ))}
      </div>

      {/* The Den */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-1 flex items-baseline justify-between">
          <div>
            <div className="font-display text-sm text-white leading-tight">The Den</div>
            <div className="text-[10px] font-mono uppercase tracking-[2px] text-primary-40">Where the claws live</div>
          </div>
          <span className="text-[10px] font-mono text-primary-35">{skills.length}</span>
        </div>

        {/* Filter chips */}
        <div className="px-3 pt-3 pb-1.5 flex gap-1">
          {(
            [
              ['all', 'All', skills.length],
              ['live', 'Live', liveSkills.length],
              ['on', 'Duty', enabledCount],
              ['off', 'Off', skills.length - enabledCount],
            ] as const
          ).map(([id, label, count]) => {
            const active = filter === id
            return (
              <button
                key={id}
                onClick={() => setFilter(id as DenFilter)}
                className={`flex-1 text-[10px] font-mono uppercase tracking-[1px] px-1.5 py-1 rounded border transition-colors ${
                  active
                    ? 'bg-[rgba(51,240,183,0.14)] border-[rgba(51,240,183,0.55)] text-white'
                    : 'bg-transparent border-[rgba(228,236,255,0.12)] text-primary-40 hover:text-primary-100 hover:border-[rgba(228,236,255,0.28)]'
                }`}
              >
                {label} <span className={active ? 'text-[rgba(51,240,183,0.85)]' : 'text-primary-35'}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="px-3 pt-1 pb-3">
          <input
            type="text"
            value={skillSearch}
            onChange={(e) => setSkillSearch(e.target.value)}
            placeholder="Hunt a claw…"
            className="w-full bg-[rgba(255,255,255,0.05)] text-primary-100 text-[11px] px-3 py-1.5 rounded border border-[rgba(228,236,255,0.12)] outline-none font-mono focus:border-[rgba(51,240,183,0.55)] transition-colors placeholder:text-primary-35"
          />
        </div>

        {/* Working Now */}
        {liveSkills.length > 0 && (
          <div className="mx-3 mb-3 rounded-md border border-[rgba(255,107,26,0.35)] bg-[rgba(255,107,26,0.06)]">
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[rgba(255,107,26,0.18)]">
              <span className="w-1.5 h-1.5 rounded-full bg-eva-orange animate-pulse" />
              <span className="text-[10px] font-mono uppercase tracking-[2px] text-eva-orange flex-1">Working now</span>
              <span className="text-[10px] font-mono text-eva-orange">{liveSkills.length}</span>
            </div>
            <div>
              {liveSkills.map(s => {
                const d = DEPARTMENTS[s.tags?.[0] || 'meta'] || DEPARTMENTS.meta
                const sel = selectedSkill === s.name
                return (
                  <button
                    key={s.name}
                    onClick={() => onSkillSelect(s.name)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${sel ? 'bg-[rgba(255,107,26,0.1)]' : 'hover:bg-[rgba(255,107,26,0.08)]'}`}
                  >
                    <div className="w-5 h-5 flex items-center justify-center text-[9px] font-bold shrink-0 text-white rounded-sm" style={{ backgroundColor: d.color }}>
                      {initials(s.name)}
                    </div>
                    <span className="text-[11px] text-white truncate flex-1">{displayName(s.name)}</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-eva-orange animate-pulse" />
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Cell cards */}
        <div className="px-2 pb-4 space-y-1.5">
          {[...departments.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([tag, tagSkills]) => {
              const filtered = tagSkills.filter(matchesFilter).filter(matchesSearch)
              if (!filtered.length) return null
              const d = DEPARTMENTS[tag] || DEPARTMENTS.meta
              const en = filtered.filter(s => s.enabled).length
              const isCollapsed = collapsed.has(tag)
              return (
                <div
                  key={tag}
                  className="rounded-md border border-[rgba(228,236,255,0.08)] bg-[rgba(255,255,255,0.02)] overflow-hidden"
                  style={{ borderLeft: `2px solid ${d.color}` }}
                >
                  <button
                    onClick={() => toggleCell(tag)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors"
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-[10px] font-mono uppercase tracking-[2px] text-primary-100 flex-1 text-left truncate">{d.label}</span>
                    <span className="text-[10px] font-mono text-primary-40">{en}/{filtered.length}</span>
                    <svg
                      width="10" height="10" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      className={`text-primary-40 transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  {!isCollapsed && (
                    <div className="border-t border-[rgba(228,236,255,0.06)]">
                      {filtered
                        .sort((a, b) => Number(b.enabled) - Number(a.enabled) || a.name.localeCompare(b.name))
                        .map(s => {
                          const st = getSkillStatus(s.name, s.enabled, runs)
                          const sel = selectedSkill === s.name
                          return (
                            <button
                              key={s.name}
                              onClick={() => onSkillSelect(s.name)}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 transition-colors text-left ${
                                sel
                                  ? 'bg-[rgba(51,240,183,0.08)] border-l-2 border-[rgba(51,240,183,0.85)] -ml-[2px]'
                                  : 'hover:bg-[rgba(255,255,255,0.03)] border-l-2 border-transparent -ml-[2px]'
                              }`}
                            >
                              <div
                                className="w-6 h-6 flex items-center justify-center text-[9px] font-bold shrink-0 text-white rounded-sm"
                                style={{ backgroundColor: s.enabled ? d.color : 'rgba(228,236,255,0.08)' }}
                              >
                                {initials(s.name)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className={`text-[11px] truncate ${sel ? 'text-white font-semibold' : 'text-primary-100'}`}>
                                  {displayName(s.name)}
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className={statusDot(st.color)} />
                                  <span className="text-[9px] text-primary-40 font-mono truncate">{st.label}</span>
                                </div>
                              </div>
                            </button>
                          )
                        })}
                    </div>
                  )}
                </div>
              )
            })}
          {skills.length > 0 && [...departments.entries()].every(([tag, tagSkills]) =>
            !tagSkills.filter(matchesFilter).filter(matchesSearch).length,
          ) && (
            <div className="text-center py-6 text-[11px] font-mono text-primary-40">
              No claws match this filter.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
