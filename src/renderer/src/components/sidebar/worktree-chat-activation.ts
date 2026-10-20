import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateTerminalTabOnOwner } from '@/lib/terminal-tab-owner-activation'
import { activateStructuredAgentSessionTab } from '@/lib/structured-agent-session-tab-activation'
import type { WorktreeChatItem } from './worktree-chat-list-model'

/** Switches to the chat's workspace and tab, the same steps the tab strip and inline agent rows take. */
export function activateWorktreeChat(worktreeId: string, item: WorktreeChatItem): void {
  // Why: every user-initiated worktree switch routes through activateAndRevealWorktree (cross-repo activation + nav history).
  activateAndRevealWorktree(worktreeId)
  if (item.kind === 'agent-session') {
    activateStructuredAgentSessionTab({ worktreeId, tabId: item.tabId })
    return
  }
  const state = useAppStore.getState()
  state.focusGroup(worktreeId, item.groupId)
  const leafId = state.terminalLayoutsByTabId[item.entityId]?.activeLeafId ?? null
  activateTabAndFocusPane(item.entityId, leafId, { scrollToBottomIfOutputSinceLastView: true })
  activateTerminalTabOnOwner(worktreeId, item.entityId, leafId)
}
