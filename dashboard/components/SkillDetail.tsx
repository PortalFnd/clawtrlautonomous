'use client'

import { useState } from 'react'
import type { Skill, Run } from '../lib/types'
import { DEPARTMENTS } from '../lib/constants'
import { groupedModels, getModel } from '../lib/providers'
import { displayName, initials, getSkillStatus, cronLabel, timeAgo } from '../lib/utils'
import { ScheduleEditor } from './ScheduleEditor'
import { TriggerSnippet } from './TriggerSnippet'
import { ConfirmDialog } from './ConfirmDialog'

interface SkillDetailProps {
  skill: Skill
  runs: Run[]
  model: string
  gateway: 'direct' | 'bankr'
  busy: Record<string, boolean>
  onToggle: (name: string, enabled: boolean) => void
  onRun: (name: string, v?: string, m?: string) => void
  onDelete: (name: string) => void
  onUpdateSchedule: (name: string, schedule: string) => void
  onUpdateVar: (name: string, v: string) => void
  onUpdateModel: (name: string, m: string) => void
  onViewRun: (run: Run) => void
}

// Dark-theme panel building blocks. Kept inline so this file stays self-contained.
const cardCls = 'rounded-lg border border-[rgba(228,236,255,0.10)] bg-[rgba(255,255,255,0.03)] backdrop-blur-md'
const labelCls = 'text-[10px] font-mono uppercase tracking-[2px] text-primary-40'
const inputDark =
  'w-full bg-[rgba(5,12,32,0.7)] border border-[rgba(228,236,255,0.14)] focus:border-[rgba(51,240,183,0.7)] outline-none text-primary-100 placeholder:text-primary-35 text-xs px-3 py-2 font-mono rounded'

function runIcon(run: Run) {
  if (run.conclusion === 'success') return { glyph: '✓', tone: 'text-eva-green' }
  if (run.conclusion === 'failure') return { glyph: '✕', tone: 'text-eva-red' }
  if (run.status === 'in_progress') return { glyph: '◌', tone: 'text-eva-orange animate-pulse' }
  return { glyph: '·', tone: 'text-primary-40' }
}

function runLabel(run: Run) {
  if (run.conclusion === 'success') return 'Mission completed'
  if (run.conclusion === 'failure') return 'Mission failed'
  if (run.status === 'in_progress') return 'Running now…'
  return 'Queued'
}

export function SkillDetail({ skill, runs, busy, model, onToggle, onRun, onDelete, onUpdateSchedule, onUpdateVar, onUpdateModel, onViewRun }: SkillDetailProps) {
  const groups = groupedModels()
  const [editingSchedule, setEditingSchedule] = useState(false)
  const [editingVar, setEditingVar] = useState(false)
  const [varDraft, setVarDraft] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const dept = skill.tags?.[0] ? DEPARTMENTS[skill.tags[0]] : null
  const accent = dept?.color || '#6B7280'
  const skillRuns = runs.filter(r => r.workflow.toLowerCase().includes(skill.name))
  const status = getSkillStatus(skill.name, skill.enabled, runs)
  const lastRun = skillRuns[0]
  const recent = skillRuns.slice(0, 10)
  const successCount = recent.filter(r => r.conclusion === 'success').length
  const successRate = recent.length ? Math.round((successCount / recent.length) * 100) : null
  const resolvedModelLabel = getModel(skill.model || model)?.label || skill.model || model

  const statusTone =
    status.color === 'green'
      ? 'border-[rgba(51,240,183,0.55)] text-[rgba(51,240,183,0.95)] bg-[rgba(51,240,183,0.08)]'
      : status.color === 'orange'
      ? 'border-eva-orange/55 text-eva-orange bg-eva-orange/10'
      : status.color === 'red'
      ? 'border-eva-red/55 text-eva-red bg-eva-red/10'
      : 'border-[rgba(228,236,255,0.14)] text-primary-40 bg-[rgba(255,255,255,0.03)]'

  return (
    <>
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Hero strip */}
      <section
        className={`${cardCls} relative overflow-hidden`}
        style={{ borderLeft: `3px solid ${accent}` }}
      >
        {/* glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{ background: `radial-gradient(600px circle at 0% 0%, ${accent}33, transparent 60%)` }}
        />

        <div className="relative p-6">
          <div className="flex items-start gap-5">
            <div
              className="w-16 h-16 rounded-md flex items-center justify-center text-xl font-bold text-white shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
              style={{ backgroundColor: skill.enabled ? accent : 'rgba(228,236,255,0.08)' }}
            >
              {initials(skill.name)}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl text-white truncate">{displayName(skill.name)}</h2>
                {dept && (
                  <span
                    className="text-[10px] font-mono uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm"
                    style={{ backgroundColor: accent + '20', color: accent }}
                  >
                    {dept.label}
                  </span>
                )}
                <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[1.5px] px-2 py-0.5 rounded-sm border ${statusTone}`}>
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      status.color === 'green'
                        ? 'bg-eva-green'
                        : status.color === 'orange'
                        ? 'bg-eva-orange animate-pulse'
                        : status.color === 'red'
                        ? 'bg-eva-red'
                        : 'bg-primary-40'
                    }`}
                  />
                  {status.label}
                </span>
              </div>
              {skill.description && (
                <p className="text-sm text-primary-50 mt-2 leading-relaxed">{skill.description}</p>
              )}

              {/* Stat strip */}
              <div className="grid grid-cols-3 gap-3 mt-5">
                <div>
                  <div className={labelCls}>Last mission</div>
                  <div className="font-display text-sm text-white mt-0.5">
                    {lastRun ? timeAgo(lastRun.created_at) : 'Never deployed'}
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Success rate</div>
                  <div className="font-display text-sm text-white mt-0.5 flex items-baseline gap-1">
                    {successRate === null ? <span className="text-primary-40">—</span> : <><span>{successRate}%</span><span className="text-[10px] text-primary-40 font-mono">last {recent.length}</span></>}
                  </div>
                </div>
                <div>
                  <div className={labelCls}>Capability</div>
                  <div className="font-display text-sm text-white mt-0.5 truncate" title={resolvedModelLabel}>{resolvedModelLabel}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => onRun(skill.name, skill.var, skill.model)}
                disabled={!!busy[`r-${skill.name}`]}
                className="h-8 px-4 inline-flex items-center justify-center gap-1.5 text-[11px] font-mono uppercase tracking-[1.5px] rounded bg-eva-orange text-white hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_4px_12px_rgba(255,107,26,0.35)]"
              >
                {busy[`r-${skill.name}`] ? '…' : '▶ Deploy mission'}
              </button>
              <button
                onClick={() => onToggle(skill.name, !skill.enabled)}
                disabled={!!busy[skill.name]}
                className={`h-8 px-4 inline-flex items-center justify-center text-[11px] font-mono uppercase tracking-[1.5px] rounded transition-colors disabled:opacity-50 border ${
                  skill.enabled
                    ? 'border-[rgba(228,236,255,0.18)] text-primary-50 hover:text-white hover:border-[rgba(228,236,255,0.32)]'
                    : 'border-[rgba(51,240,183,0.55)] text-white bg-[rgba(51,240,183,0.12)] hover:bg-[rgba(51,240,183,0.22)]'
                }`}
              >
                {skill.enabled ? 'Take off duty' : 'Put on duty'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-[10px] text-eva-red/50 hover:text-eva-red font-mono tracking-[1px] uppercase transition-colors text-right pr-1"
              >
                Retire
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Control grid: Shift / Brief / Capability */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Shift */}
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className={labelCls}>Shift Schedule</span>
            <button
              onClick={() => setEditingSchedule(!editingSchedule)}
              className="text-[10px] font-mono text-primary-40 hover:text-[rgba(51,240,183,0.95)] transition-colors"
            >
              {editingSchedule ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingSchedule ? (
            <ScheduleEditor
              cron={skill.schedule}
              onSave={(c) => { onUpdateSchedule(skill.name, c); setEditingSchedule(false) }}
            />
          ) : (
            <div className="font-display text-lg text-white leading-tight">{cronLabel(skill.schedule)}</div>
          )}
        </div>

        {/* Brief */}
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className={labelCls}>Assignment Brief</span>
            <button
              onClick={() => { setEditingVar(!editingVar); setVarDraft(skill.var) }}
              className="text-[10px] font-mono text-primary-40 hover:text-[rgba(51,240,183,0.95)] transition-colors"
            >
              {editingVar ? 'Cancel' : 'Edit'}
            </button>
          </div>
          {editingVar ? (
            <div className="space-y-2">
              <input
                type="text"
                value={varDraft}
                onChange={(e) => setVarDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { onUpdateVar(skill.name, varDraft); setEditingVar(false) } }}
                placeholder="e.g. AI agents, Base, x402"
                autoFocus
                className={inputDark}
              />
              <button
                onClick={() => { onUpdateVar(skill.name, varDraft); setEditingVar(false) }}
                className="w-full h-8 inline-flex items-center justify-center text-[11px] font-mono uppercase tracking-[1.5px] rounded bg-[rgba(51,240,183,0.16)] text-white border border-[rgba(51,240,183,0.5)] hover:bg-[rgba(51,240,183,0.26)] transition-colors"
              >
                Save brief
              </button>
            </div>
          ) : (
            <div className="font-display text-base text-white leading-snug break-words">
              {skill.var || <span className="text-primary-35">No focus set</span>}
            </div>
          )}
        </div>

        {/* Capability */}
        <div className={`${cardCls} p-4`}>
          <div className="flex items-center justify-between mb-3">
            <span className={labelCls}>Capability</span>
            <span className="text-[10px] font-mono text-primary-40">Model</span>
          </div>
          <select
            value={skill.model}
            onChange={(e) => onUpdateModel(skill.name, e.target.value)}
            className="w-full h-8 px-2 text-[11px] font-mono bg-[rgba(5,12,32,0.7)] text-primary-100 border border-[rgba(228,236,255,0.14)] outline-none cursor-pointer rounded hover:border-[rgba(91,124,255,0.55)] focus:border-[rgba(51,240,183,0.7)] transition-colors"
          >
            <option value="">Default ({getModel(model)?.label ?? model})</option>
            {groups.map(({ provider, models }) => (
              <optgroup key={provider.id} label={provider.label}>
                {models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </optgroup>
            ))}
          </select>
          {(() => {
            const m = getModel(skill.model || model)
            if (!m) return null
            const local = m.inputUsdPerMTok === 0 && m.outputUsdPerMTok === 0
            return (
              <div className="text-[10px] font-mono text-primary-40 mt-2 leading-relaxed">
                {local ? 'Local · $0 / run' : `$${m.inputUsdPerMTok}/M in · $${m.outputUsdPerMTok}/M out`} · {(m.contextWindow / 1000).toFixed(0)}k ctx
              </div>
            )
          })()}
        </div>
      </section>

      <TriggerSnippet skill={skill.name} />

      {/* Mission log */}
      <section>
        <div className="flex items-center justify-between mb-2 px-1">
          <span className={labelCls}>Mission Log</span>
          {skillRuns.length > 0 && (
            <span className="text-[10px] font-mono text-primary-35">{skillRuns.length} total</span>
          )}
        </div>
        <div className={`${cardCls} divide-y divide-[rgba(228,236,255,0.06)]`}>
          {recent.length ? (
            recent.map(run => {
              const { glyph, tone } = runIcon(run)
              return (
                <button
                  key={run.id}
                  onClick={() => onViewRun(run)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(255,255,255,0.03)] transition-colors text-left group"
                >
                  <span className={`text-sm w-4 text-center ${tone}`}>{glyph}</span>
                  <span className="text-xs text-primary-100 truncate flex-1 font-mono">{runLabel(run)}</span>
                  <span className="text-[10px] text-primary-40 font-mono tabular-nums">{timeAgo(run.created_at)}</span>
                  <span className="text-[10px] text-primary-35 font-mono opacity-0 group-hover:opacity-100 transition-opacity">view →</span>
                </button>
              )
            })
          ) : (
            <div className="px-4 py-10 text-center text-xs text-primary-40 font-mono">
              No missions yet. Hit <span className="text-eva-orange">Deploy mission</span> to send this claw on its first run.
            </div>
          )}
        </div>
      </section>
    </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        title={`Retire ${displayName(skill.name)}?`}
        message="This will remove the skill from claw.yml and delete its SKILL.md file. This action cannot be undone."
        confirmLabel="Retire"
        destructive
        onConfirm={() => { setShowDeleteConfirm(false); onDelete(skill.name) }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
