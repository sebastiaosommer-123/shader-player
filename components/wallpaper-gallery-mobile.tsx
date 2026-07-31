"use client"

import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react"
import { motion, useIsPresent, useReducedMotion } from "framer-motion"
import { X, ChevronLeft, ChevronRight, Download, Trash2 } from "lucide-react"
import { BlossomCarousel, type BlossomCarouselHandle } from "@blossom-carousel/react"
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
  "pointer-events-auto cursor-pointer rounded-full bg-background/50 backdrop-blur-md border border-border text-foreground hoverFine:!bg-foreground/[0.06] hoverFine:!text-foreground focus-visible:!bg-foreground/[0.06] focus-visible:!text-foreground focus-visible:border-ring focus-visible:ring-ring/50 [&_svg]:text-foreground transition-[background-color,transform,opacity] duration-150 active:scale-[0.97]"

/** Long enough to outlast galleryMorph, in case its completion never fires. */
const MORPH_FALLBACK_MS = Math.round(galleryMorph.duration * 1000) + 100

interface WallpaperGalleryProps {
  images: CapturedImage[]
  onClose: () => void
  onDelete: (id: string) => void
  onDeleteStart?: (id: string) => void
  initialIndex?: number
  openedImageId: string
}

export function WallpaperGalleryMobile({
  images,
  onClose,
  onDelete,
  onDeleteStart,
  initialIndex = 0,
  openedImageId,
}: WallpaperGalleryProps) {
  const reversedImages = [...images].reverse()
  const imageCount = reversedImages.length

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [imageVisible, setImageVisible] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isBurnReady, setIsBurnReady] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  // Suppresses the parallax while the shared element is in flight. True from the
  // first frame, since the gallery only ever mounts into an opening morph.
  const [isMorphing, setIsMorphing] = useState(true)

  const carouselRef = useRef<BlossomCarouselHandle>(null)
  const scrollFrameRef = useRef(0)
  const seededRef = useRef(false)
  // Read by the re-centring effect below, which must not re-run when the index
  // changes — that effect exists to follow a deletion, not to fight a scroll.
  const currentIndexRef = useRef(currentIndex)
  currentIndexRef.current = currentIndex

  /**
   * The rect the opened capture actually occupies on screen — the letterboxed
   * box, not the viewport.
   *
   * This is what the morph has to land on. A card that grows to the full
   * viewport is a different shape from the photo inside it, so the letterbox
   * opens up *during* the flight and you watch black bars grow at the top and
   * bottom of a card that is still travelling. Growing to the photo's own rect
   * instead means the capture fills the card from the first frame to the last,
   * and the black either side of it is just the backdrop the card has not
   * reached yet.
   *
   * documentElement rather than window.innerHeight: this is the box a
   * `position: fixed; inset: 0` element resolves against, and on iOS those two
   * are different numbers whenever the address bar is part-way through
   * collapsing.
   */
  const openedImage = images.find((image) => image.id === openedImageId)
  const measureFitBox = useCallback(() => {
    const viewportWidth = document.documentElement.clientWidth
    const viewportHeight = document.documentElement.clientHeight
    // A capture taken before the canvas was sized comes back 0×0; nothing sane
    // to fit, so let it have the whole viewport.
    if (!openedImage?.width || !openedImage?.height) {
      return { width: viewportWidth, height: viewportHeight }
    }
    const scale = Math.min(viewportWidth / openedImage.width, viewportHeight / openedImage.height)
    return { width: openedImage.width * scale, height: openedImage.height * scale }
  }, [openedImage])

  const [fitBox, setFitBox] = useState(measureFitBox)

  useEffect(() => {
    const handleResize = () => setFitBox(measureFitBox())
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measureFitBox])

  const prefersReducedMotion = useReducedMotion()
  // Flips false the instant AnimatePresence starts removing us — long before it
  // actually unmounts us, which it will not do until the fades below finish.
  // See the shared-element container's own comment for why that matters.
  const isPresent = useIsPresent()

  const scrollToIndex = useCallback((index: number, smooth: boolean) => {
    const element = carouselRef.current?.element
    if (!element) return
    element.scrollTo({ left: index * element.clientWidth, behavior: smooth ? "smooth" : "instant" })
  }, [])

  /**
   * Puts the scroller on the capture that was clicked, before anything is
   * painted or measured.
   *
   * A ref callback is the only window that works. React attaches refs in the
   * commit phase with the whole slide row already in the DOM, and it does so
   * from the inside out — so this runs before the container above has been
   * measured for the morph. An effect on this component would run after it, and
   * the thumbnail would fly to slide zero and only then jump sideways.
   */
  const seedScroll = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || seededRef.current) return
      seededRef.current = true
      const element = node.parentElement
      // scroll-behavior is smooth on the scroller, so this cannot be a plain
      // scrollLeft assignment — that would animate the seed into view.
      element?.scrollTo({ left: initialIndex * element.clientWidth, behavior: "instant" })
    },
    [initialIndex],
  )

  /** The snapped slide, read off the scroller rather than tracked by hand. */
  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current) return
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = 0
      const element = carouselRef.current?.element
      if (!element?.clientWidth) return
      const index = Math.round(element.scrollLeft / element.clientWidth)
      // Only ever a state change on a crossing, never per frame: a re-render on
      // every frame of a scroll is how you drop the frames you just gained.
      setCurrentIndex((previous) => (previous === index ? previous : index))
    })
  }, [])

  useEffect(() => () => cancelAnimationFrame(scrollFrameRef.current), [])

  useEffect(() => {
    if (currentIndex >= imageCount && imageCount > 0) {
      setCurrentIndex(imageCount - 1)
    } else if (imageCount === 0) {
      onClose()
    }
  }, [imageCount, currentIndex, onClose])

  // A deletion pulls a slide out of the row from under the scroll offset, which
  // would otherwise leave the next capture sitting half off screen.
  useLayoutEffect(() => {
    if (imageCount === 0) return
    scrollToIndex(Math.min(currentIndexRef.current, imageCount - 1), false)
  }, [imageCount, scrollToIndex])

  // Scrolling to another capture abandons whatever was staged on the last one.
  useEffect(() => {
    setIsDeleting(false)
    setIsBurnReady(false)
    setIsScanning(false)
  }, [currentIndex])

  // onLayoutAnimationComplete normally beats this; it is here so a morph that
  // never reports back cannot leave the parallax switched off for good.
  useEffect(() => {
    if (prefersReducedMotion) {
      setIsMorphing(false)
      return
    }
    const timer = setTimeout(() => setIsMorphing(false), MORPH_FALLBACK_MS)
    return () => clearTimeout(timer)
  }, [prefersReducedMotion])

  const currentImage = reversedImages[currentIndex]
  if (!currentImage) return null

  const canPrevious = currentIndex > 0
  const canNext = currentIndex < imageCount - 1

  const handlePrevious = () => {
    playDigitalClick("strong")
    scrollToIndex(Math.max(currentIndex - 1, 0), !prefersReducedMotion)
  }

  const handleNext = () => {
    playDigitalClick("strong")
    scrollToIndex(Math.min(currentIndex + 1, imageCount - 1), !prefersReducedMotion)
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
      const newLength = imageCount - 1
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
    // Hand the transform back to Framer before the collapse starts, so a gallery
    // closed mid-swipe still morphs from where the capture actually sits.
    setIsMorphing(true)
    onClose()
  }

  const handleScanComplete = () => {
    if (currentImage) {
      downloadImage(currentImage.dataUrl, currentImage.params as any, currentImage.timestamp)
      playDownloadConfirmation("strong")
      setIsScanning(false)
    }
  }

  const displayCount = isDeleting ? Math.max(0, imageCount - 1) : imageCount

  const reducedTransition = { duration: 0.15, ease: "easeInOut" as const }
  const morphTransition = prefersReducedMotion ? reducedTransition : galleryMorph

  return (
    <div className="fixed inset-0 z-50">
      {/* Background — fades in/out independently.
          In fast, out slow, and deliberately not symmetric. The morph takes
          450ms; a backdrop that took half of that to arrive left the paused
          canvas and the control bar showing around and *through* the growing
          card for the first quarter second, which read as a second, ghosted
          copy of the capture sitting behind the real one. Gone by 120ms it is
          simply the room going dark before the frame is lifted into it. The way
          out keeps the longer fade, where the app returning underneath is the
          point. */}
      <motion.div
        className="fixed inset-0 bg-background"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: prefersReducedMotion ? reducedTransition : { duration: 0.25, ease: "easeOut" } }}
        transition={prefersReducedMotion ? reducedTransition : { duration: 0.12, ease: "easeOut" }}
      />

      {/* The viewer itself. Dropped the moment the close begins rather than when
          AnimatePresence finally unmounts us. Framer can only hand the layoutId
          back to the thumbnail once the card below is gone, and AnimatePresence
          holds the whole subtree alive until the slowest exit finishes — which
          used to mean a quarter-second of the image sitting fullscreen while the
          backdrop dissolved off it, and only then a collapse. Now the collapse
          starts on the click frame and those fades run alongside it.

          Plain, not a motion element: the shared element is the card around the
          opened capture, further down. Hanging the layoutId on this box meant
          morphing to the viewport, and the viewport is not the shape of the
          photo. */}
      {isPresent && (
        <div className="fixed inset-0 overflow-hidden" onClick={handleClose}>
          {/* The fade rides on this wrapper rather than on the scroller itself.
              Blossom writes its own inline `transition` onto the scroller to
              drive the overflow swap during a drag, and an inline declaration
              wins over anything we could set from a class — so a transition left
              on that element is simply overwritten and the fade snaps. */}
          <div
            className="absolute inset-0"
            style={{
              opacity: imageVisible ? 1 : 0,
              transition: prefersReducedMotion ? "opacity 150ms ease-in-out" : "opacity 180ms ease-out",
              // A burn or a scan owns the frame until it finishes; scrolling out
              // from under one would leave its subject already half deleted.
              pointerEvents: isDeleting || isScanning ? "none" : undefined,
            }}
          >
            {/* Every capture is on screen at once, in a real scroll container, so
                the swipe, the trackpad and the arrow keys all come for free — and
                the parallax has a scroll position to read. */}
            <BlossomCarousel
              ref={carouselRef}
              className="gallery-carousel"
              data-morphing={isMorphing ? "true" : undefined}
              onScroll={handleScroll}
              aria-label="Captured frames"
            >
              {reversedImages.map((image, index) => (
                <div
                  key={image.id}
                  data-blossom-slide
                  ref={index === initialIndex ? seedScroll : undefined}
                  className="gallery-slide"
                >
                  <div
                    className="gallery-card"
                    style={isBurnReady && index === currentIndex ? { opacity: 0 } : undefined}
                  >
                    {/* Every capture is sized to the letterboxed rect it actually
                        occupies rather than stretched across the slide and left
                        to object-contain. Same pixels either way when it is
                        sitting still — but this is the box the morph scales
                        from, and the thumbnail's is in the same proportion, so
                        the flight is a uniform scale with nothing to squash. */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      {/* Only the capture we opened from is a shared element — the
                          rest were never on screen to morph from.

                          Two nested layoutIds, and the pair is the whole trick.
                          The card is the aperture: it travels from the 44px circle
                          to the photo's rect, carrying the corner radius down to
                          zero. The image travels from the thumbnail's cover box,
                          which is taller than that circle, to the same photo rect
                          — so it overhangs the card everywhere except at the very
                          end, and the card clips it. The capture fills the
                          aperture the entire way across; what changes is how much
                          of it you are allowed to see. */}
                      {image.id === openedImageId ? (
                        <motion.div
                          layoutId={`gallery-container-${openedImageId}`}
                          className="relative overflow-hidden"
                          style={{ borderRadius: 0, width: fitBox.width, height: fitBox.height }}
                          transition={morphTransition}
                          onLayoutAnimationComplete={() => setIsMorphing(false)}
                        >
                          <motion.img
                            layoutId={`gallery-image-${openedImageId}`}
                            transition={morphTransition}
                            src={image.dataUrl || "/placeholder.svg"}
                            alt={`Captured frame ${index + 1} of ${imageCount}`}
                            className="block"
                            style={{ width: fitBox.width, height: fitBox.height }}
                            draggable={false}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </motion.div>
                      ) : (
                        <img
                          src={image.dataUrl || "/placeholder.svg"}
                          alt={`Captured frame ${index + 1} of ${imageCount}`}
                          className="max-h-full max-w-full"
                          draggable={false}
                          onClick={(e) => e.stopPropagation()}
                        />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </BlossomCarousel>
          </div>

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
            {/* Kept mounted and faded at the ends rather than swapped in and
                out. The index they read from now moves with the scroll, and a
                button that pops into existence halfway through a swipe reads as
                a glitch rather than as an affordance arriving. */}
            {imageCount > 1 && (
              <>
                <Button
                  onClick={(e) => { e.stopPropagation(); handlePrevious() }}
                  variant="ghost"
                  size="icon"
                  disabled={!canPrevious}
                  style={{ opacity: canPrevious ? 1 : 0 }}
                  className={cn("absolute left-4 top-1/2 -translate-y-1/2 size-11 dark:border-border/20 md:dark:border-border", galleryButtonClass)}
                  aria-label="Previous image"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.7} />
                </Button>

                <Button
                  onClick={(e) => { e.stopPropagation(); handleNext() }}
                  variant="ghost"
                  size="icon"
                  disabled={!canNext}
                  style={{ opacity: canNext ? 1 : 0 }}
                  className={cn("absolute right-4 top-1/2 -translate-y-1/2 size-11 dark:border-border/20 md:dark:border-border", galleryButtonClass)}
                  aria-label="Next image"
                >
                  <ChevronRight className="size-4" strokeWidth={1.7} />
                </Button>
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
