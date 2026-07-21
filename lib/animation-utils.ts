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
): { source: Rect; target: Rect } {
  // Get canvas bounding box as source
  const canvasRect = canvasElement.getBoundingClientRect()
  const source: Rect = {
    top: canvasRect.top,
    left: canvasRect.left,
    width: canvasRect.width,
    height: canvasRect.height,
  }

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

  // Fallback if neither element is in the DOM. Mirrors the thumbnail geometry
  // by hand, so it has to be kept in step with mobile-nav.tsx / capture-thumbnails.tsx.
  let thumbWidth: number
  let thumbHeight: number
  let targetTop: number
  let targetLeft: number
  let targetRadius: number

  if (isMobile) {
    // Square, bottom-left, vertically centred in the 68px control bar.
    thumbWidth = 56
    thumbHeight = 56
    targetTop = window.innerHeight - 16 - 68 + (68 - thumbHeight) / 2
    targetLeft = 24 // px-6 = 24px
    targetRadius = 8
  } else {
    // Aspect-ratio preserving rounded rect, bottom-left.
    thumbHeight = 80
    thumbWidth = thumbHeight * (source.width / source.height)
    targetTop = window.innerHeight - 16 - thumbHeight // bottom-4 = 16px
    targetLeft = 24 // left-6 = 24px
    targetRadius = 8
  }

  const target: Rect = {
    top: targetTop,
    left: targetLeft,
    width: thumbWidth,
    height: thumbHeight,
    radius: targetRadius,
  }

  return { source, target }
}
