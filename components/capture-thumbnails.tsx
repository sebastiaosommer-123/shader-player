"use client"

import { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { playDigitalClick } from "@/lib/audio-feedback"

interface CaptureThumbnailsProps {
  images: CapturedImage[]
  onClick: (imageIndex: number) => void
  isCapturing?: boolean
  hiddenImageId?: string | null
}

export function CaptureThumbnails({ images, onClick, isCapturing = false, hiddenImageId }: CaptureThumbnailsProps) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const visibleImages = hiddenImageId
    ? images.filter((img) => img.id !== hiddenImageId)
    : images

  if (visibleImages.length === 0 || isCapturing) return null

  const latestImage = visibleImages[visibleImages.length - 1]
  const latestIndex = visibleImages.length - 1

  const maxHeight = isMobile ? 60 : 80
  const aspectRatio = latestImage.width / latestImage.height
  const thumbHeight = maxHeight
  const thumbWidth = thumbHeight * aspectRatio

  const handleThumbnailClick = () => {
    playDigitalClick("strong")
    const originalIndex = images.findIndex((img) => img.id === latestImage.id)
    onClick(originalIndex !== -1 ? originalIndex : latestIndex)
  }

  return (
    <div
      className={`fixed z-10 ${isMobile ? "top-4 left-1/2 -translate-x-1/2" : "bottom-4 left-6"}`}
      aria-label="View most recent capture"
    >
      <motion.div
        layoutId={`gallery-container-${latestImage.id}`}
        onClick={handleThumbnailClick}
        whileTap={{ scale: 0.97 }}
        className="cursor-pointer relative group overflow-hidden"
        style={{
          width: thumbWidth,
          height: thumbHeight,
          borderRadius: 8,
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)",
        }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        aria-label="View latest capture"
        role="button"
      >
        <img
          src={latestImage.dataUrl || "/placeholder.svg"}
          alt="Latest capture"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-150 pointer-events-none" />
      </motion.div>

      {visibleImages.length > 1 && (
        <div
          className="absolute bg-black/80 text-white text-xs font-semibold px-2 py-1 rounded-full pointer-events-none"
          style={{ bottom: -8, right: -8 }}
        >
          {visibleImages.length}
        </div>
      )}
    </div>
  )
}
