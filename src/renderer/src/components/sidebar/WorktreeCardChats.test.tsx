// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAppStore } from '@/store'
import WorktreeCardChats from './WorktreeCardChats'
import { resetSidebarChatListCollapseStateForTests } from './sidebar-chat-list-collapse-state'
import type { WorktreeChatItem } from './worktree-chat-list-model'

const mocks = vi.hoisted(
  (): {
    activateAndRevealWorktree: Mock
    activateTabAndFocusPane: Mock
    activateTerminalTabOnOwner: Mock
    activateStructuredAgentSessionTab: Mock
    dispatchWorkspaceTabCommand: Mock
    setTabCustomTitle: Mock
    focusGroup: Mock
    quickLaunchProps: Record<string, unknown>[]
  } => ({
    activateAndRevealWorktree: vi.fn(),
    activateTabAndFocusPane: vi.fn(),
    activateTerminalTabOnOwner: vi.fn(),
    activateStructuredAgentSessionTab: vi.fn(),
    dispatchWorkspaceTabCommand: vi.fn(),
    setTabCustomTitle: vi.fn(),
    focusGroup: vi.fn(),
    quickLaunchProps: []
  })
)

vi.mock('@/store', async () => {
  const { create } = await import('zustand')
  const useAppStore = create<{
    activeGroupIdByWorktree: Record<string, string>
    groupsByWorktree: Record<string, { id: string }[]>
    terminalLayoutsByTabId: Record<string, { activeLeafId: string | null }>
    setTabCustomTitle: Mock
    focusGroup: Mock
  }>(() => ({
    activeGroupIdByWorktree: {},
    groupsByWorktree: {},
    terminalLayoutsByTabId: {},
    setTabCustomTitle: mocks.setTabCustomTitle,
    focusGroup: mocks.focusGroup
  }))
  return { useAppStore }
})
vi.mock('@/lib/worktree-activation', () => ({
  activateAndRevealWorktree: mocks.activateAndRevealWorktree
}))
vi.mock('@/lib/activate-tab-and-focus-pane', () => ({
  activateTabAndFocusPane: mocks.activateTabAndFocusPane
}))
vi.mock('@/lib/terminal-tab-owner-activation', () => ({
  activateTerminalTabOnOwner: mocks.activateTerminalTabOnOwner
}))
vi.mock('@/lib/structured-agent-session-tab-activation', () => ({
  activateStructuredAgentSessionTab: mocks.activateStructuredAgentSessionTab
}))
vi.mock('@/lib/workspace-tab-commands', () => ({
  dispatchWorkspaceTabCommand: mocks.dispatchWorkspaceTabCommand
}))
vi.mock('@/runtime/structured-conversation-name', () => ({
  useStructuredChatTabConversationName: () => null
}))
vi.mock('@/lib/focus-terminal-tab-surface', () => ({ focusTerminalTabSurface: vi.fn() }))
vi.mock('@/components/tab-bar/QuickLaunchButton', () => ({
  QuickLaunchAgentMenuItems: (props: Record<string, unknown>) => {
    mocks.quickLaunchProps.push(props)
    return <div data-testid="quick-launch-agents" />
  }
}))

function chatItem(
  overrides: Partial<WorktreeChatItem> & Pick<WorktreeChatItem, 'tabId'>
): WorktreeChatItem {
  return {
    entityId: `${overrides.tabId}-entity`,
    groupId: 'g1',
    executionHostId: undefined,
    kind: 'terminal',
    title: overrides.tabId,
    customTitle: null,
    agent: 'claude',
    state: null,
    isSelected: false,
    ...overrides
  }
}

let container: HTMLDivElement
let root: Root

async function render(items: WorktreeChatItem[]): Promise<void> {
  await act(async () => {
    root.render(
      <TooltipProvider>
        <WorktreeCardChats worktreeId="wt-1" items={items} />
      </TooltipProvider>
    )
  })
}

function rowButton(title: string): HTMLButtonElement {
  const button = [
    ...container.querySelectorAll<HTMLButtonElement>(
      'button[aria-current], [data-worktree-chat-row] button'
    )
  ].find((candidate) => candidate.textContent?.includes(title))
  if (!button) {
    throw new Error(`no chat row titled ${title}`)
  }
  return button
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.quickLaunchProps.length = 0
  window.localStorage.clear()
  resetSidebarChatListCollapseStateForTests()
  useAppStore.setState({
    activeGroupIdByWorktree: { 'wt-1': 'g1' },
    groupsByWorktree: {
      'wt-1': [{ id: 'g1', worktreeId: 'wt-1', activeTabId: null, tabOrder: [] }]
    },
    terminalLayoutsByTabId: {
      'a-entity': { root: null, activeLeafId: 'leaf-a', expandedLeafId: null }
    }
  })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

describe('WorktreeCardChats', () => {
  it('renders the rows in the given order with the count', async () => {
    await render([chatItem({ tabId: 'a' }), chatItem({ tabId: 'b' }), chatItem({ tabId: 'c' })])

    const rows = [...container.querySelectorAll('[data-worktree-chat-row]')]
    expect(rows.map((row) => row.getAttribute('data-worktree-chat-row'))).toEqual(['a', 'b', 'c'])
    expect(container.textContent).toContain('Chats')
    expect(
      container.querySelector('[data-worktree-chat-list] button[aria-expanded]')?.textContent
    ).toContain('3')
  })

  it('marks only the selected chat as current', async () => {
    await render([chatItem({ tabId: 'a' }), chatItem({ tabId: 'b', isSelected: true })])

    expect(rowButton('a').getAttribute('aria-current')).toBeNull()
    expect(rowButton('b').getAttribute('aria-current')).toBe('true')
    expect(
      container.querySelector('[data-worktree-chat-row="b"]')?.getAttribute('data-current')
    ).toBe('true')
    expect(
      container.querySelector('[data-worktree-chat-row="a"]')?.getAttribute('data-current')
    ).toBeNull()
  })

  it('activates a terminal chat in its workspace, group and active pane', async () => {
    await render([chatItem({ tabId: 'a' })])

    await act(async () => rowButton('a').click())

    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('wt-1')
    expect(mocks.focusGroup).toHaveBeenCalledWith('wt-1', 'g1')
    expect(mocks.activateTabAndFocusPane).toHaveBeenCalledWith(
      'a-entity',
      'leaf-a',
      expect.anything()
    )
    expect(mocks.activateTerminalTabOnOwner).toHaveBeenCalledWith('wt-1', 'a-entity', 'leaf-a')
  })

  it('activates a native chat through the structured session path', async () => {
    await render([chatItem({ tabId: 'chat-tab', kind: 'agent-session' })])

    await act(async () => rowButton('chat-tab').click())

    expect(mocks.activateStructuredAgentSessionTab).toHaveBeenCalledWith({
      worktreeId: 'wt-1',
      tabId: 'chat-tab'
    })
    expect(mocks.activateTabAndFocusPane).not.toHaveBeenCalled()
  })

  it('collapses and expands the list and remembers it', async () => {
    await render([chatItem({ tabId: 'a' })])
    const toggle = container.querySelector<HTMLButtonElement>('button[aria-expanded]')!

    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelector('[data-worktree-chat-row]')).toBeNull()
    expect(
      JSON.parse(window.localStorage.getItem('orca.sidebar.collapsedChatLists') ?? '[]')
    ).toEqual(['wt-1'])

    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelector('[data-worktree-chat-row]')).not.toBeNull()
  })

  it('starts collapsed when the workspace was collapsed before', async () => {
    window.localStorage.setItem('orca.sidebar.collapsedChatLists', JSON.stringify(['wt-1']))
    resetSidebarChatListCollapseStateForTests()

    await render([chatItem({ tabId: 'a' })])

    expect(container.querySelector('[data-worktree-chat-row]')).toBeNull()
  })

  it('ignores a damaged collapse record', async () => {
    window.localStorage.setItem('orca.sidebar.collapsedChatLists', '{not json')
    resetSidebarChatListCollapseStateForTests()

    await render([chatItem({ tabId: 'a' })])

    expect(container.querySelector('[data-worktree-chat-row]')).not.toBeNull()
  })

  it('renames a terminal chat by its terminal id and a native chat by its tab id', async () => {
    await render([
      chatItem({ tabId: 'a', title: 'Alpha' }),
      chatItem({ tabId: 'chat-tab', kind: 'agent-session', title: 'Beta' })
    ])

    for (const [title, expectedId] of [
      ['Alpha', 'a-entity'],
      ['Beta', 'chat-tab']
    ] as const) {
      await act(async () => {
        rowButton(title).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
      })
      const input = container.querySelector<HTMLInputElement>('input[data-tab-rename-input]')!
      expect(input.value).toBe(title)
      await act(async () => {
        const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
        setValue.call(input, `${title} renamed`)
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      })
      expect(mocks.setTabCustomTitle).toHaveBeenLastCalledWith(expectedId, `${title} renamed`)
      expect(container.querySelector('input[data-tab-rename-input]')).toBeNull()
    }
  })

  it('does not rename when the edit is cancelled or unchanged', async () => {
    await render([chatItem({ tabId: 'a', title: 'Alpha' })])

    await act(async () => {
      rowButton('Alpha').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    await act(async () => {
      container
        .querySelector('input[data-tab-rename-input]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    await act(async () => {
      rowButton('Alpha').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
    })
    await act(async () => {
      container
        .querySelector('input[data-tab-rename-input]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(mocks.setTabCustomTitle).not.toHaveBeenCalled()
  })

  it('closes a chat through the tab strip close command with its unified tab id', async () => {
    await render([chatItem({ tabId: 'a' })])

    const close = container.querySelector<HTMLButtonElement>('button[aria-label="Close chat"]')!
    await act(async () => close.click())

    expect(mocks.dispatchWorkspaceTabCommand).toHaveBeenCalledWith({
      type: 'close',
      target: { kind: 'tab', worktreeId: 'wt-1', tabId: 'a' }
    })
  })

  it('offers Rename and Close in the right-click menu', async () => {
    await render([chatItem({ tabId: 'a', title: 'Alpha' })])
    const openMenu = async (): Promise<HTMLElement[]> => {
      await act(async () => {
        container
          .querySelector('[data-worktree-chat-row="a"]')!
          .dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
      })
      return [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')]
    }

    let items = await openMenu()
    expect(items.map((item) => item.textContent)).toEqual(['Rename', 'Close chat'])
    await act(async () => items[0]!.click())
    expect(container.querySelector('input[data-tab-rename-input]')).not.toBeNull()

    await act(async () => {
      container
        .querySelector('input[data-tab-rename-input]')!
        .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    items = await openMenu()
    await act(async () => items[1]!.click())
    expect(mocks.dispatchWorkspaceTabCommand).toHaveBeenCalledWith({
      type: 'close',
      target: { kind: 'tab', worktreeId: 'wt-1', tabId: 'a' }
    })
  })

  it('offers New chat on an empty workspace and lists agents for that workspace only after opening', async () => {
    await render([])

    expect(container.querySelector('[data-worktree-chat-row]')).toBeNull()
    const newChat = container.querySelector<HTMLButtonElement>('button[aria-label="New chat"]')!
    expect(newChat.parentElement?.className).not.toContain('opacity-0')
    expect(mocks.quickLaunchProps).toHaveLength(0)

    await act(async () => {
      newChat.dispatchEvent(
        new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: false })
      )
    })

    expect(mocks.activateAndRevealWorktree).toHaveBeenCalledWith('wt-1')
    expect(document.body.querySelector('[data-testid="quick-launch-agents"]')).not.toBeNull()
    expect(mocks.quickLaunchProps.at(-1)).toMatchObject({
      worktreeId: 'wt-1',
      groupId: 'g1',
      launchSource: 'sidebar'
    })
  })

  it('keeps New chat out of sight until hover when chats exist', async () => {
    await render([chatItem({ tabId: 'a' })])

    const newChat = container.querySelector<HTMLButtonElement>('button[aria-label="New chat"]')!
    expect(newChat.parentElement?.className).toContain('opacity-0')
  })
})
