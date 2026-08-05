"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { useIsMobile } from "@/hooks/use-mobile"
import { Elevated } from "@/lib/elevated"
import { captureFlash, spring } from "@/lib/springs"
import { BAR_GAP, SLOT_RADIUS, SLOT_SIZE } from "@/lib/toolbar-geometry"
import { cn } from "@/lib/utils"
import { CaptureButton } from "./capture-button"
import { CaptureSlot } from "./capture-slot"
import { ShaderTabs } from "./shader-tabs"

interface FloatingToolbarProps {
  shaderId: string
  onShaderChange: (shaderId: string) => void
  onCapture: () => void
  images: CapturedImage[]
  onThumbnailClick: (imageIndex: number) => void
  /** Whether to render the thumbnail slot at all — see app/page.tsx. */
  hasSlot: boolean
  /** Passed straight through to the thumbnail; see CaptureThumbnail. */
  suppressMorph?: boolean
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
  hasSlot,
  suppressMorph,
}: FloatingToolbarProps) {
  // This bar is only CSS-hidden on mobile, so without a JS gate its thumbnail
  // would stay mounted alongside the mobile bar's — two elements claiming one
  // layoutId, which makes Framer blank whichever it decides is the stale copy.
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()

  const latestImage = images[images.length - 1]
  const showThumbnail = !isMobile && !!latestImage

  const handleThumbnailClick = () => {
    const originalIndex = images.findIndex((img) => img.id === latestImage.id)
    onThumbnailClick(originalIndex !== -1 ? originalIndex : images.length - 1)
  }

  return (
    // The bar widens the first time a capture lands, on the same spring the
    // thumbnail arrives on — so the two read as one gesture: the bar making
    // room, and the frame taking it.
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
      <motion.div
        className={cn(
          // Above the tabs and the shutter: on the way out of the gallery the
          // thumbnail is scaled to the full viewport inside this bar, and its
          // later siblings would otherwise paint straight over the top of it.
          "relative z-10 shrink-0",
          // Never clipped while open, and it doesn't need to be: the thumbnail
          // is centred and scales from 0 on this same spring, so it is exactly
          // as wide as the slot at every frame. Letting content escape is a
          // requirement, not an oversight — the thumbnail's layoutId morph
          // scales it to full-screen on the way into the gallery, and a 48px
          // clip would crop that flat. Clipping only while shut, to keep a
          // zero-width slot from leaking anything over the tabs.
          hasSlot ? "overflow-visible" : "overflow-hidden",
        )}
        // Animating layout properties rather than a transform, knowingly —
        // see the note above on why the width is the point. One 48px box on a
        // 160ms spring.
        //
        // initial={false} so a reload with captures already in hand paints the
        // slot open instead of animating it open.
        initial={false}
        animate={{ width: hasSlot ? SLOT_SIZE : 0, marginRight: hasSlot ? 0 : -BAR_GAP }}
        // Same spring and same delay as the thumbnail it is making room for, so
        // the two are one gesture — and so the slot's width and the thumbnail's
        // scale are the same number at every frame. Only the opening waits on
        // the flash; closing is a deletion, unrelated to the shutter.
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { ...spring.moderate, delay: hasSlot ? captureFlash.holdEndMs / 1000 : 0 }
        }
        style={{ height: SLOT_SIZE }}
      >
        {showThumbnail && (
          <CaptureSlot
            image={latestImage}
            previous={images[images.length - 2]}
            width={SLOT_SIZE}
            height={SLOT_SIZE}
            radius={SLOT_RADIUS}
            // The bar is already an opaque surface; a drop shadow here would
            // read as a sticker sitting on it.
            elevated={false}
            suppressMorph={suppressMorph}
            onClick={handleThumbnailClick}
          />
        )}
      </motion.div>

      <ShaderTabs shaderId={shaderId} onShaderChange={onShaderChange} layoutIdPrefix="desktop" />

      <CaptureButton onCapture={onCapture} />
    </Elevated>
  )
}
