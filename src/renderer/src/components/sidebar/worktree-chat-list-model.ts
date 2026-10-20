import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import type { AgentDotState } from '@/components/AgentStateDot'
import { agentRowDisplayDotState } from '@/lib/agent-row-dot-state'
import { agentTypeToIconAgent } from '@/lib/agent-status'
import { stripLeadingAgentTitleDecoration } from '../../../../shared/agent-title-decoration'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import type { TerminalAgent } from '../../../../shared/terminal-agent'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { resolveTerminalTabTitle } from '../../../../shared/tab-title-resolution'

export type WorktreeChatKind = 'terminal' | 'agent-session'

export type WorktreeChatItem = {
  /** Unified tab id: what close and group activation address. */
  tabId: string
  /** Terminal tab id for terminals, native chat session id for agent sessions. */
  entityId: string
  groupId: string
  /** Host that owns a native chat; its saved conversation name is read from that host. */
  executionHostId: ExecutionHostId | undefined
  kind: WorktreeChatKind
  title: string
  /** Name a rename edits; empty when the tab has no custom title yet. */
  customTitle: string | null
  agent: TerminalAgent | null
  state: AgentDotState | null
  isSelected: boolean
}

export type WorktreeChatListInput = {
  tabs: readonly Tab[]
  groups: readonly TabGroup[]
  terminalTabs: readonly TerminalTab[]
  agentRows: readonly DashboardAgentRow[]
  isActiveWorktree: boolean
  activeGroupId: string | null | undefined
  generatedTitlesEnabled: boolean
}

// Most attention-worthy first, so a split tab shows its neediest pane.
const STATE_PRIORITY: readonly AgentDotState[] = [
  'blocked',
  'permission',
  'waiting',
  'working',
  'monitoring',
  'unverifiable',
  'failed',
  'interrupted',
  'unconfirmed',
  'done',
  'idle'
]

function statePriority(state: AgentDotState): number {
  const index = STATE_PRIORITY.indexOf(state)
  return index === -1 ? STATE_PRIORITY.length : index
}

/** Tabs in the order the tab strip shows them: groups in layout order, then each group's tabOrder. */
function orderTabsLikeTabStrip(tabs: readonly Tab[], groups: readonly TabGroup[]): Tab[] {
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab] as const))
  const placed = new Set<string>()
  const ordered: Tab[] = []
  const take = (tab: Tab | undefined): void => {
    if (tab && !placed.has(tab.id)) {
      placed.add(tab.id)
      ordered.push(tab)
    }
  }
  for (const group of groups) {
    for (const tabId of group.tabOrder) {
      const tab = tabsById.get(tabId)
      if (tab?.groupId === group.id) {
        take(tab)
      }
    }
    // Why: a tab can be missing from tabOrder mid-write; keep it visible in creation order.
    tabs
      .filter((tab) => tab.groupId === group.id && !placed.has(tab.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(take)
  }
  tabs
    .filter((tab) => !placed.has(tab.id))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach(take)
  return ordered
}

function indexRowsByTabId(rows: readonly DashboardAgentRow[]): Map<string, DashboardAgentRow[]> {
  const byTabId = new Map<string, DashboardAgentRow[]>()
  for (const row of rows) {
    // Why: subagent rows borrow their parent's tab; they say nothing about the chat itself.
    if (row.rowSource === 'subagent') {
      continue
    }
    const bucket = byTabId.get(row.tab.id)
    if (bucket) {
      bucket.push(row)
    } else {
      byTabId.set(row.tab.id, [row])
    }
  }
  return byTabId
}

function summarizeRows(rows: readonly DashboardAgentRow[]): {
  agent: TerminalAgent | null
  state: AgentDotState | null
} {
  let state: AgentDotState | null = null
  let agent: TerminalAgent | null = null
  for (const row of rows) {
    const rowState = agentRowDisplayDotState(row)
    if (state === null || statePriority(rowState) < statePriority(state)) {
      state = rowState
    }
    agent ??= agentTypeToIconAgent(row.agentType)
  }
  return { agent, state }
}

/** The chats of one workspace: native agent sessions and terminals that run (or were launched as) an agent. */
export function buildWorktreeChatItems(input: WorktreeChatListInput): WorktreeChatItem[] {
  if (input.tabs.length === 0) {
    return []
  }
  const terminalTabsById = new Map(input.terminalTabs.map((tab) => [tab.id, tab] as const))
  const rowsByTabId = indexRowsByTabId(input.agentRows)
  const activeGroupId = input.activeGroupId ?? input.groups[0]?.id
  const activeTabIdByGroupId = new Map(input.groups.map((group) => [group.id, group.activeTabId]))
  const items: WorktreeChatItem[] = []

  for (const tab of orderTabsLikeTabStrip(input.tabs, input.groups)) {
    const isSelected =
      input.isActiveWorktree &&
      tab.groupId === activeGroupId &&
      activeTabIdByGroupId.get(tab.groupId) === tab.id

    if (tab.contentType === 'agent-session') {
      const { state } = summarizeRows([
        ...(rowsByTabId.get(tab.id) ?? []),
        ...(rowsByTabId.get(tab.entityId) ?? [])
      ])
      items.push({
        tabId: tab.id,
        entityId: tab.entityId,
        groupId: tab.groupId,
        executionHostId: tab.executionHostId,
        kind: 'agent-session',
        title: tab.customLabel?.trim() || tab.label.trim(),
        customTitle: tab.customLabel,
        // Why: a chat records its provider, so its title or turn state must never re-identify it.
        agent: agentTypeToIconAgent(tab.agentSessionAgent),
        state,
        isSelected
      })
      continue
    }

    if (tab.contentType !== 'terminal') {
      continue
    }
    const terminalTab = terminalTabsById.get(tab.entityId)
    const rows = rowsByTabId.get(tab.entityId) ?? []
    if (!terminalTab || (!terminalTab.launchAgent && rows.length === 0)) {
      continue
    }
    const summary = summarizeRows(rows)
    const agent = summary.agent ?? terminalTab.launchAgent ?? null
    const resolvedTitle = resolveTerminalTabTitle(
      terminalTab,
      input.generatedTitlesEnabled,
      tab.label
    )
    items.push({
      tabId: tab.id,
      entityId: tab.entityId,
      groupId: tab.groupId,
      executionHostId: tab.executionHostId,
      kind: 'terminal',
      title:
        (agent && !terminalTab.customTitle
          ? stripLeadingAgentTitleDecoration(resolvedTitle)
          : resolvedTitle
        ).trim() || tab.label.trim(),
      customTitle: terminalTab.customTitle,
      agent,
      state: summary.state,
      isSelected
    })
  }
  return items
}

/** Agent rows that no listed chat already represents, so a running agent is not shown twice. */
export function excludeChatAgentRows(
  rows: DashboardAgentRow[],
  items: readonly WorktreeChatItem[]
): DashboardAgentRow[] {
  if (items.length === 0) {
    return rows
  }
  const chatTabIds = new Set<string>()
  for (const item of items) {
    chatTabIds.add(item.tabId)
    chatTabIds.add(item.entityId)
  }
  return rows.filter((row) => !chatTabIds.has(row.tab.id))
}
