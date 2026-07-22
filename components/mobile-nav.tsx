"use client"

import { useState } from "react"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { CapturedImage } from "@/lib/types"
import { ControlsSheet } from "./controls-sheet"
import { CaptureThumbnail, THUMBNAIL_RADIUS } from "./capture-thumbnail"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useReducedMotion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"
import { useIcon } from "@/lib/icon-context"

/** Matches the iOS camera proportions: shutter ring, square thumb, round control. */
const CAPTURE_SIZE = 68
const THUMBNAIL_SIZE = 44
const FILTERS_SIZE = 44

interface MobileNavProps {
  onCapture: () => void
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
  images: CapturedImage[]
  onThumbnailClick: (imageIndex: number) => void
  isCapturing?: boolean
  hiddenImageId?: string | null
}

export function MobileNav({
  onCapture,
  params,
  setParams,
  shaderId,
  onShaderChange,
  images,
  onThumbnailClick,
  isCapturing = false,
  hiddenImageId,
}: MobileNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const prefersReducedMotion = useReducedMotion()
  const isMobile = useIsMobile()
  const SlidersIcon = useIcon("sliders-horizontal")

  const hiddenTransform = sheetOpen && !prefersReducedMotion ? "scale(0.97)" : "scale(1)"
  const hideWhileSheetOpen = (duration: number) => ({
    opacity: sheetOpen ? 0 : 1,
    transform: hiddenTransform,
    pointerEvents: sheetOpen ? ("none" as const) : ("auto" as const),
    transitionDuration: prefersReducedMotion ? "0ms" : `${duration}ms`,
    transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
  })

  const visibleImages = hiddenImageId
    ? images.filter((img) => img.id !== hiddenImageId)
    : images
  const latestImage = visibleImages[visibleImages.length - 1]
  const showThumbnail = isMobile && !!latestImage && !isCapturing

  const handleThumbnailClick = () => {
    const originalIndex = images.findIndex((img) => img.id === latestImage.id)
    onThumbnailClick(originalIndex !== -1 ? originalIndex : visibleImages.length - 1)
  }

  return (
    <>
      {/* An opaque strip in the normal flow, so the shader ends where the
          controls begin rather than running underneath them.
          `dark` scopes the dark palette to this subtree regardless of the page
          theme (the variant is `&:is(.dark *)`), so the chrome mattes the
          artwork like a gallery wall instead of competing with it — and the
          controls below stay on semantic tokens rather than hardcoded colours. */}
      <div
        className="dark md:hidden shrink-0 bg-background px-6 pt-4"
        style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="relative flex items-center justify-between" style={{ height: CAPTURE_SIZE }}>
          {/* Left slot. The placeholder always occupies the thumbnail's exact
              footprint so the capture animation has a target to fly to even on
              the very first capture, when no thumbnail exists yet. */}
          <div
            className="transition-[opacity,transform]"
            style={hideWhileSheetOpen(180)}
          >
            {showThumbnail ? (
              <CaptureThumbnail
                image={latestImage}
                width={THUMBNAIL_SIZE}
                height={THUMBNAIL_SIZE}
                onClick={handleThumbnailClick}
                elevated={false}
              />
            ) : (
              // Only on mobile: the bar is merely CSS-hidden at wider widths, so
              // an unconditional placeholder would still be in the DOM on desktop
              // and would win the capture-target lookup with a 0x0 rect.
              isMobile && (
                <div
                  data-capture-target
                  aria-hidden
                  className="pointer-events-none opacity-0"
                  style={{
                    width: THUMBNAIL_SIZE,
                    height: THUMBNAIL_SIZE,
                    borderRadius: THUMBNAIL_RADIUS,
                  }}
                />
              )
            )}
          </div>

          {/* Capture. Absolutely centered so the variable-width left slot can
              never pull the shutter off the screen's centre line. */}
          <button
            onClick={() => {
              playDigitalClick("strong")
              onCapture()
            }}
            // Ring deliberately heavier than the gap it encloses: at low contrast
            // a thin ring plus a wide gap reads as two concentric shapes rather
            // than one shutter.
            className="group absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full border-4 border-foreground bg-transparent p-[2px] shadow-none transition-[opacity,transform] hoverFine:bg-transparent"
            aria-label="Capture frame"
            style={{ ...hideWhileSheetOpen(150), width: CAPTURE_SIZE, height: CAPTURE_SIZE }}
          >
            <span className="size-full rounded-full bg-foreground transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
          </button>

          <button
            onClick={() => {
              playDigitalClick("strong")
              setSheetOpen(true)
            }}
            className="flex items-center justify-center rounded-full text-muted-foreground transition-[opacity,transform] active:scale-[0.97]"
            aria-label="Shader controls"
            style={{ ...hideWhileSheetOpen(180), width: FILTERS_SIZE, height: FILTERS_SIZE }}
          >
            <SlidersIcon size={24} strokeWidth={2} />
          </button>
        </div>
      </div>

      <ControlsSheet
        params={params}
        setParams={setParams}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        shaderId={shaderId}
        onShaderChange={onShaderChange}
      />
    </>
  )
}
