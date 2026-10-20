import { useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { DashboardAgentRow } from '@/components/dashboard/useDashboardData'
import { useAppStore } from '@/store'
import type { Tab, TabGroup } from '../../../../shared/tab-types'
import type { TerminalTab } from '../../../../shared/terminal-tab-types'
import { buildWorktreeChatItems, type WorktreeChatItem } from './worktree-chat-list-model'

const EMPTY_TABS: readonly Tab[] = Object.freeze([])
const EMPTY_GROUPS: readonly TabGroup[] = Object.freeze([])
const EMPTY_TERMINAL_TABS: readonly TerminalTab[] = Object.freeze([])
const EMPTY_CHAT_ITEMS: WorktreeChatItem[] = []

/**
 * One workspace's chat rows. Selects only this workspace's tab slices, so churn in other
 * workspaces never re-renders the card; agent rows come from the caller's existing subscription.
 */
export function useWorktreeChatItems(
  worktreeId: string,
  agentRows: DashboardAgentRow[],
  enabled = true
): WorktreeChatItem[] {
  const inputs = useAppStore(
    useShallow((state) => {
      const isActiveWorktree = state.activeWorktreeId === worktreeId
      return {
        tabs: enabled ? state.unifiedTabsByWorktree?.[worktreeId] : undefined,
        groups: enabled ? state.groupsByWorktree?.[worktreeId] : undefined,
        terminalTabs: enabled ? state.tabsByWorktree?.[worktreeId] : undefined,
        isActiveWorktree,
        // Why: only the viewed workspace has a selected chat, so a group switch elsewhere is not a change here.
        activeGroupId: isActiveWorktree ? state.activeGroupIdByWorktree?.[worktreeId] : undefined,
        generatedTitlesEnabled: state.settings?.tabAutoGenerateTitle === true
      }
    })
  )
  return useMemo(
    () =>
      enabled
        ? buildWorktreeChatItems({
            ...inputs,
            tabs: inputs.tabs ?? EMPTY_TABS,
            groups: inputs.groups ?? EMPTY_GROUPS,
            terminalTabs: inputs.terminalTabs ?? EMPTY_TERMINAL_TABS,
            agentRows
          })
        : EMPTY_CHAT_ITEMS,
    [agentRows, enabled, inputs]
  )
}
