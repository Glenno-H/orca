import { describe, expect, it } from 'vitest'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import {
  buildWorktreeChatItems,
  excludeChatAgentRows,
  type WorktreeChatListInput
} from './worktree-chat-list-model'

function unifiedTab(overrides: Partial<Tab> & Pick<Tab, 'id' | 'entityId'>): Tab {
  return {
    groupId: 'g1',
    worktreeId: 'wt',
    contentType: 'terminal',
    label: overrides.id,
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 0,
    ...overrides
  }
}

function terminalTab(overrides: Partial<TerminalTab> & Pick<TerminalTab, 'id'>): TerminalTab {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture carries only the fields under test.
  return { worktreeId: 'wt', title: 'zsh', customTitle: null, ...overrides } as TerminalTab
}

function agentRow(
  tabId: string,
  overrides: Partial<Pick<DashboardAgentRow, 'agentType' | 'state' | 'rowSource'>> = {}
): DashboardAgentRow {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test fixture carries only the fields under test.
  return {
    paneKey: `${tabId}:leaf`,
    tab: { id: tabId },
    agentType: 'claude',
    rowSource: 'live',
    state: 'working',
    startedAt: 0,
    entry: { state: overrides.state ?? 'working' },
    ...overrides
  } as unknown as DashboardAgentRow
}

function group(id: string, tabOrder: string[], activeTabId: string | null = null): TabGroup {
  return { id, worktreeId: 'wt', activeTabId, tabOrder }
}

function input(overrides: Partial<WorktreeChatListInput>): WorktreeChatListInput {
  return {
    tabs: [],
    groups: [group('g1', [])],
    terminalTabs: [],
    agentRows: [],
    isActiveWorktree: true,
    activeGroupId: 'g1',
    generatedTitlesEnabled: false,
    ...overrides
  }
}

describe('buildWorktreeChatItems', () => {
  it('keeps agent terminals and native chats and drops shells, editors and browsers', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({ id: 'u-shell', entityId: 't-shell' }),
          unifiedTab({ id: 'u-launched', entityId: 't-launched' }),
          unifiedTab({ id: 'u-running', entityId: 't-running' }),
          unifiedTab({ id: 'u-chat', entityId: 'session-1', contentType: 'agent-session' }),
          unifiedTab({ id: 'u-file', entityId: '/a.ts', contentType: 'editor' }),
          unifiedTab({ id: 'u-web', entityId: 'b1', contentType: 'browser' })
        ],
        groups: [group('g1', ['u-shell', 'u-launched', 'u-running', 'u-chat', 'u-file', 'u-web'])],
        terminalTabs: [
          terminalTab({ id: 't-shell' }),
          terminalTab({ id: 't-launched', launchAgent: 'codex' }),
          terminalTab({ id: 't-running' })
        ],
        agentRows: [agentRow('t-running')]
      })
    )
    expect(items.map((item) => [item.tabId, item.kind])).toEqual([
      ['u-launched', 'terminal'],
      ['u-running', 'terminal'],
      ['u-chat', 'agent-session']
    ])
  })

  it('orders by group order then tabOrder, appending tabs missing from tabOrder by sortOrder', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({ id: 'a', entityId: 'ta', groupId: 'g2', contentType: 'agent-session' }),
          unifiedTab({ id: 'b', entityId: 'tb', groupId: 'g1', contentType: 'agent-session' }),
          unifiedTab({
            id: 'c',
            entityId: 'tc',
            groupId: 'g1',
            contentType: 'agent-session',
            sortOrder: 5
          }),
          unifiedTab({
            id: 'd',
            entityId: 'td',
            groupId: 'g1',
            contentType: 'agent-session',
            sortOrder: 2
          })
        ],
        groups: [group('g1', ['b']), group('g2', ['a'])]
      })
    )
    expect(items.map((item) => item.tabId)).toEqual(['b', 'd', 'c', 'a'])
  })

  it('marks only the active group active tab of the active workspace as selected', () => {
    const tabs = [
      unifiedTab({ id: 'a', entityId: 'sa', contentType: 'agent-session' }),
      unifiedTab({ id: 'b', entityId: 'sb', contentType: 'agent-session' }),
      unifiedTab({ id: 'c', entityId: 'sc', groupId: 'g2', contentType: 'agent-session' })
    ]
    const groups = [group('g1', ['a', 'b'], 'b'), group('g2', ['c'], 'c')]
    const selected = (overrides: Partial<WorktreeChatListInput>): string[] =>
      buildWorktreeChatItems(input({ tabs, groups, ...overrides }))
        .filter((item) => item.isSelected)
        .map((item) => item.tabId)

    expect(selected({})).toEqual(['b'])
    expect(selected({ activeGroupId: 'g2' })).toEqual(['c'])
    expect(selected({ activeGroupId: undefined })).toEqual(['b'])
    expect(selected({ isActiveWorktree: false })).toEqual([])
  })

  it('resolves terminal titles like the tab strip and prefers a custom title', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({ id: 'u1', entityId: 't1', label: 'fallback' }),
          unifiedTab({ id: 'u2', entityId: 't2', label: 'fallback' })
        ],
        groups: [group('g1', ['u1', 'u2'])],
        terminalTabs: [
          terminalTab({ id: 't1', launchAgent: 'claude', title: '✳ Fix login bug' }),
          terminalTab({ id: 't2', launchAgent: 'claude', title: 'ignored', customTitle: 'Mine' })
        ]
      })
    )
    expect(items.map((item) => [item.title, item.customTitle])).toEqual([
      ['Fix login bug', null],
      ['Mine', 'Mine']
    ])
  })

  it('takes a native chat title from its custom label, then its label', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({
            id: 'u1',
            entityId: 's1',
            contentType: 'agent-session',
            label: 'Chat',
            customLabel: ' Renamed '
          }),
          unifiedTab({ id: 'u2', entityId: 's2', contentType: 'agent-session', label: 'Chat 2' })
        ],
        groups: [group('g1', ['u1', 'u2'])]
      })
    )
    expect(items.map((item) => item.title)).toEqual(['Renamed', 'Chat 2'])
  })

  it('shows the neediest agent state and the row agent for a terminal, else the launch agent', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({ id: 'u1', entityId: 't1' }),
          unifiedTab({ id: 'u2', entityId: 't2' }),
          unifiedTab({ id: 'u3', entityId: 't3', contentType: 'agent-session' })
        ],
        groups: [group('g1', ['u1', 'u2', 'u3'])],
        terminalTabs: [
          terminalTab({ id: 't1', launchAgent: 'codex' }),
          terminalTab({ id: 't2', launchAgent: 'codex' })
        ],
        agentRows: [
          agentRow('t1', { agentType: 'claude', state: 'working' }),
          agentRow('t1', { agentType: 'claude', state: 'blocked' }),
          // Subagent rows borrow the parent's tab and must not decide its state.
          agentRow('t1', { rowSource: 'subagent', state: 'idle' })
        ]
      })
    )
    expect(items.map((item) => [item.agent, item.state])).toEqual([
      ['claude', 'blocked'],
      ['codex', null],
      [null, null]
    ])
  })

  it('maps a native chat to its provider icon from the recorded agent', () => {
    const [item] = buildWorktreeChatItems(
      input({
        tabs: [
          unifiedTab({
            id: 'u1',
            entityId: 's1',
            contentType: 'agent-session',
            agentSessionAgent: 'codex'
          })
        ],
        groups: [group('g1', ['u1'])]
      })
    )
    expect(item?.agent).toBe('codex')
  })
})

describe('excludeChatAgentRows', () => {
  it('drops rows of listed chats, including their subagents, and keeps unrelated rows', () => {
    const items = buildWorktreeChatItems(
      input({
        tabs: [unifiedTab({ id: 'u1', entityId: 't1' })],
        groups: [group('g1', ['u1'])],
        terminalTabs: [terminalTab({ id: 't1', launchAgent: 'claude' })]
      })
    )
    const rows = [
      agentRow('t1'),
      agentRow('t1', { rowSource: 'subagent' }),
      agentRow('orphan-worker-tab')
    ]
    expect(excludeChatAgentRows(rows, items).map((row) => row.tab.id)).toEqual([
      'orphan-worker-tab'
    ])
  })

  it('returns the same rows when no chat is listed', () => {
    const rows = [agentRow('t1')]
    expect(excludeChatAgentRows(rows, [])).toBe(rows)
  })
})
