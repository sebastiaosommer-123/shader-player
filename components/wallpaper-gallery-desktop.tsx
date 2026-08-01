"use client"

import { useState, useEffect, useRef } from "react"
import { flushSync } from "react-dom"
import { motion, useIsPresent, useReducedMotion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CapturedImage } from "@/lib/types"
import { downloadImage } from "@/lib/canvas-capture"
import { playDigitalClick } from "@/lib/audio-feedback"
import { playDownloadConfirmation } from "@/lib/download-audio"
import { galleryMorph } from "@/lib/springs"
import { cn } from "@/lib/utils"
import { BurningImage } from "@/components/burning-image"
import { ScanLineOverlay } from "@/components/scan-line-overlay"

const galleryButtonClass =
  "pointer-events-auto cursor-pointer rounded-full bg-background/50 backdrop-blur-md border border-border text-foreground hoverFine:!bg-foreground/[0.06] hoverFine:!text-foreground focus-visible:!bg-foreground/[0.06] focus-visible:!text-foreground focus-visible:border-ring focus-visible:ring-ring/50 [&_svg]:text-foreground transition-[background-color,transform] duration-150 active:scale-[0.97]"

interface WallpaperGalleryProps {
  images: CapturedImage[]
  onClose: () => void
  onDelete: (id: string) => void
  onDeleteStart?: (id: string) => void
  initialIndex?: number
  openedImageId: string
}

export function WallpaperGalleryDesktop({
  images,
  onClose,
  onDelete,
  onDeleteStart,
  initialIndex = 0,
  openedImageId,
}: WallpaperGalleryProps) {
  // Oldest to newest, so the capture you just took is at the right-hand end and
  // the left arrow walks back in time. Kept in step with the touch gallery,
  // where the same order is what makes a rightward swipe reach the previous
  // shot. The toolbar hands the index down already in this order.

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageVisible, setImageVisible] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBurnReady, setIsBurnReady] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [slideX, setSlideX] = useState(0)
  const [slideTransition, setSlideTransition] = useState(true)
  const isNavigatingRef = useRef(false)

  const prefersReducedMotion = useReducedMotion()
  // Flips false the instant AnimatePresence starts removing us — long before it
  // actually unmounts us, which it will not do until the fades below finish.
  // See the shared-element container's own comment for why that matters.
  const isPresent = useIsPresent()

  useEffect(() => {
    if (currentIndex >= images.length && images.length > 0) {
      setCurrentIndex(images.length - 1)
    } else if (images.length === 0) {
      onClose()
    }
  }, [images.length, currentIndex, onClose])

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

  const currentImage = images[currentIndex]
  if (!currentImage) return null

  const handlePrevious = () => {
    playDigitalClick("strong")
    if (prefersReducedMotion) {
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
      return
    }
    isNavigatingRef.current = true
    setSlideTransition(true)
    setSlideX(30)
    setImageVisible(false)
    setTimeout(() => {
      flushSync(() => {
        setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1))
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
      setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
      return
    }
    isNavigatingRef.current = true
    setSlideTransition(true)
    setSlideX(-30)
    setImageVisible(false)
    setTimeout(() => {
      flushSync(() => {
        setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0))
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
      const newLength = images.length - 1
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

  const displayCount = isDeleting ? Math.max(0, images.length - 1) : images.length

  const reducedTransition = { duration: 0.15, ease: "easeInOut" as const }
  const morphTransition = prefersReducedMotion ? reducedTransition : galleryMorph

  return (
    // z-50 while the gallery owns the screen; below the toolbar the moment it
    // starts handing back.
    //
    // Nothing in here draws the collapse — the layoutId goes home to the
    // thumbnail in the floating toolbar, which is fixed at z-10. Staying at
    // z-50 through the close therefore held an opaque backdrop over the top of
    // that collapse, and the first half of it played out underneath: the
    // capture vanished on the click frame, the screen went black, and the photo
    // only reappeared once the backdrop had dissolved, by which point it was
    // most of the way home.
    //
    // z-0 rather than anything higher because it has to lose to the toolbar's
    // z-10; it still paints over the canvas, which is unpositioned.
    <div
      className={cn(
        "fixed inset-0",
        isPresent ? "z-50" : "z-0 pointer-events-none",
      )}
    >
      {/* Background — fades in/out independently */}
      <motion.div
        className="fixed inset-0 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={prefersReducedMotion ? reducedTransition : { duration: 0.25, ease: "easeOut" }}
      />

      {/* Image container — shared element transition from thumbnail.
          Dropped the moment the close begins rather than when AnimatePresence
          finally unmounts us. Framer can only hand the layoutId back to the
          thumbnail once this node is gone, and AnimatePresence holds the whole
          subtree alive until the slowest exit below finishes — which used to
          mean a quarter-second of the image sitting fullscreen while the
          backdrop dissolved off it, and only then a collapse. Now the collapse
          starts on the click frame and those fades run alongside it. */}
      {isPresent && (
        <motion.div
          layoutId={`gallery-container-${openedImageId}`}
          // bg-background so the letterbox either side of the capture is opaque
          // rather than a window onto the app still fading out behind it.
          className="fixed inset-0 overflow-hidden bg-background md:inset-8"
          style={{ borderRadius: 0 }}
          transition={morphTransition}
          onClick={handleClose}
        >
          {currentImage && (
            // The prev/next slide rides on this wrapper, not on the image
            // itself. The image is a projection node now, so Framer owns its
            // transform for the length of the morph; a second transform on the
            // same element would be overwritten mid-flight and fight the spring.
            <div
              className="absolute inset-0"
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
            >
              {/* Sized to the letterboxed rect rather than stretched across the
                  container and left to object-contain: this is the box the morph
                  scales from, and the thumbnail's is in the same proportion, so
                  the flight stays a uniform scale. */}
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.img
                  layoutId={`gallery-image-${openedImageId}`}
                  transition={morphTransition}
                  src={currentImage.dataUrl || "/placeholder.svg"}
                  alt={`Captured frame ${currentIndex + 1}`}
                  className="max-h-full max-w-full"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
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
      )}

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
            className={cn("absolute top-4 right-4 size-11", galleryButtonClass)}
            aria-label="Close gallery"
          >
            <X className="size-4" strokeWidth={1.7} />
          </Button>
        )}

        {currentImage && (
          <>
            {images.length > 1 && (
              <>
                {currentIndex > 0 && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handlePrevious() }}
                    variant="ghost"
                    size="icon"
                    className={cn("absolute left-4 top-1/2 -translate-y-1/2 size-11 dark:border-border/20 md:dark:border-border", galleryButtonClass)}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="size-4" strokeWidth={1.7} />
                  </Button>
                )}

                {currentIndex < images.length - 1 && (
                  <Button
                    onClick={(e) => { e.stopPropagation(); handleNext() }}
                    variant="ghost"
                    size="icon"
                    className={cn("absolute right-4 top-1/2 -translate-y-1/2 size-11 dark:border-border/20 md:dark:border-border", galleryButtonClass)}
                    aria-label="Next image"
                  >
                    <ChevronRight className="size-4" strokeWidth={1.7} />
                  </Button>
                )}
              </>
            )}

            {displayCount > 0 && (
              <div className="absolute top-4 left-4 flex gap-2">
                <Button
                  onClick={(e) => { e.stopPropagation(); handleDelete() }}
                  variant="ghost"
                  size="icon"
                  className={cn("size-11", galleryButtonClass)}
                  aria-label="Delete image"
                >
                  <Trash2 className="size-4" strokeWidth={1.7} />
                </Button>
                <Button
                  onClick={(e) => { e.stopPropagation(); handleDownload() }}
                  variant="ghost"
                  size="icon"
                  className={cn("size-11", galleryButtonClass)}
                  style={{ WebkitTapHighlightColor: "transparent", touchAction: "manipulation" }}
                  aria-label="Download image"
                >
                  <Download className="size-4" strokeWidth={1.7} />
                </Button>
              </div>
            )}
          </>
        )}
      </motion.div>
    </div>
  )
}
