import { describe, expect, test } from 'claude-code/testing'

import { format, newId, normalize, parse, ref, scrubSecrets, validate } from '../hooks/lib/envelope'
import type { Envelope } from '../hooks/lib/envelope'
import {
  DEFAULT_CONFIG,
  batch,
  budgetLevel,
  globToRegExp,
  guard,
  relativePath,
  route,
  setScopes,
  totalTokens,
  usageReport,
} from '../hooks/lib/policy'

const base: Envelope = {
  id: 'abc123',
  type: 'REVIEW_REQ',
  from: 'dev-core',
  to: 'qa',
  task: '#12',
  pr: '#40',
  sha: '1a2b3c',
  reply: '-',
  extra: { kind: 'dev' },
  summary: 'PR #40 ready: CI green, self-reviewed.',
}

describe('envelope', () => {
  test('formats and parses back to the same envelope', async () => {
    expect(parse(format(base))).toEqual(base)
  })

  test('finds an envelope inside a wrapped delivery', async () => {
    const wrapped = `<peer from="x">\n${format(base)}\n</peer>`
    expect(parse(wrapped)?.id).toBe('abc123')
  })

  test('rejects text that is not an envelope', async () => {
    expect(parse('hello there')).toBe(null)
    expect(parse('[DEVBUS/1] id=1 type=NOPE from=a to=b')).toBe(null)
  })

  test('caps the summary and refuses code blocks', async () => {
    expect(validate({ ...base, summary: 'x'.repeat(601) }, 600)).toMatch(/limit is 600/)
    expect(validate({ ...base, summary: 'see ```py\nx\n```' }, 600)).toMatch(/code block/)
    expect(validate(base, 600)).toBe(undefined)
    expect(validate({ ...base, type: 'ROSTER', summary: 'x'.repeat(2000) }, 600)).toBe(undefined)
  })

  test('normalises to a short line for the model', async () => {
    expect(normalize(base)).toBe(
      '[bus] REVIEW_REQ from dev-core · task #12 · pr #40 · sha 1a2b3c · kind dev (id abc123)\nPR #40 ready: CI green, self-reviewed.',
    )
  })

  test('refs gain a hash, dashes stay', async () => {
    expect(ref('12')).toBe('#12')
    expect(ref('#12,13')).toBe('#12,#13')
    expect(ref(undefined)).toBe('-')
    expect(ref('-')).toBe('-')
  })

  test('ids are short and distinct', async () => {
    expect(newId(1000, () => 0.1)).not.toBe(newId(1000, () => 0.2))
  })

  test('redacts credentials', async () => {
    const out = scrubSecrets('token=abcdef123456 and ghp_abcdefghijklmnopqrstuvwxyz0123')
    expect(out.redactions).toBe(2)
    expect(out.text).toBe('token=[redacted] and [redacted]')
  })
})

describe('routing', () => {
  const issue = (number: number, labels: string[]) => ({ number, title: `issue ${number}`, labels })

  test('routes by type, size and lane', async () => {
    expect(route(issue(1, ['type:design']), DEFAULT_CONFIG).role).toBe('lead')
    expect(route(issue(2, ['type:docs']), DEFAULT_CONFIG).role).toBe('ops')
    expect(route(issue(3, ['type:test']), DEFAULT_CONFIG).role).toBe('qa')
    expect(route(issue(4, ['type:audit']), DEFAULT_CONFIG).role).toBe('qa')
    expect(route(issue(5, ['type:audit', 'review:opus']), DEFAULT_CONFIG).role).toBe('lead')
    expect(route(issue(6, ['type:dev', 'size:S']), DEFAULT_CONFIG).role).toBe('dev-utility')
    expect(route(issue(7, ['type:dev', 'size:M', 'lane:core']), DEFAULT_CONFIG).role).toBe('dev-core')
    expect(route(issue(8, ['type:dev', 'size:L', 'lane:edge']), DEFAULT_CONFIG).role).toBe('dev-edge')
  })

  test('unlabelled or lane-less work goes to the Lead for labelling only', async () => {
    const none = route(issue(9, []), DEFAULT_CONFIG)
    expect(none.kind).toBe('label')
    expect(none.budget).toBe(10000)
    expect(route(issue(10, ['type:dev', 'size:M']), DEFAULT_CONFIG).kind).toBe('label')
  })

  test('budgets follow size and type', async () => {
    expect(route(issue(11, ['type:dev', 'size:S']), DEFAULT_CONFIG).budget).toBe(300000)
    expect(route(issue(12, ['type:dev', 'size:L', 'lane:core']), DEFAULT_CONFIG).budget).toBe(1400000)
    expect(route(issue(13, ['type:design']), DEFAULT_CONFIG).budget).toBe(500000)
  })

  test('batches small dev work by area, up to the cap', async () => {
    const routed = [1, 2, 3, 4, 5].map(n => {
      const i = issue(n, ['type:dev', 'size:S', n <= 3 ? 'area:api' : 'area:cli'])
      return { issue: i, route: route(i, DEFAULT_CONFIG) }
    })
    const design = issue(6, ['type:design'])
    const tasks = batch([...routed, { issue: design, route: route(design, DEFAULT_CONFIG) }], 2)
    const small = tasks.filter(t => t.kind === 'dev-small').map(t => t.issues.map(i => i.number))
    expect(small).toEqual([[1, 2], [3], [4, 5]])
    expect(tasks.filter(t => t.role === 'lead').length).toBe(1)
  })
})

describe('guards', () => {
  setScopes(DEFAULT_CONFIG)
  const ask = (role: any, tool: string, args: Record<string, unknown>, extra: object = {}) =>
    guard({ role, tool, args, root: '/repo', approvedReleases: [], overBudget: false, ...extra })

  test('nobody merges, force-pushes or pushes to main', async () => {
    expect(ask('lead', 'mcp__github__merge_pull_request', {})).toHaveProperty('deny')
    expect(ask('dev-core', 'Bash', { command: 'git push --force origin feat/1' })).toHaveProperty('deny')
    expect(ask('dev-core', 'Bash', { command: 'git push origin HEAD:main' })).toHaveProperty('deny')
    expect(ask('dev-core', 'Bash', { command: 'gh pr merge 4' })).toHaveProperty('deny')
    expect(ask('dev-core', 'Bash', { command: 'git push -u origin feat/12-login' })).toBe(undefined)
  })

  test('releases need Ops and the person\'s approval', async () => {
    expect(ask('dev-core', 'Bash', { command: 'git tag v1.2.0' })).toHaveProperty('deny')
    expect(ask('ops', 'Bash', { command: 'git tag -a v1.2.0 -m "x"' })).toHaveProperty('deny')
    expect(ask('ops', 'Bash', { command: 'git tag v1.2.0' }, { approvedReleases: ['v1.2.0'] })).toBe(undefined)
  })

  test('only the Lead manages sessions', async () => {
    expect(ask('qa', 'mcp__claude-code-remote__create_session', {})).toHaveProperty('deny')
    expect(ask('lead', 'mcp__claude-code-remote__create_session', {})).toBe(undefined)
  })

  test('write scopes per role', async () => {
    expect(ask('ops', 'Edit', { file_path: '/repo/src/app.py' })).toHaveProperty('deny')
    expect(ask('ops', 'Edit', { file_path: '/repo/docs/guide.md' })).toBe(undefined)
    expect(ask('qa', 'Write', { file_path: '/repo/tests/test_api.py' })).toBe(undefined)
    expect(ask('qa', 'Write', { file_path: '/repo/flaskapi/myflask01.py' })).toHaveProperty('deny')
    expect(ask('dev-core', 'Edit', { file_path: '/repo/anything.py' })).toBe(undefined)
  })

  test('lanes warn rather than deny', async () => {
    setScopes({ ...DEFAULT_CONFIG, lanePaths: { core: ['flaskapi/**'], edge: [] } })
    expect(ask('dev-core', 'Edit', { file_path: '/repo/marvel/charc.py' })).toHaveProperty('warn')
    expect(ask('dev-core', 'Edit', { file_path: '/repo/flaskapi/myflask01.py' })).toBe(undefined)
    setScopes(DEFAULT_CONFIG)
  })

  test('an over-budget session may only use the bus', async () => {
    expect(ask('dev-core', 'Bash', { command: 'ls' }, { overBudget: true })).toHaveProperty('deny')
    expect(ask('dev-core', 'mcp__devbus__bus_send', {}, { overBudget: true })).toBe(undefined)
  })
})

describe('helpers', () => {
  test('globs', async () => {
    expect(globToRegExp('docs/**').test('docs/a/b.md')).toBe(true)
    expect(globToRegExp('**/test_*.py').test('test_x.py')).toBe(true)
    expect(globToRegExp('**/test_*.py').test('a/b/test_x.py')).toBe(true)
    expect(globToRegExp('*.md').test('a/b.md')).toBe(false)
  })

  test('relative paths', async () => {
    expect(relativePath('/repo/docs/x.md', '/repo')).toBe('docs/x.md')
    expect(relativePath('docs/x.md', '/repo')).toBe('docs/x.md')
  })

  test('usage totals and levels', async () => {
    const t = totalTokens({ input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 80, cache_creation_input_tokens: 5 })
    expect(t).toBe(100)
    expect(budgetLevel(79, 100, 0.8)).toBe('ok')
    expect(budgetLevel(80, 100, 0.8)).toBe('warn')
    expect(budgetLevel(100, 100, 0.8)).toBe('over')
  })

  test('usage report compares against the baseline', async () => {
    const report = usageReport(
      [
        { task: '#1', kind: 'dev', role: 'dev-core', model: '', tokens: 400000, at: 0 },
        { task: '#2', kind: 'dev', role: 'dev-core', model: '', tokens: 500000, at: 0 },
      ],
      450000,
    )
    expect(report).toMatch(/dev\s+2\s+450k\s+1\.00x/)
  })
})
