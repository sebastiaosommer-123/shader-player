"use client"

import { useState, useEffect } from "react"
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
}

export function WallpaperGallery({
  images,
  isOpen,
  onClose,
  onDelete,
  onDeleteStart,
  initialIndex = 0,
}: WallpaperGalleryProps) {
  const reversedImages = [...images].reverse()

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isVisible, setIsVisible] = useState(false)
  const [shouldRender, setShouldRender] = useState(false)
  const [imageVisible, setImageVisible] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBurnReady, setIsBurnReady] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(initialIndex)
      setShouldRender(true)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true)
          setImageVisible(true)
        })
      })
    } else {
      setIsVisible(false)
      const timeout = setTimeout(() => {
        setShouldRender(false)
      }, 150)
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

  return (
    <div
      className={`fixed inset-0 bg-background/20 backdrop-blur-xl z-50 flex items-center justify-center transition-opacity duration-150 ease-in-out ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
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
