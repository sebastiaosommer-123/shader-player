"use client"

import { useCallback, useLayoutEffect, useRef, useState } from "react"

const MIN_WIDTH = 200
const MAX_WIDTH = 400
export const DEFAULT_SIDEBAR_WIDTH = 280
const STORAGE_KEY = "shader-player:sidebar-width"

function loadWidth(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    const parsed = Number.parseFloat(raw)
    return Number.isFinite(parsed) ? parsed : null
  } catch {
    return null
  }
}

function saveWidth(width: number) {
  try {
    localStorage.setItem(STORAGE_KEY, String(width))
  } catch {
    // Private mode / disabled storage: the width just won't survive a reload.
  }
}

function clamp(width: number) {
  return Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH)
}

/**
 * Width of the desktop controls sidebar, dragged from its inner edge.
 *
 * The width lives here rather than in CSS alone so it can be clamped and
 * persisted; page.tsx publishes it as `--sidebar-width` and everything that
 * needs to line up with the sidebar reads that variable.
 */
export function useResizableSidebar() {
  // Starts at the default so server and first client render agree — the stored
  // value is applied in a layout effect, before the browser paints.
  const [width, setWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizing, setIsResizing] = useState(false)
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null)

  useLayoutEffect(() => {
    const saved = loadWidth()
    if (saved !== null) setWidth(clamp(saved))
  }, [])

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
