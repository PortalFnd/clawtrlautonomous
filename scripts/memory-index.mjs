#!/usr/bin/env node
/**
 * memory-index.mjs — embed every article into a single JSON index.
 *
 * Usage:
 *   node scripts/memory-index.mjs            # incremental (only new/changed)
 *   node scripts/memory-index.mjs --full     # re-embed everything
 *
 * Env:
 *   OPENAI_API_KEY     preferred; uses text-embedding-3-small (1536-dim, ~$0.02/M tokens)
 *   VOYAGE_API_KEY     fallback; uses voyage-3-lite
 *
 * Output:
 *   memory/articles-index.json  — { model, dim, entries: [{ path, sha, mtime, embedding[], snippet }] }
 *
 * Design: a flat JSON file is fast enough for ~10k articles, commits cleanly,
 * and avoids native deps. Cosine search lives in memory-search.mjs.
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const ROOT = process.cwd()
const ARTICLES_DIR = join(ROOT, 'articles')
const INDEX_PATH = join(ROOT, 'memory', 'articles-index.json')
const FULL = process.argv.includes('--full')

const OPENAI = process.env.OPENAI_API_KEY
const VOYAGE = process.env.VOYAGE_API_KEY
if (!OPENAI && !VOYAGE) {
  console.error('memory-index: set OPENAI_API_KEY or VOYAGE_API_KEY')
  process.exit(1)
}

const MODEL = OPENAI ? 'text-embedding-3-small' : 'voyage-3-lite'
const DIM = OPENAI ? 1536 : 512
const MAX_CHARS = 8000 // ~2k tokens, fits comfortably in any embedding model
const BATCH = 16

async function readExisting() {
  try { return JSON.parse(await readFile(INDEX_PATH, 'utf8')) }
  catch { return { model: MODEL, dim: DIM, entries: [] } }
}

async function listArticles() {
  let names
  try { names = await readdir(ARTICLES_DIR) }
  catch { return [] }
  const out = []
  for (const name of names) {
    if (!name.endsWith('.md')) continue
    const path = join('articles', name)
    const abs = join(ROOT, path)
    const s = await stat(abs)
    if (!s.isFile()) continue
    out.push({ path, mtime: s.mtimeMs })
  }
  return out
}

function sha1(s) {
  return createHash('sha1').update(s).digest('hex').slice(0, 16)
}

function snippet(body) {
  // First non-empty paragraph after frontmatter, capped.
  const stripped = body.replace(/^---[\s\S]*?\n---\s*\n?/, '')
  for (const para of stripped.split(/\n\s*\n/)) {
    const t = para.trim().replace(/\s+/g, ' ')
    if (t.length >= 40) return t.slice(0, 280)
  }
  return stripped.trim().slice(0, 280)
}

async function embedOpenAI(inputs) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${OPENAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: inputs }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.data.map(d => d.embedding)
}

async function embedVoyage(inputs) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${VOYAGE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input: inputs, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.data.map(d => d.embedding)
}

const embed = OPENAI ? embedOpenAI : embedVoyage

async function main() {
  const existing = FULL ? { model: MODEL, dim: DIM, entries: [] } : await readExisting()
  if (existing.model !== MODEL) {
    console.error(`memory-index: index model is ${existing.model}, current is ${MODEL}. Re-run with --full to switch.`)
    process.exit(1)
  }

  const known = new Map(existing.entries.map(e => [e.path, e]))
  const live = await listArticles()
  const livePaths = new Set(live.map(l => l.path))

  // Detect changes.
  const todo = []
  const keep = []
  for (const { path, mtime } of live) {
    const body = await readFile(join(ROOT, path), 'utf8')
    const sha = sha1(body)
    const prev = known.get(path)
    if (prev && prev.sha === sha) {
      keep.push({ ...prev, mtime })
    } else {
      todo.push({ path, mtime, sha, body })
    }
  }

  // Embed in batches.
  const fresh = []
  for (let i = 0; i < todo.length; i += BATCH) {
    const slice = todo.slice(i, i + BATCH)
    const inputs = slice.map(t => t.body.slice(0, MAX_CHARS))
    const vecs = await embed(inputs)
    for (let j = 0; j < slice.length; j++) {
      const t = slice[j]
      fresh.push({
        path: t.path,
        sha: t.sha,
        mtime: t.mtime,
        embedding: vecs[j],
        snippet: snippet(t.body),
      })
    }
    process.stderr.write(`memory-index: embedded ${Math.min(i + BATCH, todo.length)}/${todo.length}\n`)
  }

  const all = [...keep, ...fresh].filter(e => livePaths.has(e.path))
  all.sort((a, b) => a.path.localeCompare(b.path))

  await mkdir(join(ROOT, 'memory'), { recursive: true })
  await writeFile(INDEX_PATH, JSON.stringify({ model: MODEL, dim: DIM, updated: new Date().toISOString(), entries: all }))

  console.log(`memory-index: ${all.length} entries (+${fresh.length} fresh, -${known.size - keep.length} removed) → ${INDEX_PATH}`)
}

main().catch(err => { console.error(err); process.exit(1) })
