'use client'

import { useEffect } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="relative w-full max-w-sm mx-4 rounded-lg border border-[rgba(228,236,255,0.14)] bg-[rgba(5,12,32,0.95)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <h3 className="font-display text-sm text-white leading-tight">{title}</h3>
          <p className="text-[11px] font-mono text-primary-40 mt-2 leading-relaxed">{message}</p>
        </div>
        <div className="flex gap-2 px-5 pb-5 pt-1">
          <button
            onClick={onCancel}
            className="flex-1 text-[10px] font-mono uppercase tracking-[1px] px-3 py-2 rounded border border-[rgba(228,236,255,0.14)] text-primary-50 hover:text-primary-100 hover:border-[rgba(228,236,255,0.28)] transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 text-[10px] font-mono uppercase tracking-[1px] px-3 py-2 rounded border transition-colors ${
              destructive
                ? 'border-eva-red/40 text-eva-red hover:bg-eva-red/10 hover:border-eva-red/70'
                : 'border-eva-green/40 text-eva-green hover:bg-eva-green/10 hover:border-eva-green/70'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
