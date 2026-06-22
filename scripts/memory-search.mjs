#!/usr/bin/env node
/**
 * memory-search.mjs — semantic search across articles/.
 *
 * Usage:
 *   node scripts/memory-search.mjs "your query"           # top 5 (default)
 *   node scripts/memory-search.mjs "your query" --k 10    # top 10
 *   node scripts/memory-search.mjs "your query" --json    # machine-readable
 *
 * Reads memory/articles-index.json (produced by memory-index.mjs).
 * Outputs top-K matches with cosine similarity + snippet.
 *
 * Any Claw can call this as `node scripts/memory-search.mjs "..."` to ground
 * its reasoning in past articles.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

const INDEX_PATH = join(process.cwd(), 'memory', 'articles-index.json')

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : fallback
}

const query = process.argv.slice(2).filter(a => !a.startsWith('--'))[0]
if (!query) {
  console.error('usage: memory-search.mjs "query" [--k 5] [--json]')
  process.exit(1)
}
const k = Number(arg('k', 5))
const asJson = process.argv.includes('--json')

const OPENAI = process.env.OPENAI_API_KEY
const VOYAGE = process.env.VOYAGE_API_KEY
if (!OPENAI && !VOYAGE) {
  console.error('memory-search: set OPENAI_API_KEY or VOYAGE_API_KEY')
  process.exit(1)
}

async function embedOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${OPENAI}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

async function embedVoyage(text) {
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${VOYAGE}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3-lite', input: text, input_type: 'query' }),
  })
  if (!res.ok) throw new Error(`Voyage ${res.status}: ${await res.text()}`)
  return (await res.json()).data[0].embedding
}

const embed = OPENAI ? embedOpenAI : embedVoyage

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i] }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

async function main() {
  let index
  try { index = JSON.parse(await readFile(INDEX_PATH, 'utf8')) }
  catch {
    console.error('memory-search: no index. Run `node scripts/memory-index.mjs` first.')
    process.exit(1)
  }

  const queryEmbedding = await embed(query)
  const scored = index.entries
    .map(e => ({ path: e.path, score: cosine(queryEmbedding, e.embedding), snippet: e.snippet }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)

  if (asJson) {
    console.log(JSON.stringify({ query, results: scored }, null, 2))
    return
  }

  console.log(`# top ${scored.length} for "${query}"\n`)
  for (const r of scored) {
    console.log(`## ${r.path}  (${r.score.toFixed(3)})`)
    console.log(r.snippet)
    console.log()
  }
}

main().catch(err => { console.error(err); process.exit(1) })
