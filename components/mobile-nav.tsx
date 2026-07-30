"use client"

import { useState } from "react"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { CapturedImage } from "@/lib/types"
import { ControlsSheet } from "./controls-sheet"
import { CaptureThumbnail } from "./capture-thumbnail"
import { ShaderTabs } from "./shader-tabs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useReducedMotion } from "framer-motion"
import { useIsMobile } from "@/hooks/use-mobile"

/** Matches the iOS camera proportions: shutter ring, round thumb, round control. */
const CAPTURE_SIZE = 68
const THUMBNAIL_SIZE = 44
const FILTERS_SIZE = 48
/**
 * Half the box — a true circle, written as the real radius. Framer's layout
 * projection interpolates this value during the gallery morph, so an oversized
 * sentinel would hold the corner at an ellipse the whole way down.
 */
const THUMBNAIL_RADIUS = THUMBNAIL_SIZE / 2

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
        {/* Two rows: the shutter owns the top one, so it stays on the screen's
            centre line without the absolute positioning it used to need, and the
            row below carries the three things you reach for between shots. */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              playDigitalClick("strong")
              onCapture()
            }}
            // Ring deliberately heavier than the gap it encloses: at low contrast
            // a thin ring plus a wide gap reads as two concentric shapes rather
            // than one shutter.
            className="group flex items-center justify-center rounded-full border-4 border-foreground bg-transparent p-[2px] shadow-none transition-[opacity,transform] hoverFine:bg-transparent"
            aria-label="Capture frame"
            style={{ ...hideWhileSheetOpen(150), width: CAPTURE_SIZE, height: CAPTURE_SIZE }}
          >
            <span className="size-full rounded-full bg-foreground transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
          </button>

          {/* The outer slots are the same width, which is what keeps the tabs
              optically centred under the shutter. */}
          <div className="flex w-full items-center justify-between">
            {/* The placeholder always occupies the thumbnail's exact footprint so
                the capture animation has a target to fly to even on the very
                first capture, when no thumbnail exists yet. */}
            {/* z-10 for the gallery exit: the thumbnail is scaled to the full
                viewport inside this row on the way back, and the tabs and the
                filters button would otherwise paint over it. */}
            {/* The footprint is fixed here rather than left to whatever is
                inside, because what is inside depends on useIsMobile — which
                reports false on the first render and only corrects in an
                effect. Sizing this from its contents meant the row's left slot
                was 0 wide for one paint, and `justify-between` started the tabs
                22px left of centre before sliding them over. */}
            <div
              className="relative z-10 shrink-0 transition-[opacity,transform]"
              style={{ ...hideWhileSheetOpen(180), width: THUMBNAIL_SIZE, height: THUMBNAIL_SIZE }}
            >
              {showThumbnail ? (
                <CaptureThumbnail
                  image={latestImage}
                  width={THUMBNAIL_SIZE}
                  height={THUMBNAIL_SIZE}
                  radius={THUMBNAIL_RADIUS}
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

            <div className="transition-[opacity,transform]" style={hideWhileSheetOpen(180)}>
              <ShaderTabs
                shaderId={shaderId}
                onShaderChange={onShaderChange}
                layoutIdPrefix="mobile"
                size="mobile"
              />
            </div>

            <button
              onClick={() => {
                playDigitalClick("strong")
                setSheetOpen(true)
              }}
              className="flex items-center justify-center rounded-full bg-foreground/[0.06] text-muted-foreground transition-[color,opacity,transform] hoverFine:text-foreground active:scale-[0.97]"
              aria-label="Shader controls"
              style={{ ...hideWhileSheetOpen(180), width: FILTERS_SIZE, height: FILTERS_SIZE }}
            >
              <span
                aria-hidden
                className="size-5 bg-current"
                style={{
                  WebkitMask: "url(/filter.svg?v=2) center / contain no-repeat",
                  mask: "url(/filter.svg?v=2) center / contain no-repeat",
                }}
              />
            </button>
          </div>
        </div>
      </div>

      <ControlsSheet
        params={params}
        setParams={setParams}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        shaderId={shaderId}
      />
    </>
  )
}
