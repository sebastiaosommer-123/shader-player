"use client"

import { useEffect, useRef, useState } from "react"
import { motion, useReducedMotion } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GalleryThumbnailStripProps {
  images: CapturedImage[]
  currentIndex: number
  onSelect: (index: number) => void
  orientation: "horizontal" | "vertical"
}

const DESKTOP_SCALES = [1.48, 1.24, 1.1] as const
// Includes the selected frame's border and its 2px inset gap.
const DESKTOP_THUMB_HEIGHT = 56
const SELECTION_SPRING = { type: "spring", duration: 0.28, bounce: 0 } as const

/**
 * The gallery's filmstrip.
 *
 * Desktop gets a restrained Dock-like magnification. The hovered frame stays
 * anchored while its neighbours move away by exactly the extra height the
 * scaled cards need, so the effect reads as a stack making room rather than as
 * thumbnails simply overlapping one another. Mobile is deliberately plain:
 * there are no hover handlers, transforms, or hover-only styles in that branch.
 */
export function GalleryThumbnailStrip({
  images,
  currentIndex,
  onSelect,
  orientation,
}: GalleryThumbnailStripProps) {
  const prefersReducedMotion = useReducedMotion()
  const scrollRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const selectionTransition = prefersReducedMotion ? { duration: 0 } : SELECTION_SPRING
  const isVertical = orientation === "vertical"
  const displayedImages = isVertical ? [...images].reverse() : images

  useEffect(() => {
    const scroller = scrollRef.current
    const item = itemRefs.current[currentIndex]
    if (!scroller || !item) return

    const itemCenter =
      orientation === "vertical"
        ? item.offsetTop + item.offsetHeight / 2
        : item.offsetLeft + item.offsetWidth / 2
    const viewportSize = orientation === "vertical" ? scroller.clientHeight : scroller.clientWidth
    const maxScroll =
      orientation === "vertical"
        ? scroller.scrollHeight - scroller.clientHeight
        : scroller.scrollWidth - scroller.clientWidth

    scroller.scrollTo({
      [orientation === "vertical" ? "top" : "left"]: Math.max(
        0,
        Math.min(itemCenter - viewportSize / 2, maxScroll),
      ),
      behavior: prefersReducedMotion ? "instant" : "smooth",
    })
  }, [currentIndex, images.length, orientation, prefersReducedMotion])

  const desktopScaleFor = (index: number) => {
    if (hoveredIndex === null || prefersReducedMotion) return 1
    return DESKTOP_SCALES[Math.abs(index - hoveredIndex)] ?? 1
  }

  const desktopOffsetFor = (index: number) => {
    if (hoveredIndex === null || prefersReducedMotion || index === hoveredIndex) return 0

    const direction = index < hoveredIndex ? -1 : 1
    const start = Math.min(index, hoveredIndex)
    const end = Math.max(index, hoveredIndex)
    let offset = 0

    for (let cursor = start; cursor < end; cursor += 1) {
      const firstScale = desktopScaleFor(cursor)
      const secondScale = desktopScaleFor(cursor + 1)
      offset += (DESKTOP_THUMB_HEIGHT * (firstScale + secondScale - 2)) / 2
    }

    return direction * offset
  }

  return (
    <nav
      ref={scrollRef}
      aria-label="Captured images"
      className={cn(
        "pointer-events-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isVertical
          ? "h-full w-32 overflow-x-hidden overflow-y-auto"
          : "w-full overflow-x-auto overflow-y-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
      )}
      onClick={(event) => event.stopPropagation()}
      onMouseLeave={isVertical ? () => setHoveredIndex(null) : undefined}
    >
      <div
        className={cn(
          "flex",
          isVertical
            ? "min-h-full flex-col items-end justify-center gap-2 py-10 pl-12 pr-4"
            : "w-max min-w-full items-center justify-center gap-2 px-1",
        )}
      >
        {displayedImages.map((image, displayIndex) => {
          const imageIndex = isVertical ? images.length - 1 - displayIndex : displayIndex
          const selected = imageIndex === currentIndex
          const scale = isVertical ? desktopScaleFor(displayIndex) : 1
          const offset = isVertical ? desktopOffsetFor(displayIndex) : 0

          return (
            <motion.button
              key={image.id}
              ref={(node) => { itemRefs.current[imageIndex] = node }}
              type="button"
              aria-label={`Show captured image ${imageIndex + 1} of ${images.length}`}
              aria-current={selected ? "true" : undefined}
              className={cn(
                "relative shrink-0 cursor-pointer border-2 p-0.5 outline-none",
                "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
                "border-transparent",
                isVertical ? "h-14 w-20 origin-right" : "h-16 w-[5.75rem] rounded-[5px]",
              )}
              animate={
                isVertical
                  ? { scale, y: offset }
                  : undefined
              }
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { type: "spring", duration: 0.22, bounce: 0 }
              }
              whileTap={prefersReducedMotion ? undefined : { scale: isVertical ? scale * 0.97 : 0.97 }}
              onMouseEnter={isVertical ? () => setHoveredIndex(displayIndex) : undefined}
              onFocus={isVertical ? () => setHoveredIndex(displayIndex) : undefined}
              onBlur={isVertical ? () => setHoveredIndex(null) : undefined}
              onClick={() => onSelect(imageIndex)}
            >
              {selected && (
                <motion.div
                  layoutId={`gallery-thumbnail-selection-${orientation}`}
                  data-gallery-thumbnail-selection
                  className="pointer-events-none absolute inset-0 z-10 border-2 border-foreground"
                  style={{ borderRadius: isVertical ? 0 : 5 }}
                  transition={selectionTransition}
                />
              )}
              <img
                src={image.dataUrl || "/placeholder.svg"}
                alt=""
                className="block size-full rounded-[2px] object-cover"
                draggable={false}
              />
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
