import { NextResponse } from 'next/server'
import { createFile, getFileContent, updateFile, fileExists } from '@/lib/github'
import { addSkillToConfig, updateSkillInConfig } from '@/lib/config'
import { synthesizeSpec, renderSkillMd, type AutoSpec } from '@/lib/auto-spec'

interface RecruitBody {
  brief?: string
  model?: string
  preview?: boolean   // when true, return the spec without writing anything
}

export async function POST(request: Request) {
  let body: RecruitBody = {}
  try {
    body = (await request.json()) as RecruitBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const brief = (body.brief || '').trim()
  if (!brief) return NextResponse.json({ error: 'Brief is required.' }, { status: 400 })

  let spec: AutoSpec
  try {
    spec = await synthesizeSpec({ brief, model: body.model })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Synthesis failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Make sure we don't clobber an existing skill — append a numeric suffix if needed.
  let finalName = spec.name
  for (let i = 2; i < 50; i++) {
    if (!(await fileExists(`skills/${finalName}/SKILL.md`))) break
    finalName = `${spec.name}-${i}`
  }
  spec.name = finalName

  if (body.preview) {
    return NextResponse.json({ ok: true, spec, preview: true })
  }

  // Write SKILL.md
  const skillMd = renderSkillMd(spec)
  try {
    await createFile(
      `skills/${spec.name}/SKILL.md`,
      skillMd,
      `feat: recruit ${spec.name} via auto-spec`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to write SKILL.md'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // Register in claw.yml: add as disabled by default with the inferred schedule, then patch var.
  try {
    const config = await getFileContent('claw.yml')
    let updated = addSkillToConfig(config.content, spec.name, {
      enabled: false,
      schedule: spec.schedule,
    })
    if (spec.var) {
      updated = updateSkillInConfig(updated, spec.name, { var: spec.var })
    }
    if (updated !== config.content) {
      await updateFile('claw.yml', updated, config.sha, `chore: register ${spec.name}`)
    }
  } catch {
    // Config update is best-effort: the skill file was still created.
  }

  return NextResponse.json({
    ok: true,
    name: spec.name,
    description: spec.description,
    schedule: spec.schedule,
    var: spec.var,
    tags: spec.tags,
    summary: spec.summary,
  })
}
