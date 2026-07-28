import { measureDesktopSlotRect } from "./toolbar-geometry"

export interface Rect {
  top: number
  left: number
  width: number
  height: number
  /** Corner radius the flying frame should settle into. */
  radius?: number
}

/**
 * The rendered corner radius of an element, clamped the way the browser clamps
 * it — a 9999px radius on a 56px box lands at 28px, not 9999.
 */
function readRadius(el: Element, width: number, height: number): number {
  const parsed = Number.parseFloat(getComputedStyle(el).borderTopLeftRadius)
  if (Number.isNaN(parsed)) return 0
  return Math.min(parsed, width / 2, height / 2)
}

/**
 * Calculate the position and size for the capture animation
 */
export function calculateAnimationPositions(
  canvasElement: HTMLElement,
  imageCount: number,
  isMobile: boolean,
  /**
   * A target worked out by the caller, used as-is. Desktop passes one: its slot
   * animates open over the whole flight, so its live rect is useless here — see
   * measureDesktopSlotRect in lib/toolbar-geometry.ts.
   */
  targetOverride?: Rect | null,
): { source: Rect; target: Rect } {
  // Get canvas bounding box as source
  const canvasRect = canvasElement.getBoundingClientRect()
  const source: Rect = {
    top: canvasRect.top,
    left: canvasRect.left,
    width: canvasRect.width,
    height: canvasRect.height,
  }

  if (targetOverride) return { source, target: targetOverride }

  // The mobile bar keeps a zero-opacity placeholder in the thumbnail slot, so
  // this resolves even on the first capture. Skip anything with no layout box:
  // a CSS-hidden control bar would otherwise hand back a 0x0 target.
  const thumbnailButton =
    [...document.querySelectorAll("[data-capture-target]")].find(
      (el) => el.getBoundingClientRect().width > 0,
    ) ?? document.querySelector('[aria-label="View latest capture"]')

  if (thumbnailButton) {
    const thumbRect = thumbnailButton.getBoundingClientRect()
    const target: Rect = {
      top: thumbRect.top,
      left: thumbRect.left,
      width: thumbRect.width,
      height: thumbRect.height,
      radius: readRadius(thumbnailButton, thumbRect.width, thumbRect.height),
    }
    return { source, target }
  }

  // Fallback if neither element is in the DOM. Both bars keep a real target in
  // the tree at all times, so this should not fire.
  //
  // Desktop derives rather than duplicating: its geometry lives next to the
  // toolbar that owns it, which is also the path the caller normally takes.
  if (!isMobile) {
    const derived = measureDesktopSlotRect()
    if (derived) return { source, target: derived }
  }

  // Circle in the lower row of the mobile control bar, at its left edge. Still
  // hand-copied, so it has to be kept in step with mobile-nav.tsx.
  const size = 44
  const target: Rect = {
    top: window.innerHeight - 16 - size,
    left: 24, // px-6 = 24px
    width: size,
    height: size,
    // Clamped to a circle the same way readRadius clamps the measured value.
    radius: size / 2,
  }

  return { source, target }
}
