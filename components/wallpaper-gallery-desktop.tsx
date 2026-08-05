"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { flushSync } from "react-dom"
import { motion, useIsPresent, useReducedMotion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { CapturedImage } from "@/lib/types"
import type { CloseFlight } from "@/components/gallery-close-flight"
import { downloadImage } from "@/lib/canvas-capture"
import { playDigitalClick } from "@/lib/audio-feedback"
import { playDownloadConfirmation } from "@/lib/download-audio"
import { toast } from "sonner"
import { galleryMorph } from "@/lib/springs"
import { closeFlightFrom } from "@/components/gallery-close-flight"
import { cn } from "@/lib/utils"
import { dismissCapture } from "@/components/capture-dismissal"
import { useCaptureSlideIn } from "@/hooks/use-capture-slide-in"

const galleryButtonClass =
  "pointer-events-auto cursor-pointer rounded-full bg-background/50 backdrop-blur-md border border-border text-foreground hoverFine:!bg-foreground/[0.06] hoverFine:!text-foreground focus-visible:!bg-foreground/[0.06] focus-visible:!text-foreground focus-visible:border-ring focus-visible:ring-ring/50 [&_svg]:text-foreground transition-[background-color,transform] duration-150 active:scale-[0.97]"

interface WallpaperGalleryProps {
  images: CapturedImage[]
  onClose: (flight?: CloseFlight) => void
  onDelete: (id: string) => void
  initialIndex?: number
  openedImageId: string
}

export function WallpaperGalleryDesktop({
  images,
  onClose,
  onDelete,
  initialIndex = 0,
  openedImageId,
}: WallpaperGalleryProps) {
  // Oldest to newest, so the capture you just took is at the right-hand end and
  // the left arrow walks back in time. Kept in step with the touch gallery,
  // where the same order is what makes a rightward swipe reach the previous
  // shot. The toolbar hands the index down already in this order.

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageVisible, setImageVisible] = useState(true)
  const [slideX, setSlideX] = useState(0)
  const [slideTransition, setSlideTransition] = useState(true)
  const isNavigatingRef = useRef(false)
  const { slideStyle, beginSlideIn } = useCaptureSlideIn()
  // The capture as it is actually painted, for a close that has to draw its own
  // collapse. See handleClose.
  const captureRef = useRef<HTMLImageElement>(null)

  /**
   * The rect the capture actually occupies on screen — the letterboxed box, not
   * the viewer's.
   *
   * This is what the morph has to land on. A card that grows to fill the viewer
   * is a different shape from the photo inside it, so the letterbox opens up
   * *during* the flight and you watch black bars grow at the edges of a card
   * that is still travelling. Growing to the photo's own rect instead means the
   * capture fills the card from the first frame to the last, and the black
   * around it is just backdrop the card has not reached yet.
   *
   * Measured from the capture on screen and not from the one the gallery was
   * opened on, which are the same picture until you press an arrow. Two captures
   * only differ in shape if the canvas was resized between them — drag the
   * sidebar and the next shot is a different aspect ratio — and sizing every
   * capture to the *opened* one then squeezed a landscape frame into a portrait
   * box: the picture distorted, and the close inherited the wrong shape to fly
   * home from, since the flight starts from whatever is painted.
   *
   * documentElement rather than window.innerWidth: this is the box a
   * `position: fixed` element resolves against. The 32px is md:inset-8 on the
   * viewer below, which is the only inset this component ever has.
   */
  const shownImage = images[currentIndex]
  const measureFitBox = useCallback(() => {
    const inset = window.matchMedia("(min-width: 768px)").matches ? 32 : 0
    const boxWidth = Math.max(document.documentElement.clientWidth - inset * 2, 0)
    const boxHeight = Math.max(document.documentElement.clientHeight - inset * 2, 0)
    // A capture taken before the canvas was sized comes back 0×0; nothing sane
    // to fit, so let it have the whole box.
    if (!shownImage?.width || !shownImage?.height) {
      return { width: boxWidth, height: boxHeight }
    }
    const scale = Math.min(boxWidth / shownImage.width, boxHeight / shownImage.height)
    return { width: shownImage.width * scale, height: shownImage.height * scale }
  }, [shownImage])

  const [fitBox, setFitBox] = useState(measureFitBox)

  // Re-measured on a resize and on every step through the strip, since the
  // capture being stepped to may not be the shape of the one leaving.
  useEffect(() => {
    setFitBox(measureFitBox())
    const handleResize = () => setFitBox(measureFitBox())
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measureFitBox])

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

  /**
   * The download, on the press.
   *
   * Not after an animation — this used to set a flag and let a 1200ms scan-line
   * animation's completion callback do the download, which meant a button that
   * did nothing for well over a second, and a programmatic anchor click landing
   * outside the user-activation window that permits it.
   *
   * The confirmation is a toast rather than anything drawn over the capture. A
   * motion cue is gone before you can check it, and the thing you actually want
   * to know is whether the file left — which is a statement, not a gesture. It
   * also survives being missed, which is the whole job here.
   */
  const handleDownload = () => {
    if (!currentImage) return
    playDigitalClick("strong")
    downloadImage(currentImage.dataUrl, currentImage.timestamp, currentImage.shaderId)
    playDownloadConfirmation("strong")
    toast.success("Image downloaded")
  }

  /**
   * The delete, on the press.
   *
   * The capture leaves state immediately; the two halves of the motion are drawn
   * over the top of a list that has already changed. The outgoing frame recedes
   * and fades from the app root (see CaptureDismissal) because removing the last
   * capture closes the gallery on this same frame and the exit has to outlive
   * that unmount. The incoming one is stepped to here.
   *
   * Which way the strip steps is the decision worth writing down. The index is
   * moved *back* one rather than left where it is, so what fills the slot is the
   * capture before the deleted one and it enters from the left, where it has
   * been sitting all along. Holding the index instead would pull the *next*
   * capture leftwards into the gap, which is the correct thing for a list and the
   * wrong thing for a strip of film: nothing on a strip moves backwards. The
   * oldest capture is the one case with nothing behind it, so there the newer one
   * comes in from the right and the strip steps forward for once.
   */
  const handleDelete = () => {
    if (!currentImage) return
    playDigitalClick("strong")

    const src = currentImage.dataUrl
    // Both read before the removal, while this capture is still the one painted.
    const rect = prefersReducedMotion ? undefined : captureRef.current?.getBoundingClientRect()
    const wasLast = images.length === 1
    const stepsBack = currentIndex > 0

    onDelete(currentImage.id)
    dismissCapture(src, rect, wasLast)

    // Nothing to step to: the list is empty and the effect above is already
    // closing the gallery.
    if (wasLast) return
    // Above the motion check, because which capture fills the slot is not a
    // motion decision. Reduced motion takes the same step; it just arrives
    // already there.
    setCurrentIndex(stepsBack ? currentIndex - 1 : 0)
    if (prefersReducedMotion) return
    beginSlideIn(stepsBack ? -1 : 1)
  }

  const handleClose = () => {
    playDigitalClick("strong")
    // The shared element is bound to the capture the gallery was opened on,
    // which is the one the thumbnail is showing. Step away with the arrows and
    // the morph home would be collapsing the wrong photograph — so the page
    // draws this one's collapse instead.
    const strayed = currentImage.id !== openedImageId && !prefersReducedMotion
    onClose(strayed ? closeFlightFrom(captureRef.current, currentImage) : undefined)
  }

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

      {/* The viewer itself. Dropped the moment the close begins rather than when
          AnimatePresence finally unmounts us. Framer can only hand the layoutId
          back to the thumbnail once the card below is gone, and AnimatePresence
          holds the whole subtree alive until the slowest exit finishes — which
          used to mean a quarter-second of the image sitting there while the
          backdrop dissolved off it, and only then a collapse. Now the collapse
          starts on the click frame and those fades run alongside it.

          Plain, not a motion element: the shared element is the card around the
          capture, further down. Hanging the layoutId on this box meant morphing
          to the viewer, and the viewer is not the shape of the photo. */}
      {isPresent && (
        <div
          className="fixed inset-0 overflow-hidden md:inset-8"
          onClick={handleClose}
        >
          {currentImage && (
            // The prev/next slide rides on this wrapper, not on the image
            // itself. The image is a projection node now, so Framer owns its
            // transform for the length of the morph; a second transform on the
            // same element would be overwritten mid-flight and fight the spring.
            //
            // A delete's arrival rides here too, and simply takes the wrapper
            // over while it lasts — the two can never overlap, because a step
            // through the strip and a step caused by a deletion are both a change
            // of index and there is only one of those at a time. Kept at full
            // opacity throughout: the arriving capture is not crossfading with
            // anything, it is walking in front of a backdrop.
            <div
              className="absolute inset-0"
              style={
                prefersReducedMotion
                  ? { opacity: imageVisible ? 1 : 0, transition: "opacity 150ms ease-in-out" }
                  : slideStyle
                    ? { opacity: 1, ...slideStyle }
                    : {
                        opacity: imageVisible ? 1 : 0,
                        transform: `translateX(${slideX}px)`,
                        transition: slideTransition
                          ? "transform 220ms cubic-bezier(0.23, 1, 0.32, 1), opacity 180ms ease-out"
                          : "none",
                      }
              }
            >
              {/* Two nested layoutIds, and the pair is the whole trick. The card
                  is the aperture: it travels from the thumbnail's rounded square
                  to the photo's rect, carrying the corner radius down to zero.
                  The image travels from the thumbnail's cover box, which
                  overhangs that square, to the same photo rect — so it overhangs
                  the card everywhere except at the very end, and the card clips
                  it. The capture fills the aperture the entire way across; what
                  changes is how much of it you are allowed to see. */}
              <div className="absolute inset-0 flex items-center justify-center">
                {/* layoutDependency pins the layout animation to the open and the
                    close and nothing else. Framer animates a projection node
                    whenever its box changes, and the box now changes on every
                    arrow press that steps to a differently-shaped capture — which
                    would set the frame growing across the screen behind a picture
                    that is mid-crossfade. Held constant for the gallery's life, an
                    ordinary re-render is measured but not animated, while the
                    morph — driven by the shared element mounting and unmounting —
                    is untouched. */}
                <motion.div
                  layoutId={`gallery-container-${openedImageId}`}
                  layoutDependency={openedImageId}
                  className="relative overflow-hidden"
                  style={{ borderRadius: 0, width: fitBox.width, height: fitBox.height }}
                  transition={morphTransition}
                >
                  <motion.img
                    ref={captureRef}
                    layoutId={`gallery-image-${openedImageId}`}
                    layoutDependency={openedImageId}
                    transition={morphTransition}
                    src={currentImage.dataUrl || "/placeholder.svg"}
                    alt={`Captured frame ${currentIndex + 1}`}
                    className="block"
                    style={{ width: fitBox.width, height: fitBox.height }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </motion.div>
              </div>
            </div>
          )}

        </div>
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
        {images.length > 0 && (
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

            {images.length > 0 && (
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
