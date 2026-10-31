import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import type { EvalCategory } from './fixtures/cases.ts'

export interface CaseReport {
  id: string
  category: EvalCategory
  shopId: string
  pass: boolean
  reasons: string[]
  latencyMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  toolCalls: string[]
  transcript: { role: string; text: string }[]
}

export interface EvalReport {
  startedAt: string
  provider: string
  model: string
  judge: boolean
  live: boolean
  summary: {
    total: number
    passed: number
    passRate: number
    promptTokens: number
    completionTokens: number
    latencyMs: number
    byCategory: Record<string, { passed: number; total: number; passRate: number }>
  }
  cases: CaseReport[]
}

export function buildReport(input: {
  provider: string
  model: string
  judge: boolean
  cases: CaseReport[]
}): EvalReport {
  const byCategory: EvalReport['summary']['byCategory'] = {}
  for (const item of input.cases) {
    const bucket = byCategory[item.category] || { passed: 0, total: 0, passRate: 0 }
    bucket.total += 1
    if (item.pass) bucket.passed += 1
    byCategory[item.category] = bucket
  }
  for (const bucket of Object.values(byCategory)) {
    bucket.passRate = bucket.total === 0 ? 0 : Number((bucket.passed / bucket.total).toFixed(4))
  }
  const passed = input.cases.filter((item) => item.pass).length
  return {
    startedAt: new Date().toISOString(),
    provider: input.provider,
    model: input.model,
    judge: input.judge,
    live: true,
    summary: {
      total: input.cases.length,
      passed,
      passRate: input.cases.length === 0 ? 0 : Number((passed / input.cases.length).toFixed(4)),
      promptTokens: input.cases.reduce((sum, item) => sum + item.promptTokens, 0),
      completionTokens: input.cases.reduce((sum, item) => sum + item.completionTokens, 0),
      latencyMs: input.cases.reduce((sum, item) => sum + item.latencyMs, 0),
      byCategory,
    },
    cases: input.cases,
  }
}

export function reportMarkdown(report: EvalReport): string {
  const lines = [
    '# DealMee Thai sales-agent eval',
    '',
    `Provider \`${report.provider}\`, model \`${report.model}\`, judge ${report.judge ? 'on' : 'off'}.`,
    `Pass rate **${report.summary.passed}/${report.summary.total}** (${Math.round(report.summary.passRate * 100)}%).`,
    `Tokens in ${report.summary.promptTokens}, out ${report.summary.completionTokens}. Latency ${report.summary.latencyMs} ms.`,
    '',
    '| Category | Passed | Total | Pass rate |',
    '| --- | ---: | ---: | ---: |',
  ]
  for (const [category, bucket] of Object.entries(report.summary.byCategory)) {
    lines.push(`| ${category} | ${bucket.passed} | ${bucket.total} | ${Math.round(bucket.passRate * 100)}% |`)
  }
  const failures = report.cases.filter((item) => !item.pass)
  lines.push('', `## Failures (${failures.length})`, '')
  if (failures.length === 0) lines.push('None.')
  for (const failure of failures) {
    lines.push(`### ${failure.id} (${failure.category})`, '')
    lines.push(failure.reasons.map((reason) => `- ${reason}`).join('\n') || '- failed')
    lines.push('', 'Transcript:', '')
    for (const turn of failure.transcript) {
      lines.push(`- **${turn.role}:** ${turn.text.replace(/\n/g, ' ')}`)
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function writeReport(report: EvalReport, directory: string): { jsonPath: string; markdownPath: string } {
  mkdirSync(directory, { recursive: true })
  const stamp = report.startedAt.replace(/[:.]/g, '-')
  const jsonPath = path.join(directory, `eval-${stamp}.json`)
  const markdownPath = path.join(directory, `eval-${stamp}.md`)
  writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  writeFileSync(markdownPath, reportMarkdown(report))
  writeFileSync(path.join(directory, 'latest.json'), JSON.stringify(report, null, 2))
  writeFileSync(path.join(directory, 'latest.md'), reportMarkdown(report))
  return { jsonPath, markdownPath }
}
