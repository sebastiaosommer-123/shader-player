"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import type { CapturedImage } from "@/lib/types"
import { CaptureThumbnail } from "./capture-thumbnail"

interface CaptureThumbnailsProps {
  images: CapturedImage[]
  onClick: (imageIndex: number) => void
  isCapturing?: boolean
  hiddenImageId?: string | null
}

const MAX_HEIGHT = 80

/**
 * Desktop-only. On mobile the thumbnail lives inside the bottom control bar
 * (see mobile-nav.tsx) so all three camera controls share one baseline — and
 * gating both on the same hook keeps a single layoutId in the tree.
 */
export function CaptureThumbnails({ images, onClick, isCapturing = false, hiddenImageId }: CaptureThumbnailsProps) {
  const isMobile = useIsMobile()

  const visibleImages = hiddenImageId
    ? images.filter((img) => img.id !== hiddenImageId)
    : images

  if (isMobile || visibleImages.length === 0 || isCapturing) return null

  const latestImage = visibleImages[visibleImages.length - 1]
  const latestIndex = visibleImages.length - 1

  const aspectRatio = latestImage.width / latestImage.height

  const handleClick = () => {
    const originalIndex = images.findIndex((img) => img.id === latestImage.id)
    onClick(originalIndex !== -1 ? originalIndex : latestIndex)
  }

  return (
    <div className="fixed z-10 bottom-4 left-6">
      <CaptureThumbnail
        image={latestImage}
        width={MAX_HEIGHT * aspectRatio}
        height={MAX_HEIGHT}
        onClick={handleClick}
      />
    </div>
  )
}
