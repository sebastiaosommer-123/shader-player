import type { Rect } from "./animation-utils"

/**
 * The desktop floating toolbar's layout, in one place.
 *
 * These are shared rather than local to the component because two things need
 * them: the bar that renders the slot, and the capture animation that has to
 * know where the slot will come to rest. They mirror Tailwind classes in
 * components/floating-toolbar.tsx — keep them in step.
 */

/** Matches the capture ring, so the two ends of the bar balance. */
export const SLOT_SIZE = 48
/**
 * Half the box — a true circle, written as the real radius rather than a large
 * sentinel. The browser clamps an oversized value at paint, but Framer's layout
 * projection interpolates whatever number it is given: from 9999 the corner
 * stays an ellipse for almost the entire gallery morph.
 */
export const SLOT_RADIUS = SLOT_SIZE / 2
/** The bar's `p-1.5`. */
export const BAR_PADDING = 6
/** The bar's `gap-2`. */
export const BAR_GAP = 8

/**
 * Where a captured frame should land: the thumbnail slot's *resting* rect.
 *
 * Deliberately not read off the slot itself. On the first capture the slot
 * opens over the whole flight duration, so its live rect is mid-animation for
 * exactly as long as the frame is in the air — measuring it would aim the
 * flight at wherever the slot happened to be on the frame the shutter fired.
 *
 * The bar is `fixed` and centred on the viewport, so its settled geometry is
 * derivable instead: measure the two children whose widths never change, add
 * the padding and gaps around them, and centre the total. That holds whether
 * the slot is open, closed, or somewhere in between.
 */
export function measureDesktopSlotRect(): Rect | null {
  const bar = document.querySelector<HTMLElement>("[data-floating-toolbar]")
  if (!bar) return null

  const barRect = bar.getBoundingClientRect()
  // CSS-hidden below md — no layout box, so there is nothing to land on.
  if (barRect.width === 0) return null

  const tabs = bar.querySelector('[role="radiogroup"]')
  const shutter = bar.querySelector('[aria-label="Capture frame"]')
  if (!tabs || !shutter) return null

  const openWidth =
    BAR_PADDING +
    SLOT_SIZE +
    BAR_GAP +
    tabs.getBoundingClientRect().width +
    BAR_GAP +
    shutter.getBoundingClientRect().width +
    BAR_PADDING

  return {
    // The bar's height never changes as the slot opens, so its top is safe to
    // measure directly.
    top: barRect.top + BAR_PADDING,
    left: window.innerWidth / 2 - openWidth / 2 + BAR_PADDING,
    width: SLOT_SIZE,
    height: SLOT_SIZE,
    radius: SLOT_RADIUS,
  }
}
