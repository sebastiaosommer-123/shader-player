"use client"

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import { motion, useIsPresent, useReducedMotion } from "framer-motion"
import * as Dialog from "@radix-ui/react-dialog"
import { X, Download, Trash2 } from "lucide-react"
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
import { GalleryThumbnailStrip } from "@/components/gallery-thumbnail-strip"

const galleryButtonClass =
  "pointer-events-auto cursor-pointer rounded-full bg-background/50 backdrop-blur-md border border-border text-foreground hoverFine:!bg-foreground/[0.06] hoverFine:!text-foreground focus-visible:!bg-foreground/[0.06] focus-visible:!text-foreground focus-visible:border-ring focus-visible:ring-ring/50 [&_svg]:text-foreground transition-[background-color,transform] duration-150 active:scale-[0.97]"

const WHEEL_NAVIGATION_THRESHOLD = 18
const WHEEL_STEP_INTERVAL_MS = 100
const WHEEL_IDLE_RESET_MS = 100

function normalizedWheelDelta(event: WheelEvent): number {
  if (event.deltaMode === 1) return event.deltaY * 16
  if (event.deltaMode === 2) return event.deltaY * document.documentElement.clientHeight
  return event.deltaY
}

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
  // Captures are stored oldest to newest, but desktop presents them newest at
  // the top. Scrolling down therefore walks back through older captures. The
  // mobile gallery keeps the stored order for its horizontal strip.

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const currentIndexRef = useRef(initialIndex)
  const wheelDeltaRef = useRef(0)
  const lastWheelEventRef = useRef(0)
  const lastWheelStepRef = useRef(0)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  )
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
   * opened on, which are the same picture until you scroll. Two captures
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
    // The filmstrip owns the rightmost 112px. Fit the capture into the actual
    // viewer region so the rail never covers the artwork.
    const boxWidth = Math.max(document.documentElement.clientWidth - inset * 2 - 112, 0)
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
  useLayoutEffect(() => {
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
      const nextIndex = images.length - 1
      currentIndexRef.current = nextIndex
      setCurrentIndex(nextIndex)
    } else if (images.length === 0) {
      onClose()
    }
  }, [images.length, currentIndex, onClose])

  const navigateToImage = useCallback((nextIndex: number, withSound: boolean) => {
    if (nextIndex === currentIndexRef.current) return
    if (withSound) playDigitalClick("strong")

    currentIndexRef.current = nextIndex
    setCurrentIndex(nextIndex)
  }, [])

  const handleSelectImage = (nextIndex: number) => {
    navigateToImage(nextIndex, true)
  }

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      // Listening on window means the gallery responds immediately wherever the
      // pointer happens to be; clicking or focusing the artwork is never part of
      // the interaction. The thumbnail rail is the exception: wheel input there
      // belongs to its native scroller and must not change the selected image.
      // Horizontal trackpad gestures and pinch zoom stay free everywhere.
      if (
        event.target instanceof Element &&
        event.target.closest('[data-gallery-thumbnail-strip="vertical"]')
      ) {
        return
      }
      if (event.ctrlKey || Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
      event.preventDefault()

      const now = performance.now()
      if (now - lastWheelEventRef.current > WHEEL_IDLE_RESET_MS) wheelDeltaRef.current = 0
      lastWheelEventRef.current = now
      const delta = normalizedWheelDelta(event)
      if (wheelDeltaRef.current !== 0 && Math.sign(delta) !== Math.sign(wheelDeltaRef.current)) {
        wheelDeltaRef.current = 0
      }
      wheelDeltaRef.current += delta

      if (Math.abs(wheelDeltaRef.current) < WHEEL_NAVIGATION_THRESHOLD) return
      if (now - lastWheelStepRef.current < WHEEL_STEP_INTERVAL_MS) return

      const direction = wheelDeltaRef.current > 0 ? 1 : -1
      const nextIndex = Math.max(
        0,
        Math.min(currentIndexRef.current - direction, images.length - 1),
      )
      wheelDeltaRef.current = 0
      if (nextIndex === currentIndexRef.current) return

      lastWheelStepRef.current = now
      navigateToImage(nextIndex, false)
    }

    window.addEventListener("wheel", handleWheel, { passive: false, capture: true })
    return () => window.removeEventListener("wheel", handleWheel, { capture: true })
  }, [images.length, navigateToImage])

  const currentImage = images[currentIndex]
  if (!currentImage) return null

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
    const nextIndex = stepsBack ? currentIndex - 1 : 0
    currentIndexRef.current = nextIndex
    setCurrentIndex(nextIndex)
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
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && isPresent) handleClose()
      }}
    >
      <Dialog.Content
        forceMount
        asChild
        aria-modal="true"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          closeButtonRef.current?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          const restoreTarget = restoreFocusRef.current
          requestAnimationFrame(() => {
            if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true })
          })
        }}
      >
        {/* z-50 while the gallery owns the screen; below the toolbar the moment it
            starts handing back.

            Nothing in here draws the collapse — the layoutId goes home to the
            thumbnail in the floating toolbar, which is fixed at z-10. Staying at
            z-50 through the close therefore held an opaque backdrop over the top of
            that collapse, and the first half of it played out underneath: the
            capture vanished on the click frame, the screen went black, and the photo
            only reappeared once the backdrop had dissolved, by which point it was
            most of the way home.

            z-0 rather than anything higher because it has to lose to the toolbar's
            z-10; it still paints over the canvas, which is unpositioned. */}
        <div
      className={cn(
        "fixed inset-0",
        isPresent ? "z-50" : "z-0 pointer-events-none",
      )}
    >
      <Dialog.Title className="sr-only">Captured image gallery</Dialog.Title>
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
            // A delete's arrival rides on this wrapper instead of the image.
            // The image is a projection node, so Framer owns its transform for
            // the length of the gallery morph; a second transform on the same
            // element would be overwritten mid-flight and fight the spring.
            <div
              className="absolute inset-0"
              style={slideStyle}
            >
              {/* Two nested layoutIds, and the pair is the whole trick. The card
                  is the aperture: it travels from the thumbnail's rounded square
                  to the photo's rect, carrying the corner radius down to zero.
                  The image travels from the thumbnail's cover box, which
                  overhangs that square, to the same photo rect — so it overhangs
                  the card everywhere except at the very end, and the card clips
                  it. The capture fills the aperture the entire way across; what
                  changes is how much of it you are allowed to see. */}
              <div className="absolute inset-y-0 left-0 right-28 flex items-center justify-center">
                {/* layoutDependency pins the layout animation to the open and the
                    close and nothing else. Framer animates a projection node
                    whenever its box changes, and the box now changes on every
                    scroll to a differently-shaped capture — which
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
          <div className="absolute bottom-20 right-0 top-20">
            <GalleryThumbnailStrip
              images={images}
              currentIndex={currentIndex}
              onSelect={handleSelectImage}
              orientation="vertical"
            />
          </div>
        )}

        {images.length > 0 && (
          <Button
            ref={closeButtonRef}
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
      </Dialog.Content>
    </Dialog.Root>
  )
}
