import React, { useCallback, useRef, useState } from 'react'
import { Pencil, X } from 'lucide-react'
import { AgentStateDot, agentStateLabel } from '@/components/AgentStateDot'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { AgentIcon } from '@/lib/agent-catalog'
import { formatAgentTypeLabel } from '@/lib/agent-status'
import { isImeCompositionKeyDown } from '@/lib/ime-composition-keyboard-event'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useStructuredChatTabConversationName } from '@/runtime/structured-conversation-name'
import { WORKTREE_NATIVE_CONTEXT_MENU_ATTR } from './worktree-context-menu-policy'
import type { WorktreeChatItem } from './worktree-chat-list-model'

type Props = {
  worktreeId: string
  item: WorktreeChatItem
  onActivate: (item: WorktreeChatItem) => void
  onClose: (item: WorktreeChatItem) => void
  onRename: (item: WorktreeChatItem, title: string | null) => void
}

export const WorktreeCardChatRow = React.memo(function WorktreeCardChatRow({
  worktreeId,
  item,
  onActivate,
  onClose,
  onRename
}: Props) {
  const conversationName = useStructuredChatTabConversationName(
    item.kind === 'agent-session'
      ? { entityId: item.entityId, worktreeId, executionHostId: item.executionHostId }
      : undefined
  )
  // Why: the tab strip shows the host's saved conversation name unless the user renamed the tab.
  const title = (item.customTitle?.trim() ? null : conversationName) ?? item.title
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  // Why: blur fires while the input unmounts; a resolved rename must not commit a second time.
  const renameResolvedRef = useRef(false)

  const openRename = useCallback(() => {
    renameResolvedRef.current = false
    setRenameValue(item.customTitle?.trim() || title)
    setRenaming(true)
  }, [item.customTitle, title])
  const startingValue = item.customTitle?.trim() || title
  const commitRename = useCallback(() => {
    if (renameResolvedRef.current) {
      return
    }
    renameResolvedRef.current = true
    const trimmed = renameValue.trim()
    if (trimmed !== startingValue) {
      onRename(item, trimmed.length > 0 ? trimmed : null)
    }
    setRenaming(false)
  }, [item, onRename, renameValue, startingValue])
  const cancelRename = useCallback(() => {
    renameResolvedRef.current = true
    setRenaming(false)
  }, [])
  const focusRenameInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) {
      return
    }
    // Why: defer past the context menu's focus restore, which would otherwise pull focus off the new input.
    requestAnimationFrame(() => {
      input.focus()
      input.select()
    })
  }, [])

  const closeLabel = translate('auto.components.sidebar.WorktreeCardChats.closeChat', 'Close chat')
  const agentLabel = item.agent ? formatAgentTypeLabel(item.agent) : null
  const stateLabel = item.state ? agentStateLabel(item.state) : null
  const detail = [agentLabel, stateLabel].filter(Boolean).join(' · ')

  const row = (
    <div
      draggable={false}
      className={cn(
        'group/chat-row worktree-agent-row-hover flex h-6 min-w-0 items-center gap-1 rounded-sm px-1 text-[11px] leading-none',
        item.isSelected ? 'text-foreground' : 'text-muted-foreground'
      )}
      // Why: reuses the selected-agent-row wash so the viewed chat reads like the focused agent beneath it.
      data-focused-agent-pane={item.isSelected ? 'true' : undefined}
      data-current={item.isSelected ? 'true' : undefined}
      data-worktree-chat-row={item.tabId}
      {...{ [WORKTREE_NATIVE_CONTEXT_MENU_ATTR]: '' }}
      onDragStart={(event) => event.stopPropagation()}
    >
      {renaming ? (
        <Input
          ref={focusRenameInput}
          data-tab-rename-input="true"
          value={renameValue}
          aria-label={translate(
            'auto.components.sidebar.WorktreeCardChats.renameChat',
            'Rename chat {{value0}}',
            { value0: title }
          )}
          onChange={(event) => setRenameValue(event.target.value)}
          onBlur={commitRename}
          onKeyDown={(event) => {
            // Why: an Enter that only confirms a CJK IME candidate must not commit the rename.
            if (isImeCompositionKeyDown(event)) {
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              commitRename()
            } else if (event.key === 'Escape') {
              event.preventDefault()
              cancelRename()
            }
          }}
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
          className="h-6 min-w-0 flex-1"
          spellCheck={false}
        />
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-current={item.isSelected ? 'true' : undefined}
              className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-1 rounded-sm text-left outline-none focus-visible:ring-1 focus-visible:ring-worktree-sidebar-ring"
              onClick={() => onActivate(item)}
              onDoubleClick={openRename}
            >
              {item.state ? <AgentStateDot state={item.state} size="sm" title={null} /> : null}
              <span className="inline-flex shrink-0">
                <AgentIcon agent={item.agent} size={13} />
              </span>
              <span className={cn('min-w-0 flex-1 truncate', item.isSelected && 'font-medium')}>
                {title}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="max-w-72 break-words">
            <div>{title}</div>
            {detail ? <div className="opacity-70">{detail}</div> : null}
          </TooltipContent>
        </Tooltip>
      )}
      {renaming ? null : (
        <span className="inline-flex shrink-0 opacity-0 transition-opacity group-hover/chat-row:opacity-100 focus-within:opacity-100">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={closeLabel}
                data-workspace-board-preserve-open=""
                onClick={() => onClose(item)}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {closeLabel}
            </TooltipContent>
          </Tooltip>
        </span>
      )}
    </div>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={openRename}>
          <Pencil />
          {translate('auto.components.sidebar.WorktreeCardChats.renameAction', 'Rename')}
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={() => onClose(item)}>
          <X />
          {closeLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
})
