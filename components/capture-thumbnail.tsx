"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { playDigitalClick } from "@/lib/audio-feedback"

export const THUMBNAIL_RADIUS = 8

interface CaptureThumbnailProps {
  image: CapturedImage
  width: number
  height: number
  onClick: () => void
  /**
   * Lift off the backdrop. Wanted on desktop, where the thumbnail floats over
   * the shader; unwanted in the mobile bar, which is already an opaque surface.
   */
  elevated?: boolean
}

/**
 * The captured-image thumbnail itself, without any positioning. The mobile bar
 * and the desktop corner render this at different sizes — but only ever one at
 * a time, since two elements sharing a layoutId would break the gallery morph.
 */
export function CaptureThumbnail({ image, width, height, onClick, elevated = true }: CaptureThumbnailProps) {
  const prefersReducedMotion = useReducedMotion()

  const handleClick = () => {
    playDigitalClick("strong")
    onClick()
  }

  return (
    <motion.div
      layoutId={prefersReducedMotion ? undefined : `gallery-container-${image.id}`}
      onClick={handleClick}
      className="cursor-pointer relative group overflow-hidden active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
      style={{
        width,
        height,
        borderRadius: THUMBNAIL_RADIUS,
        boxShadow: elevated ? "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
      }}
      transition={prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 35 }}
      aria-label="View latest capture"
      role="button"
      // The capture animation reads this element's rect and corner radius to
      // work out where and how to land.
      data-capture-target
    >
      <img
        src={image.dataUrl || "/placeholder.svg"}
        alt="Latest capture"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-white/0 group-hoverFine:bg-white/10 transition-colors duration-150 pointer-events-none" />
    </motion.div>
  )
}
