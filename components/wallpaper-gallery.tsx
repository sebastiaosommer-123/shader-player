"use client"

import { useState, useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { motion, useReducedMotion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CapturedImage } from "@/lib/types"
import { downloadImage } from "@/lib/canvas-capture"
import { playDigitalClick } from "@/lib/audio-feedback"
import { playDownloadConfirmation } from "@/lib/download-audio"
import { BurningImage } from "@/components/burning-image"
import { ScanLineOverlay } from "@/components/scan-line-overlay"

interface WallpaperGalleryProps {
  images: CapturedImage[]
  onClose: () => void
  onDelete: (id: string) => void
  onDeleteStart?: (id: string) => void
  initialIndex?: number
  openedImageId: string
}

export function WallpaperGallery({
  images,
  onClose,
  onDelete,
  onDeleteStart,
  initialIndex = 0,
  openedImageId,
}: WallpaperGalleryProps) {
  const reversedImages = [...images].reverse()

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageVisible, setImageVisible] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBurnReady, setIsBurnReady] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [slideX, setSlideX] = useState(0)
  const [slideTransition, setSlideTransition] = useState(true)
  const isNavigatingRef = useRef(false)

  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (currentIndex >= reversedImages.length && reversedImages.length > 0) {
      setCurrentIndex(reversedImages.length - 1)
    } else if (reversedImages.length === 0) {
      onClose()
    }
  }, [reversedImages.length, currentIndex, onClose])

  useEffect(() => {
    if (!isNavigatingRef.current) {
      setImageVisible(true)
      setSlideX(0)
      setSlideTransition(true)
      setIsDeleting(false)
      setIsBurnReady(false)
      setIsScanning(false)
    }
  }, [currentIndex])

  const currentImage = reversedImages[currentIndex]
  if (!currentImage) return null

  const handlePrevious = () => {
    playDigitalClick("strong")
    if (prefersReducedMotion) {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reversedImages.length - 1))
      return
    }
    isNavigatingRef.current = true
    setSlideTransition(true)
    setSlideX(30)
    setImageVisible(false)
    setTimeout(() => {
      flushSync(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reversedImages.length - 1))
        setSlideTransition(false)
        setSlideX(-30)
      })
      setTimeout(() => {
        setSlideTransition(true)
        setSlideX(0)
        setImageVisible(true)
        setTimeout(() => { isNavigatingRef.current = false }, 250)
      }, 16)
    }, 150)
  }

  const handleNext = () => {
    playDigitalClick("strong")
    if (prefersReducedMotion) {
      setCurrentIndex((prev) => (prev < reversedImages.length - 1 ? prev + 1 : 0))
      return
    }
    isNavigatingRef.current = true
    setSlideTransition(true)
    setSlideX(-30)
    setImageVisible(false)
    setTimeout(() => {
      flushSync(() => {
        setCurrentIndex((prev) => (prev < reversedImages.length - 1 ? prev + 1 : 0))
        setSlideTransition(false)
        setSlideX(30)
      })
      setTimeout(() => {
        setSlideTransition(true)
        setSlideX(0)
        setImageVisible(true)
        setTimeout(() => { isNavigatingRef.current = false }, 250)
      }, 16)
    }, 150)
  }

  const handleDownload = () => {
    playDigitalClick("strong")
    if (!currentImage) return
    if (prefersReducedMotion) {
      downloadImage(currentImage.dataUrl, currentImage.params as any, currentImage.timestamp)
      playDownloadConfirmation("strong")
      return
    }
    setIsScanning(true)
  }

  const handleDelete = () => {
    playDigitalClick("strong")
    if (currentImage) {
      if (prefersReducedMotion) {
        onDeleteStart?.(currentImage.id)
        onDelete(currentImage.id)
        return
      }
      setIsDeleting(true)
      onDeleteStart?.(currentImage.id)
    }
  }

  const handleBurnReady = () => setIsBurnReady(true)

  const handleBurnComplete = () => {
    if (currentImage) {
      setImageVisible(false)
      onDelete(currentImage.id)
      const newLength = reversedImages.length - 1
      if (newLength === 0) {
        setTimeout(() => onClose(), 150)
      } else if (currentIndex >= newLength) {
        setCurrentIndex(newLength - 1)
      }
      setIsDeleting(false)
      setIsBurnReady(false)
      setTimeout(() => setImageVisible(true), 50)
    }
  }

  const handleClose = () => {
    playDigitalClick("strong")
    onClose()
  }

  const handleScanComplete = () => {
    if (currentImage) {
      downloadImage(currentImage.dataUrl, currentImage.params as any, currentImage.timestamp)
      playDownloadConfirmation("strong")
      setIsScanning(false)
    }
  }

  const displayCount = isDeleting ? Math.max(0, reversedImages.length - 1) : reversedImages.length
  let displayIndex = currentIndex
  if (isDeleting && displayCount > 0 && currentIndex >= displayCount) {
    displayIndex = Math.max(0, displayCount - 1)
  }

  const springTransition = { type: "spring" as const, stiffness: 280, damping: 28 }
  const reducedTransition = { duration: 0.15, ease: "easeInOut" as const }

  return (
    <div className="fixed inset-0 z-50">
      {/* Background — fades in/out independently */}
      <motion.div
        className="fixed inset-0 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={prefersReducedMotion ? reducedTransition : { duration: 0.25, ease: "easeOut" }}
      />

      {/* Image container — shared element transition from thumbnail */}
      <motion.div
        layoutId={`gallery-container-${openedImageId}`}
        className="fixed inset-0 overflow-hidden"
        style={{ borderRadius: 0 }}
        transition={prefersReducedMotion ? reducedTransition : springTransition}
        onClick={handleClose}
      >
        {currentImage && (
          <img
            src={currentImage.dataUrl || "/placeholder.svg"}
            alt={`Captured frame ${currentIndex + 1}`}
            className="w-full h-full object-contain"
            style={
              prefersReducedMotion
                ? { opacity: imageVisible ? 1 : 0, transition: "opacity 150ms ease-in-out" }
                : {
                    opacity: isBurnReady ? 0 : imageVisible ? 1 : 0,
                    transform: `translateX(${slideX}px)`,
                    transition: slideTransition
                      ? "transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms ease-out"
                      : "none",
                  }
            }
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {isDeleting && currentImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <BurningImage src={currentImage.dataUrl} onComplete={handleBurnComplete} onReady={handleBurnReady} />
          </div>
        )}

        {isScanning && currentImage && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <ScanLineOverlay src={currentImage.dataUrl} onComplete={handleScanComplete} />
          </div>
        )}
      </motion.div>

      {/* UI controls — fade in after image settles */}
      <motion.div
        className="fixed inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18, delay: 0 } }}
        transition={
          prefersReducedMotion
            ? reducedTransition
            : { duration: 0.18, delay: 0.3, ease: "easeOut" }
        }
      >
        {displayCount > 0 && (
          <Button
            onClick={(e) => { e.stopPropagation(); handleClose() }}
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 pointer-events-auto cursor-pointer rounded-full bg-black/40 border border-white/20 hoverFine:bg-black/20 size-11 transition-[background-color,transform] duration-150 active:scale-[0.97]"
            aria-label="Close gallery"
          >
            <X className="h-6 w-6" />
          </Button>
        )}

        {currentImage && (
          <>
            {displayCount > 0 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full font-medium bg-[rgba(10,10,10,0.27)] px-3 py-1.5 text-sm">
                {displayIndex + 1} / {displayCount}
              </div>
            )}

            {reversedImages.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handlePrevious() }}
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer h-12 w-12 rounded-full bg-black/40 border border-white/20 hoverFine:bg-black/20 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                )}

                {currentIndex < reversedImages.length - 1 && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleNext() }}
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer rounded-full bg-black/40 border border-white/20 hoverFine:bg-black/20 w-11 h-11 transition-[background-color,transform] duration-150 active:scale-[0.97]"
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                )}
              </>
            )}

            {displayCount > 0 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleDelete() }}
                  className="pointer-events-auto cursor-pointer !pl-4 !pr-5 rounded-full text-white bg-[rgba(202,82,82,1)] h-11 text-sm hoverFine:brightness-110 active:scale-[0.97] transition-[filter,transform] duration-150 font-medium"
                >
                  <Trash2 className="h-5 w-5" />
                  Delete
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleDownload() }}
                  className="pointer-events-auto cursor-pointer !pl-4 !pr-5 rounded-full text-foreground bg-background h-11 text-sm hoverFine:bg-accent active:scale-[0.97] transition-[background-color,transform] duration-150 font-medium"
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                >
                  <Download className="h-5 w-5" />
                  Download
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
