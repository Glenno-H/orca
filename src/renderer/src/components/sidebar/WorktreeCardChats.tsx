import React, { useCallback } from 'react'
import { ChevronRight } from 'lucide-react'
import { useTabGroupTabCloseCommands } from '@/components/tab-group/useTabGroupTabCloseCommands'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { WorktreeCardChatRow } from './WorktreeCardChatRow'
import { WorktreeCardNewChatMenu } from './WorktreeCardNewChatMenu'
import { useSidebarChatListCollapsed } from './sidebar-chat-list-collapse-state'
import { activateWorktreeChat } from './worktree-chat-activation'
import type { WorktreeChatItem } from './worktree-chat-list-model'

type Props = {
  worktreeId: string
  items: WorktreeChatItem[]
  /** Spacing from the card body above; parent decides whether a divider is appropriate. */
  className?: string
}

/** Collapsible list of a workspace's agent chats, with a New chat picker, shown under its sidebar card. */
const WorktreeCardChats = React.memo(function WorktreeCardChats({
  worktreeId,
  items,
  className
}: Props) {
  const { collapsed, toggleCollapsed } = useSidebarChatListCollapsed(worktreeId)
  const setTabCustomTitle = useAppStore((state) => state.setTabCustomTitle)
  const { closeItem } = useTabGroupTabCloseCommands({ worktreeId })

  const handleActivate = useCallback(
    (item: WorktreeChatItem) => activateWorktreeChat(worktreeId, item),
    [worktreeId]
  )
  // Why: the tab strip's own close command, so a running agent still asks before it is stopped.
  const handleClose = useCallback((item: WorktreeChatItem) => closeItem(item.tabId), [closeItem])
  const handleRename = useCallback(
    (item: WorktreeChatItem, title: string | null) => {
      // Why: a terminal tab is renamed by its terminal id; a native chat has none and uses its unified tab id.
      setTabCustomTitle(item.kind === 'terminal' ? item.entityId : item.tabId, title)
    },
    [setTabCustomTitle]
  )
  const stopBubble = useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation()
  }, [])

  const label = translate('auto.components.sidebar.WorktreeCardChats.chats', 'Chats')
  return (
    // Why: swallow bubbling so gutter clicks don't reach WorktreeCard's activate / edit-meta handlers.
    <div
      className={cn('group/worktree-chats mt-1 flex flex-col gap-0.5', className)}
      role="group"
      aria-label={label}
      data-worktree-chat-list=""
      onClick={stopBubble}
      onDoubleClick={stopBubble}
      onMouseDown={stopBubble}
      onPointerDown={stopBubble}
    >
      <div className="flex h-6 items-center justify-between gap-1 px-1">
        <button
          type="button"
          aria-expanded={!collapsed}
          className="flex min-w-0 cursor-pointer items-center gap-1 rounded-sm text-[10.5px] font-medium leading-none text-muted-foreground outline-none hover:text-foreground focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
          onClick={toggleCollapsed}
        >
          <ChevronRight
            className={cn('size-3 shrink-0 transition-transform', !collapsed && 'rotate-90')}
          />
          <span className="truncate">{label}</span>
          {items.length > 0 ? (
            <span className="tabular-nums text-muted-foreground/70">{items.length}</span>
          ) : null}
        </button>
        <WorktreeCardNewChatMenu worktreeId={worktreeId} alwaysVisible={items.length === 0} />
      </div>
      {collapsed
        ? null
        : items.map((item) => (
            <WorktreeCardChatRow
              key={item.tabId}
              worktreeId={worktreeId}
              item={item}
              onActivate={handleActivate}
              onClose={handleClose}
              onRename={handleRename}
            />
          ))}
    </div>
  )
})

export default WorktreeCardChats
