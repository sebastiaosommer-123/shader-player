export interface Rect {
  top: number
  left: number
  width: number
  height: number
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

  const thumbnailButton = document.querySelector('[aria-label="View latest capture"]')

  if (thumbnailButton) {
    const thumbRect = thumbnailButton.getBoundingClientRect()
    const target: Rect = {
      top: thumbRect.top,
      left: thumbRect.left,
      width: thumbRect.width,
      height: thumbRect.height,
    }
    return { source, target }
  }

  // Fallback calculation if thumbnail doesn't exist yet
  const maxHeight = isMobile ? 60 : 80
  const aspectRatio = source.width / source.height
  const thumbHeight = maxHeight
  const thumbWidth = thumbHeight * aspectRatio

  let targetTop: number
  let targetLeft: number

  if (isMobile) {
    // Top-center position
    targetTop = 16 // top-4 = 16px
    targetLeft = window.innerWidth / 2 - thumbWidth / 2
  } else {
    // Bottom-left position
    targetTop = window.innerHeight - 16 - thumbHeight // bottom-4 = 16px
    targetLeft = 24 // left-6 = 24px
  }

  const target: Rect = {
    top: targetTop,
    left: targetLeft,
    width: thumbWidth,
    height: thumbHeight,
  }

  return { source, target }
}
