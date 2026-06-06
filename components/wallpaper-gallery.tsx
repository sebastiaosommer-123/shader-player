"use client"

import { useState, useEffect, useRef } from "react"
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
  isOpen: boolean
  onClose: () => void
  onDelete: (id: string) => void
  onDeleteStart?: (id: string) => void
  initialIndex?: number
  originRect?: DOMRect | null
}

function getGalleryTransform(rect: DOMRect): string {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scaleX = rect.width / vw
  const scaleY = rect.height / vh
  const tx = rect.left + rect.width / 2 - vw / 2
  const ty = rect.top + rect.height / 2 - vh / 2
  return `translate(${tx}px, ${ty}px) scale(${scaleX}, ${scaleY})`
}

function getGalleryBorderRadius(rect: DOMRect): string {
  const scaleX = rect.width / window.innerWidth
  const scaleY = rect.height / window.innerHeight
  return `${(8 / scaleX).toFixed(2)}px / ${(8 / scaleY).toFixed(2)}px`
}

export function WallpaperGallery({
  images,
  isOpen,
  onClose,
  onDelete,
  onDeleteStart,
  initialIndex = 0,
  originRect,
}: WallpaperGalleryProps) {
  const reversedImages = [...images].reverse()

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [imageVisible, setImageVisible] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBurnReady, setIsBurnReady] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  const storedOriginRect = useRef<DOMRect | null>(null)
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(() => {
    if (isOpen && originRect) {
      storedOriginRect.current = originRect
    }
  }, [isOpen, originRect])

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setShouldRender(true)
      const timeout = setTimeout(() => {
        setIsVisible(true)
        setImageVisible(true)
      }, 0)
      return () => clearTimeout(timeout)
    } else {
      setIsVisible(false)
      const timeout = setTimeout(() => {
        setShouldRender(false)
      }, 400)
      return () => clearTimeout(timeout)
    }
  }, [isOpen, initialIndex])

  useEffect(() => {
    if (currentIndex >= reversedImages.length && reversedImages.length > 0) {
      setCurrentIndex(reversedImages.length - 1)
    } else if (reversedImages.length === 0) {
      onClose()
    }
  }, [reversedImages.length, currentIndex, onClose])

  useEffect(() => {
    if (shouldRender) {
      setImageVisible(true)
      setIsDeleting(false)
      setIsBurnReady(false)
      setIsScanning(false)
    }
  }, [currentIndex, shouldRender])

  if (!shouldRender) return null

  const currentImage = reversedImages[currentIndex]
  if (!currentImage) return null

  const handlePrevious = () => {
    playDigitalClick("strong")
    setImageVisible(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : reversedImages.length - 1))
    }, 150)
  }

  const handleNext = () => {
    playDigitalClick("strong")
    setImageVisible(false)
    setTimeout(() => {
      setCurrentIndex((prev) => (prev < reversedImages.length - 1 ? prev + 1 : 0))
    }, 150)
  }

  const handleDownload = () => {
    playDigitalClick("strong")
    if (currentImage) {
      setIsScanning(true)
    }
  }

  const handleDelete = () => {
    playDigitalClick("strong")
    if (currentImage) {
      setIsDeleting(true)
      onDeleteStart?.(currentImage.id)
    }
  }

  const handleBurnReady = () => {
    setIsBurnReady(true)
  }

  const handleBurnComplete = () => {
    if (currentImage) {
      setImageVisible(false)
      onDelete(currentImage.id)
      const newLength = reversedImages.length - 1
      if (newLength === 0) {
        setIsVisible(false)
        setTimeout(() => {
          onClose()
        }, 150)
      } else if (currentIndex >= newLength) {
        setCurrentIndex(newLength - 1)
      }
      setIsDeleting(false)
      setIsBurnReady(false)
      setTimeout(() => {
        setImageVisible(true)
      }, 50)
    }
  }

  const handleClose = () => {
    playDigitalClick("strong")
    onClose()
  }

  const displayCount = isDeleting ? Math.max(0, reversedImages.length - 1) : reversedImages.length

  let displayIndex = currentIndex
  if (isDeleting && displayCount > 0) {
    if (currentIndex >= displayCount) {
      displayIndex = Math.max(0, displayCount - 1)
    }
  }

  const handleScanComplete = () => {
    if (currentImage) {
      downloadImage(currentImage.dataUrl, currentImage.params as any, currentImage.timestamp)
      playDownloadConfirmation("strong")
      setIsScanning(false)
    }
  }

  const origin = storedOriginRect.current
  const animationStyle: React.CSSProperties =
    !prefersReducedMotion && origin
      ? {
          transform: isVisible ? "translate(0,0) scale(1,1)" : getGalleryTransform(origin),
          borderRadius: isVisible ? "0px" : getGalleryBorderRadius(origin),
          opacity: isVisible ? 1 : 0,
          transition: isVisible
            ? "transform 500ms cubic-bezier(0.77, 0, 0.175, 1), border-radius 500ms cubic-bezier(0.77, 0, 0.175, 1), opacity 350ms cubic-bezier(0.77, 0, 0.175, 1)"
            : "transform 400ms cubic-bezier(0.77, 0, 0.175, 1), border-radius 400ms cubic-bezier(0.77, 0, 0.175, 1), opacity 250ms cubic-bezier(0.77, 0, 0.175, 1)",
          willChange: "transform, opacity",
          transformOrigin: "center center",
        }
      : {
          opacity: isVisible ? 1 : 0,
          transition: "opacity 150ms ease-in-out",
        }

  return (
    <div
      className="fixed inset-0 bg-background/20 backdrop-blur-xl z-50 flex items-center justify-center"
      style={animationStyle}
      onClick={handleClose}
    >
      {/* Close Button */}
      {displayCount > 0 && (
        <Button
          onClick={(e) => {
            e.stopPropagation()
            handleClose()
          }}
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-50 cursor-pointer rounded-full bg-black/40 border border-white/20 hover:bg-black/20 size-11 transition-[background,transform] duration-150 active:scale-[0.97]"
          aria-label="Close gallery"
        >
          <X className="h-6 w-6" />
        </Button>
      )}

      {/* Only render controls and image if we have a current image */}
      {currentImage && (
        <>
          {/* Image Counter */}
          {displayCount > 0 && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 rounded-full font-medium bg-[rgba(10,10,10,0.2717391304347826)] px-3 py-1.5 text-sm">
              {displayIndex + 1} / {displayCount}
            </div>
          )}

          {/* Navigation Arrows */}
          {reversedImages.length > 1 && (
            <>
              {currentIndex > 0 && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevious()
                  }}
                  variant="ghost"
                  size="icon"
                  className="absolute left-4 z-50 cursor-pointer h-12 w-12 rounded-full bg-black/40 border border-white/20 hover:bg-black/20 transition-[background,transform] duration-150 active:scale-[0.97]"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-8 w-8" />
                </Button>
              )}

              {currentIndex < reversedImages.length - 1 && (
                <Button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNext()
                  }}
                  variant="ghost"
                  size="icon"
                  className="absolute right-4 z-50 cursor-pointer rounded-full bg-black/40 border border-white/20 hover:bg-black/20 w-11 h-11 transition-[background,transform] duration-150 active:scale-[0.97]"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-8 w-8" />
                </Button>
              )}
            </>
          )}

          {/* Action Buttons */}
          {displayCount > 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2">
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="cursor-pointer !pl-4 !pr-5 rounded-full text-white bg-[rgba(202,82,82,1)] h-11 text-sm hover:bg-[rgba(202,82,82,1)] hover:brightness-110 active:scale-[0.97] transition-[background,transform] duration-150 font-medium"
              >
                <Trash2 className="h-5 w-5" />
                Delete
              </Button>
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDownload()
                }}
                className="cursor-pointer !pl-4 !pr-5 rounded-full text-white bg-background h-11 text-sm hover:bg-zinc-800 active:scale-[0.97] transition-[background,transform] duration-150 font-medium"
                style={{
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  transform: "translate3d(0,0,0)",
                }}
              >
                <Download className="h-5 w-5" />
                Download
              </Button>
            </div>
          )}
        </>
      )}

      {/* Image Display */}
      <div className="w-screen h-screen relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {currentImage && (
          <img
            src={currentImage.dataUrl || "/placeholder.svg"}
            alt={`Captured frame ${currentIndex + 1}`}
            className={`w-full h-full object-contain transition-opacity duration-150 ease-in-out absolute inset-0 ${
              imageVisible && !isBurnReady ? "opacity-100" : "opacity-0"
            }`}
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
      </div>
    </div>
  )
}
