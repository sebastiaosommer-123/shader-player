"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"
import {
  DEFAULT_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  clampSidebarWidth as clamp,
} from "@/lib/sidebar-width"

export { DEFAULT_SIDEBAR_WIDTH }

function loadWidth(): number | null {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)
    if (raw === null) return null
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width))
  } catch {
    // Private mode / disabled storage: the width just won't survive a reload.
  }
}

/**
 * Width of the desktop controls sidebar, dragged from its inner edge.
 *
 * The width lives here rather than in CSS alone so it can be clamped and
 * persisted. It reaches the page as `--sidebar-width` on the document element,
 * seeded before first paint by SIDEBAR_WIDTH_BOOT_SCRIPT and kept in step by
 * this hook; everything that has to line up with the sidebar reads it there.
 */
export function useResizableSidebar() {
  // Read straight from storage rather than starting at the default and
  // correcting later. The value is never rendered into markup — it only drives
  // the custom property below — so there is nothing for the server and client
  // to disagree about, and starting at the default would have this hook's
  // first write clobber the width the boot script already painted.
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? DEFAULT_SIDEBAR_WIDTH : clamp(loadWidth() ?? DEFAULT_SIDEBAR_WIDTH),
  )
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  // Same property the boot script seeds, same element. Writing it here rather
  // than rendering it into a style attribute is what keeps the server's HTML
  // free of a width it cannot know — the markup carries none, so the script's
  // value survives until this takes over.
  useLayoutEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`)
  }, [width])

  const startResize = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      const handle = event.currentTarget
      handle.setPointerCapture(event.pointerId)
      dragRef.current = { startX: event.clientX, startWidth: width }
      setIsResizing(true)

      // Without these the cursor flips back to the default whenever the pointer
      // outruns the handle, and the drag selects the sidebar's labels.
      const previousCursor = document.body.style.cursor
      const previousSelect = document.body.style.userSelect
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"

      let latestWidth = width

      const handleMove = (moveEvent: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        // The sidebar is on the right, so dragging left widens it.
        latestWidth = clamp(drag.startWidth - (moveEvent.clientX - drag.startX))
        setWidth(latestWidth)
      }

      const handleEnd = () => {
        handle.releasePointerCapture(event.pointerId)
        handle.removeEventListener("pointermove", handleMove)
        handle.removeEventListener("pointerup", handleEnd)
        handle.removeEventListener("pointercancel", handleEnd)
        document.body.style.cursor = previousCursor
        document.body.style.userSelect = previousSelect
        dragRef.current = null
        setIsResizing(false)
        // Persist on release only — a write per pointermove is wasted work.
        saveWidth(latestWidth)
      }

      // Bound to the handle rather than the window: pointer capture routes every
      // move here, so the drag keeps tracking outside the 6px strip.
      handle.addEventListener("pointermove", handleMove)
      handle.addEventListener("pointerup", handleEnd)
      handle.addEventListener("pointercancel", handleEnd)
    },
    [width],
  )

  return { width, isResizing, startResize }
}
