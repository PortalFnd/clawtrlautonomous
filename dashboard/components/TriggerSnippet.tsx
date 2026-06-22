'use client'

import { useEffect, useState } from 'react'

interface TriggersInfo {
  repo: string
  githubApi: string
  workerUrl: string
  proxyDeployed: boolean
  docsUrl: string
}

interface TriggerSnippetProps {
  skill: string
}

const labelCls = 'text-[10px] font-mono uppercase tracking-[0.18em] text-primary-40'
const cardCls = 'bg-[rgba(5,12,32,0.55)] border border-[rgba(228,236,255,0.10)] rounded'

export function TriggerSnippet({ skill }: TriggerSnippetProps) {
  const [info, setInfo] = useState<TriggersInfo | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/triggers')
      .then(r => r.json())
      .then(setInfo)
      .catch(() => setInfo(null))
  }, [])

  if (!info || !info.repo) return null

  const snippet = info.proxyDeployed
    ? [
        `curl -X POST ${info.workerUrl}/trigger/${skill} \\`,
        `  -H "X-Signature: sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$WEBHOOK_HMAC_SECRET" -hex | cut -d' ' -f2)" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d "$BODY"`,
      ].join('\n')
    : [
        `curl -X POST ${info.githubApi} \\`,
        `  -H "Authorization: Bearer $GITHUB_PAT" \\`,
        `  -H "Accept: application/vnd.github+json" \\`,
        `  -d '{"event_type":"trigger-${skill}","client_payload":{"var":"hello"}}'`,
      ].join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-2 px-1">
        <span className={labelCls}>Inbound trigger</span>
        <a
          href={info.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[10px] font-mono text-primary-40 hover:text-primary-100 transition-colors"
        >
          docs ↗
        </a>
      </div>
      <div className={`${cardCls} p-3 space-y-2`}>
        <div className="text-[10px] font-mono text-primary-40 leading-relaxed">
          {info.proxyDeployed
            ? <>HMAC-protected via <code className="text-eva-green">webhook-proxy</code>. Set <code>BODY</code> and <code>WEBHOOK_HMAC_SECRET</code> in your caller&apos;s env.</>
            : <>Direct GitHub <code className="text-eva-orange">repository_dispatch</code>. PAT needs <code>repo</code> + <code>workflow</code> scopes. Deploy <code>workers/webhook-proxy.ts</code> for HMAC-protected URLs.</>}
        </div>
        <pre className="text-[10.5px] font-mono text-primary-100 bg-[rgba(0,0,0,0.35)] rounded p-2 overflow-x-auto whitespace-pre">
{snippet}
        </pre>
        <div className="flex justify-end">
          <button
            onClick={copy}
            className="text-[10px] font-mono text-eva-green hover:text-primary-100 transition-colors"
          >
            {copied ? 'copied ✓' : 'copy'}
          </button>
        </div>
      </div>
    </section>
  )
}
