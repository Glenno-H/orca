import { useCallback, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'orca.sidebar.collapsedChatLists'
// Why: same bound as the agent-list expansion cache, so long-lived installs never grow the key without limit.
export const MAX_COLLAPSED_CHAT_LIST_ENTRIES = 512

// Insertion order doubles as recency: the oldest collapse is the first to be forgotten.
let collapsedWorktreeIds: Set<string> | null = null
const listeners = new Set<() => void>()

function readStoredIds(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(parsed)) {
      return new Set()
    }
    return new Set(
      parsed
        .filter((entry): entry is string => typeof entry === 'string')
        .slice(-MAX_COLLAPSED_CHAT_LIST_ENTRIES)
    )
  } catch {
    // Why: a damaged or unreadable value must only reset the disclosure state, never break the sidebar.
    return new Set()
  }
}

function collapsedIds(): Set<string> {
  collapsedWorktreeIds ??= readStoredIds()
  return collapsedWorktreeIds
}

function persist(ids: Set<string>): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]))
  } catch {
    // Why: storage can be full or disabled; the in-memory state still serves this session.
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function toggleCollapsed(worktreeId: string): void {
  const ids = collapsedIds()
  if (ids.has(worktreeId)) {
    ids.delete(worktreeId)
  } else {
    ids.add(worktreeId)
    while (ids.size > MAX_COLLAPSED_CHAT_LIST_ENTRIES) {
      const oldest = ids.values().next().value
      if (oldest === undefined) {
        break
      }
      ids.delete(oldest)
    }
  }
  persist(ids)
  for (const listener of listeners) {
    listener()
  }
}

/** Whether this workspace's sidebar chat list is folded; default open, remembered across reloads. */
export function useSidebarChatListCollapsed(worktreeId: string): {
  collapsed: boolean
  toggleCollapsed: () => void
} {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => collapsedIds().has(worktreeId),
    () => false
  )
  const toggle = useCallback(() => toggleCollapsed(worktreeId), [worktreeId])
  return { collapsed, toggleCollapsed: toggle }
}

export function resetSidebarChatListCollapseStateForTests(): void {
  collapsedWorktreeIds = null
  listeners.clear()
}
