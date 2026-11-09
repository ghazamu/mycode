import { expect, mock, test } from 'claude-code/testing'

import { format } from '../hooks/lib/envelope'

// Nothing sits beneath the plugin: each hook here stands for the engine.
function engine(on: any, sent: { to: unknown; text: string }[]) {
  mock.clock(on, { now: 1_700_000_000_000 })
  mock.env(on, {})
  on('command.register', () => ({ value: { command: 'x' } }))
  on('tool.register', (_: unknown, e: { name: string }) => ({ value: { tool: `mcp__devbus__${e.name}` } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.status', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }))
  on('session.root', () => ({ value: '/repo' }))
  on('fs.exists', () => ({ value: false }))
  on('session.start', (_: unknown, e: { cwd: string }) => ({ cwd: e.cwd }))
  on('session.send', (_: unknown, e: { to: unknown; text: string }) => {
    sent.push({ to: e.to, text: e.text })
    return { isDelivered: true }
  })
  on('session.receive', (_: unknown, e: { text: string }) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ran' }))
}

async function start($: any) {
  await $.session.start({ cwd: '/repo', surface: 'desktop', isInteractive: true })
}

const roster = (to: string) =>
  format({
    id: 'r1',
    type: 'ROSTER',
    from: 'lead',
    to,
    task: '-',
    pr: '-',
    sha: '-',
    reply: '-',
    extra: {},
    summary: JSON.stringify([
      { role: 'lead', sessionId: 'session_LEAD' },
      { role: to, sessionId: 'session_ME' },
    ]),
  })

test('a ROSTER sets the role and never reaches the model', async ($, on) => {
  const sent: { to: unknown; text: string }[] = []
  engine(on, sent)
  await start($)

  const got = await $.session.receive({ origin: { kind: 'peer' }, text: roster('qa') })
  expect(got.consumed).toMatch(/ROSTER/)

  const board = await $.tool.call({ tool: 'mcp__devbus__bus_board' } as any)
  expect(String(board.result)).toMatch(/role: qa/)
})

test('a TASK is shortened for the model and ACKed by the mod', async ($, on) => {
  const sent: { to: unknown; text: string }[] = []
  engine(on, sent)
  await start($)
  await $.session.receive({ origin: { kind: 'peer' }, text: roster('dev-core') })

  const task = format({
    id: 't1',
    type: 'TASK',
    from: 'lead',
    to: 'dev-core',
    task: '#12',
    pr: '-',
    sha: '-',
    reply: '-',
    extra: { kind: 'dev', budget: '550000' },
    summary: 'type:dev + lane:core. #12 Add login endpoint',
  })
  const got = await $.session.receive({ origin: { kind: 'peer' }, text: task })
  expect(got.text).toBe(
    '[bus] TASK from lead · task #12 · kind dev · budget 550000 (id t1)\ntype:dev + lane:core. #12 Add login endpoint',
  )
  const ack = sent.find(s => s.text.includes('type=ACK'))
  expect(ack?.text).toMatch(/reply=t1/)
  // The engine spells a plugin's { sessionId } as the bare id.
  expect(ack?.to).toBe('session_LEAD')

  // The same delivery twice is dropped.
  const again = await $.session.receive({ origin: { kind: 'peer' }, text: task })
  expect(again.consumed).toMatch(/duplicate/)
})

test('HEARTBEAT is consumed', async ($, on) => {
  engine(on, [])
  await start($)
  const hb = format({
    id: 'h1',
    type: 'HEARTBEAT',
    from: 'qa',
    to: 'lead',
    task: '-',
    pr: '-',
    sha: '-',
    reply: '-',
    extra: {},
    summary: '',
  })
  const got = await $.session.receive({ origin: { kind: 'peer' }, text: hb })
  expect(got.consumed).toMatch(/HEARTBEAT/)
})

test('bus_send refuses a pasted wall of text and sends a valid message', async ($, on) => {
  const sent: { to: unknown; text: string }[] = []
  engine(on, sent)
  await start($)
  await $.session.receive({ origin: { kind: 'peer' }, text: roster('dev-core') })

  const long = await $.tool.call({
    tool: 'mcp__devbus__bus_send',
    to: 'lead',
    type: 'BLOCKED',
    summary: 'x'.repeat(700),
  } as any)
  expect(String(long.result)).toMatch(/limit is 600/)

  const ok = await $.tool.call({
    tool: 'mcp__devbus__bus_send',
    to: 'lead',
    type: 'BLOCKED',
    task: '12',
    summary: 'Schema for users unclear: A) add email column B) separate table. Recommend A.',
  } as any)
  expect(String(ok.result)).toMatch(/Sent BLOCKED to lead/)
  expect(sent.at(-1)?.text).toMatch(/^\[DEVBUS\/1\] id=\S+ type=BLOCKED from=dev-core to=lead task=#12/)
})

test('the model\'s raw SendMessage without an envelope is refused', async ($, on) => {
  engine(on, [])
  await start($)
  const got = await $.session.send({ to: 'qa', text: 'hey can you look at my PR', origin: { kind: 'model' } } as any)
  expect(got.isDelivered).toBe(false)
})

test('merging is denied for every role', async ($, on) => {
  engine(on, [])
  await start($)
  const got = await $.tool.call({ tool: 'mcp__github__merge_pull_request', pullNumber: 4 } as any)
  expect(String(got.deny)).toMatch(/never merge/)
})

test('the board pane draws on every surface', async ($, on) => {
  engine(on, [])
  await start($)
  for (const surface of ['terminal', 'desktop', 'vscode', 'mobile'] as const) {
    const ui = await $.ui.mount({
      plugin: 'devbus',
      component: 'Pane',
      requestId: 'devbus-board',
      surface,
      props: {
        title: 'DevBus',
        isFocused: false,
        bodyColumns: 60,
        placement: 'dock',
        scroll: { offset: 0, bodyRows: 20 },
        view: {},
      },
    })
    expect((await ui.find({ type: 'Text', text: /DevBus/ }))?.text).toBe('DevBus · unassigned')
    await ui.unmount()
  }
})
