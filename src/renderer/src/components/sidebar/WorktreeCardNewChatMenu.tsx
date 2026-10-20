import React, { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { QuickLaunchAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'

type Props = {
  worktreeId: string
  /** Keeps the button visible; otherwise it appears while the chat section is hovered or focused. */
  alwaysVisible: boolean
}

/** Agent picker that starts a chat inside this existing workspace, through the tab bar's launch path. */
export const WorktreeCardNewChatMenu = React.memo(function WorktreeCardNewChatMenu({
  worktreeId,
  alwaysVisible
}: Props) {
  const [open, setOpen] = useState(false)
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen)
      if (nextOpen) {
        // Why: the new chat opens in this workspace's pane, so show that workspace before the user picks an agent.
        activateAndRevealWorktree(worktreeId)
      }
    },
    [worktreeId]
  )
  const label = translate('auto.components.sidebar.WorktreeCardChats.newChat', 'New chat')

  return (
    <DropdownMenu onOpenChange={handleOpenChange}>
      {/* Why: the wrapper owns the reveal (Button forbids opacity classes); an open menu keeps it shown after the pointer leaves. */}
      <span
        className={cn(
          'inline-flex shrink-0 transition-opacity',
          !alwaysVisible &&
            !open &&
            'opacity-0 group-hover/worktree-chats:opacity-100 focus-within:opacity-100'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label={label}
                data-workspace-board-preserve-open=""
              >
                <Plus />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      </span>
      <DropdownMenuContent
        side="right"
        align="start"
        className="min-w-48"
        onCloseAutoFocus={(event) => {
          // Why: Radix restores focus to the "+" trigger on close, stealing it from the new chat.
          event.preventDefault()
        }}
      >
        <NewChatAgentItems worktreeId={worktreeId} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

/** Mounted only while the menu is open, so closed cards never read the pane layout. */
function NewChatAgentItems({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  // Why: same target pane the tab bar's "+" uses (focused pane, else the first one).
  const groupId = useAppStore(
    (state) =>
      state.activeGroupIdByWorktree?.[worktreeId] ?? state.groupsByWorktree?.[worktreeId]?.[0]?.id
  )
  if (!groupId) {
    return (
      <DropdownMenuItem disabled>
        {translate('auto.components.tab.bar.QuickLaunchButton.agentsLoading', 'Loading agents')}
      </DropdownMenuItem>
    )
  }
  return (
    <QuickLaunchAgentMenuItems
      worktreeId={worktreeId}
      groupId={groupId}
      onFocusTerminal={focusTerminalTabSurface}
      launchSource="sidebar"
    />
  )
}
