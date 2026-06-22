'use client'

import { useState, useRef } from 'react'

interface ImportModalProps {
  onClose: () => void
  onImport: (files: Array<{ path: string; content: string }>, name?: string) => Promise<void>
  onRecruited?: (info: { name: string; summary: string; schedule: string }) => void
}

type Tab = 'brief' | 'files'

interface AutoSpecPreview {
  name: string
  description: string
  schedule: string
  var: string
  tags: string[]
  summary: string
}

export function ImportModal({ onClose, onImport, onRecruited }: ImportModalProps) {
  const [tab, setTab] = useState<Tab>('brief')
  const [uploadFiles, setUploadFiles] = useState<Array<{ path: string; content: string }>>([])
  const [uploadDragOver, setUploadDragOver] = useState(false)
  const [uploadName, setUploadName] = useState('')
  const [importLoading, setImportLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-Spec state
  const [brief, setBrief] = useState('')
  const [briefLoading, setBriefLoading] = useState(false)
  const [briefError, setBriefError] = useState<string | null>(null)
  const [preview, setPreview] = useState<AutoSpecPreview | null>(null)

  const readFilesFromInput = async (fl: FileList) => {
    const files: Array<{ path: string; content: string }> = []
    for (let i = 0; i < fl.length; i++) {
      const f = fl[i]
      files.push({ path: (f as { webkitRelativePath?: string }).webkitRelativePath || f.name, content: await f.text() })
    }
    setUploadFiles(files)
    const sf = files.find(f => { const l = f.path.toLowerCase(); return l === 'skill.md' || l.endsWith('/skill.md') || l.endsWith('.skill') })
    if (sf) {
      const fm = sf.content.match(/^---\s*\n([\s\S]*?)\n---/)
      if (fm) { const n = fm[1].match(/name:\s*(.+)/); if (n) { const slug = n[1].trim().replace(/^['"]|['"]$/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); if (slug) setUploadName(slug) } }
    }
  }

  const handleUpload = async () => {
    if (!uploadFiles.length) return
    setImportLoading(true)
    try {
      await onImport(uploadFiles, uploadName || undefined)
      onClose()
    } finally {
      setImportLoading(false)
    }
  }

  const runAutoSpec = async (mode: 'preview' | 'commit') => {
    if (!brief.trim()) return
    setBriefError(null)
    setBriefLoading(true)
    try {
      const res = await fetch('/api/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief, preview: mode === 'preview' }),
      })
      const data = await res.json().catch(() => ({} as Record<string, unknown>))
      if (!res.ok) {
        setBriefError((data.error as string) || `Auto-Spec failed (${res.status})`)
        return
      }
      if (mode === 'preview') {
        setPreview(data.spec as AutoSpecPreview)
      } else {
        onRecruited?.({
          name: data.name as string,
          summary: (data.summary as string) || (data.description as string) || '',
          schedule: data.schedule as string,
        })
        onClose()
      }
    } catch (err) {
      setBriefError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setBriefLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,5,15,0.75)] backdrop-blur-md p-4">
      <div className="w-full max-w-md rounded-xl border border-[rgba(91,124,255,0.28)] bg-[rgba(11,18,38,0.92)] p-[var(--space-lg)] shadow-[0_30px_60px_rgba(2,6,18,0.6)] text-primary-100">
        <div className="flex items-center justify-between mb-[var(--space-md)]">
          <div>
            <div className="text-[10px] font-mono tracking-[3px] uppercase text-[rgba(51,240,183,0.75)]">Workspace 01 // Fleet Bay</div>
            <h2 className="font-display text-xl text-white">Recruit Claw</h2>
          </div>
          <button onClick={onClose} className="text-primary-40 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-[var(--space-md)] border-b border-[rgba(228,236,255,0.10)]">
          {([['brief', 'From a brief'], ['files', 'From files']] as const).map(([id, label]) => {
            const active = tab === id
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`text-[10px] font-mono uppercase tracking-[1.5px] px-3 py-2 -mb-px border-b-2 transition-colors ${
                  active
                    ? 'border-[rgba(51,240,183,0.85)] text-white'
                    : 'border-transparent text-primary-40 hover:text-primary-100'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        {tab === 'brief' && (
          <div className="space-y-3">
            <div className="text-[11px] text-primary-50 font-mono leading-relaxed">
              Describe what you want this claw to do in one sentence. Auto-Spec writes the SKILL.md, picks a schedule, and registers it disabled in <span className="text-[rgba(51,240,183,0.85)]">claw.yml</span>.
            </div>
            <textarea
              value={brief}
              onChange={(e) => { setBrief(e.target.value); setPreview(null); setBriefError(null) }}
              placeholder="e.g. watch USDC reserves on Aerodrome and ping me on 5% drops"
              rows={3}
              maxLength={1000}
              autoFocus
              className="w-full bg-[rgba(5,12,32,0.7)] border border-[rgba(91,124,255,0.28)] focus:border-[rgba(51,240,183,0.7)] outline-none text-primary-100 placeholder:text-primary-40 text-xs px-3 py-2 font-mono rounded resize-none"
            />
            {preview && (
              <div className="rounded border border-[rgba(51,240,183,0.35)] bg-[rgba(51,240,183,0.06)] p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-[1.5px] text-[rgba(51,240,183,0.85)]">Preview</span>
                  <span className="text-[10px] font-mono text-primary-40">{preview.tags.join(' · ')}</span>
                </div>
                <div className="text-sm text-white font-display">{preview.name}</div>
                <div className="text-[11px] text-primary-100 font-mono leading-relaxed">{preview.summary}</div>
                <div className="text-[10px] text-primary-40 font-mono">
                  schedule: <span className="text-primary-100">{preview.schedule}</span>
                  {preview.var && <> · var: <span className="text-primary-100">{preview.var}</span></>}
                </div>
              </div>
            )}
            {briefError && (
              <div className="text-[11px] font-mono text-eva-red bg-[rgba(255,79,79,0.08)] border border-[rgba(255,79,79,0.35)] rounded px-3 py-2">
                {briefError}
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => runAutoSpec('preview')}
                disabled={!brief.trim() || briefLoading}
                className="flex-1 h-9 inline-flex items-center justify-center text-[11px] font-mono uppercase tracking-[1.5px] rounded bg-[rgba(91,124,255,0.12)] text-primary-100 border border-[rgba(91,124,255,0.35)] hover:border-[rgba(91,124,255,0.65)] hover:text-white transition-colors disabled:opacity-50"
              >
                {briefLoading ? '…' : 'Preview'}
              </button>
              <button
                onClick={() => runAutoSpec('commit')}
                disabled={!brief.trim() || briefLoading}
                className="flex-1 h-9 inline-flex items-center justify-center text-[11px] font-mono uppercase tracking-[1.5px] rounded bg-[rgba(51,240,183,0.18)] text-white border border-[rgba(51,240,183,0.55)] hover:bg-[rgba(51,240,183,0.28)] transition-colors disabled:opacity-50"
              >
                {briefLoading ? 'Recruiting…' : 'Recruit'}
              </button>
            </div>
            <div className="text-[10px] text-primary-40 font-mono">
              Needs <span className="text-primary-100">ANTHROPIC_API_KEY</span> in Console → Model Providers.
            </div>
          </div>
        )}

        {tab === 'files' && <>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <input ref={(el) => { if (el) el.setAttribute('webkitdirectory', '') }} type="file" className="hidden" id="folder-input" onChange={(e) => e.target.files && readFilesFromInput(e.target.files)} />
        <div onDragOver={(e) => { e.preventDefault(); setUploadDragOver(true) }} onDragLeave={() => setUploadDragOver(false)} onDrop={(e) => { e.preventDefault(); setUploadDragOver(false); if (e.dataTransfer.files.length > 0) readFilesFromInput(e.dataTransfer.files) }}
          className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${uploadDragOver ? 'border-[rgba(51,240,183,0.85)] bg-[rgba(51,240,183,0.06)]' : 'border-[rgba(91,124,255,0.28)] hover:border-[rgba(91,124,255,0.55)]'}`}>
          {!uploadFiles.length ? (<><div className="text-sm text-primary-100 font-display mb-3">Drop a skill folder here</div><div className="flex gap-2 justify-center"><button onClick={() => fileInputRef.current?.click()} className="bg-[rgba(91,124,255,0.12)] text-primary-100 text-[11px] px-3 py-1.5 font-mono border border-[rgba(91,124,255,0.35)] hover:border-[rgba(51,240,183,0.8)] hover:text-white transition-colors rounded">Files</button><button onClick={() => document.getElementById('folder-input')?.click()} className="bg-[rgba(91,124,255,0.12)] text-primary-100 text-[11px] px-3 py-1.5 font-mono border border-[rgba(91,124,255,0.35)] hover:border-[rgba(51,240,183,0.8)] hover:text-white transition-colors rounded">Folder</button></div><div className="text-[11px] text-primary-40 font-mono mt-3">Must include SKILL.md</div></>) : (<><div className="text-sm text-white font-display">{uploadFiles.length} file{uploadFiles.length !== 1 ? 's' : ''} staged</div><button onClick={() => { setUploadFiles([]); setUploadName('') }} className="text-[11px] text-primary-40 font-mono hover:text-eva-orange mt-2 transition-colors">Clear</button></>)}
        </div>
        {uploadFiles.length > 0 && (
          <div className="mt-[var(--space-md)] space-y-3">
            <input type="text" value={uploadName} onChange={(e) => setUploadName(e.target.value)} placeholder="claw-skill-name" className="w-full bg-[rgba(5,12,32,0.7)] border border-[rgba(91,124,255,0.28)] focus:border-[rgba(51,240,183,0.8)] outline-none text-primary-100 placeholder:text-primary-40 text-xs px-3 py-2 font-mono rounded" />
            <button onClick={handleUpload} disabled={importLoading} className="w-full bg-[rgba(51,240,183,0.18)] text-white text-sm py-3 font-mono uppercase tracking-[2px] border border-[rgba(51,240,183,0.55)] hover:bg-[rgba(51,240,183,0.28)] transition-colors disabled:opacity-50 rounded">{importLoading ? 'Recruiting…' : 'Add to Fleet'}</button>
          </div>
        )}
        </>}
      </div>
    </div>
  )
}
