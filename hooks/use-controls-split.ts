"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { controlsSplit } from "@/lib/springs"

/**
 * How much to scale the mobile viewfinder by so it gives up the bottom half of
 * the screen to the controls.
 *
 * Two boxes are measured, never one. The scale is a *ratio* — the height the
 * canvas should end up at over the height it naturally has — and the two have
 * different origins: the target comes from the viewport, the natural height
 * comes from whatever the control bar leaves over. Deriving the target from the
 * canvas box alone would silently bake the bar's height into the split.
 *
 * The target is the panel's top edge less `canvasGapPx`, so the canvas stops
 * short of the panel rather than running into it.
 *
 * `offsetHeight`, not `getBoundingClientRect().height`: the rect is the
 * *transformed* box, so once the canvas is scaled it would report the scaled
 * height and the next measurement would compound. offsetHeight is the layout
 * height and is unaffected by the transform. For the same reason the
 * ResizeObserver here cannot feed itself — RO reports the border box, which a
 * transform does not touch.
 *
 * Returns null until it has measured, which is every render on the server and
 * the client's first. Nothing can be open by then; the panel is closed at boot
 * and the effect below runs before the button that opens it can be pressed.
 */
export function useControlsSplit(enabled: boolean) {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasBoxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState<number | null>(null)

  const measure = useCallback(() => {
    const root = rootRef.current
    const box = canvasBoxRef.current
    if (!root || !box) return

    const rootHeight = root.clientHeight
    const naturalHeight = box.offsetHeight
    if (!rootHeight || !naturalHeight) return

    // The panel's top is a plain 50dvh in CSS; the gap is spent here, on the
    // canvas, so the panel keeps every pixel of its half. See canvasGapPx.
    const target = rootHeight * controlsSplit.openFraction - controlsSplit.canvasGapPx
    const next = target / naturalHeight
    // Bail on an unchanged value rather than re-rendering the page — and with
    // it both control bars — every time Safari's URL bar moves a pixel.
    setScale((current) => (current !== null && Math.abs(current - next) < 0.0005 ? current : next))
  }, [])

  useEffect(() => {
    if (!enabled) {
      setScale(null)
      return
    }

    measure()

    const observer = new ResizeObserver(measure)
    if (rootRef.current) observer.observe(rootRef.current)
    if (canvasBoxRef.current) observer.observe(canvasBoxRef.current)
    return () => observer.disconnect()
  }, [enabled, measure])

  return { rootRef, canvasBoxRef, scale }
}
