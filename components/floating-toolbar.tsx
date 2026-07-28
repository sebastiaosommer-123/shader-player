"use client"

import type { CapturedImage } from "@/lib/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { Elevated } from "@/lib/elevated"
import { captureFlight } from "@/lib/springs"
import { BAR_GAP, SLOT_RADIUS, SLOT_SIZE } from "@/lib/toolbar-geometry"
import { cn } from "@/lib/utils"
import { CaptureButton } from "./capture-button"
import { CaptureThumbnail } from "./capture-thumbnail"
import { ShaderTabs } from "./shader-tabs"

interface FloatingToolbarProps {
  shaderId: string
  onShaderChange: (shaderId: string) => void
  onCapture: () => void
  images: CapturedImage[]
  onThumbnailClick: (imageIndex: number) => void
  isCapturing?: boolean
  hiddenImageId?: string | null
  /** Whether to render the thumbnail slot at all — see app/page.tsx. */
  hasSlot: boolean
}

/**
 * Desktop's floating control bar: every shader and the shutter, permanently on
 * screen, with captures landing in the slot on its left.
 *
 * Unlike the rest of the chrome that floats over the artwork, this one is *not*
 * pinned to the dark palette — it follows the page theme, so it must stay a
 * sibling of the canvas rather than a child of the `dark`-scoped wrapper in
 * app/page.tsx.
 */
export function FloatingToolbar({
  shaderId,
  onShaderChange,
  onCapture,
  images,
  onThumbnailClick,
  isCapturing = false,
  hiddenImageId,
  hasSlot,
}: FloatingToolbarProps) {
  // This bar is only CSS-hidden on mobile, so without a JS gate its thumbnail
  // would stay mounted alongside the mobile bar's — two elements claiming one
  // layoutId, which makes Framer blank whichever it decides is the stale copy.
  const isMobile = useIsMobile()

  const visibleImages = hiddenImageId ? images.filter((img) => img.id !== hiddenImageId) : images
  const latestImage = visibleImages[visibleImages.length - 1]
  const showThumbnail = !isMobile && !!latestImage && !isCapturing

  const handleThumbnailClick = () => {
    const originalIndex = images.findIndex((img) => img.id === latestImage.id)
    onThumbnailClick(originalIndex !== -1 ? originalIndex : visibleImages.length - 1)
  }

  return (
    // The bar widens the first time a capture lands, on the same curve and over
    // the same duration as the frame's flight — so the slot finishes opening at
    // the moment the frame arrives in it, and the bar reads as making room.
    //
    // The flight target can no longer be measured off the slot, since the slot
    // is in motion for as long as the frame is; lib/toolbar-geometry.ts derives
    // the resting position instead.
    <Elevated
      data-floating-toolbar
      offset={2}
      shadowLevel={3}
      className="hidden md:flex fixed bottom-6 left-1/2 -translate-x-1/2 z-10 items-center gap-2 rounded-full p-1.5"
    >
      {/* The slot, mounted whether or not there is anything in it — an element
          that isn't there can't animate its way in, and this has to collapse
          again when the last capture is deleted. Width rather than display: the
          bar is content-sized and centred, so the bar's own resize falls out of
          this one, pushing both its edges outward as the slot opens. The
          negative margin swallows the flex gap while closed, which would
          otherwise leave 8px of dead space at rest. */}
      <div
        className={cn(
          // Above the tabs and the shutter: on the way out of the gallery the
          // thumbnail is scaled to the full viewport inside this bar, and its
          // later siblings would otherwise paint straight over the top of it.
          "relative z-10 shrink-0 transition-[width,margin-right] motion-reduce:transition-none",
          // Clipping is only wanted while the slot is shut, to keep anything
          // inside from spilling over the tabs. Once open it has to let content
          // escape: the thumbnail's layoutId morph scales it to full-screen on
          // the way into the gallery, and a 48px clip would crop that flat.
          hasSlot ? "overflow-visible" : "overflow-hidden",
        )}
        style={{
          width: hasSlot ? SLOT_SIZE : 0,
          marginRight: hasSlot ? 0 : -BAR_GAP,
          height: SLOT_SIZE,
          transitionDuration: `${captureFlight.durationMs}ms`,
          transitionTimingFunction: captureFlight.easing,
        }}
      >
        {showThumbnail && (
          <CaptureThumbnail
            image={latestImage}
            width={SLOT_SIZE}
            height={SLOT_SIZE}
            radius={SLOT_RADIUS}
            // The bar is already an opaque surface; a drop shadow here would
            // read as a sticker sitting on it.
            elevated={false}
            onClick={handleThumbnailClick}
          />
        )}
      </div>

      <ShaderTabs shaderId={shaderId} onShaderChange={onShaderChange} layoutIdPrefix="desktop" />

      <CaptureButton onCapture={onCapture} />
    </Elevated>
  )
}
