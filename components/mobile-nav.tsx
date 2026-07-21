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
      <div
        className="md:hidden fixed inset-x-0 z-40 flex items-center justify-between px-6"
        style={{
          bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
          height: CAPTURE_SIZE,
        }}
      >
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
              count={visibleImages.length}
              onClick={handleThumbnailClick}
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
          className="group absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full border-2 border-background bg-transparent p-1 shadow-none transition-[opacity,transform] hoverFine:bg-transparent"
          aria-label="Capture frame"
          style={{ ...hideWhileSheetOpen(150), width: CAPTURE_SIZE, height: CAPTURE_SIZE }}
        >
          <span className="size-full rounded-full bg-background transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
        </button>

        <button
          onClick={() => {
            playDigitalClick("strong")
            setSheetOpen(true)
          }}
          className="flex items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg transition-[opacity,transform] hoverFine:bg-accent active:scale-[0.97]"
          aria-label="Shader controls"
          style={{ ...hideWhileSheetOpen(180), width: FILTERS_SIZE, height: FILTERS_SIZE }}
        >
          <SlidersIcon size={20} />
        </button>
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
