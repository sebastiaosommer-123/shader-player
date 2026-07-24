"use client"

import { useCallback, useSyncExternalStore } from "react"
import { isCollapsed, subscribe, toggle } from "@/lib/collapsed-groups"

/**
 * Collapsed state for one parameter group of one shader, shared across every
 * surface that renders it (see lib/collapsed-groups.ts).
 */
export function useCollapsedGroup(shaderId: string, groupName: string) {
  const collapsed = useSyncExternalStore(
    subscribe,
    () => isCollapsed(shaderId, groupName),
    // The server can't read localStorage, so it renders the default — expanded
    // — and the stored value takes over at hydration.
    () => false,
  )

  const toggleCollapsed = useCallback(() => toggle(shaderId, groupName), [shaderId, groupName])

  return [collapsed, toggleCollapsed] as const
}
