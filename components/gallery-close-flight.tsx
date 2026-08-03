"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { animate, motion, useMotionValue, useTransform } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { coverBox } from "@/components/capture-thumbnail"
import { galleryMorph } from "@/lib/springs"

/**
 * How much of the journey the capture is still visible for.
 *
 * A fraction of *distance*, not of time, which is the whole reason the fade is
 * driven off the progress value below rather than given its own duration. The
 * morph is a spring: by 60% of its 450ms it is already almost home, so a fade
 * timed at 60% of the duration would keep the departing capture visible right up
 * to the landing and stack two different photographs on top of each other at
 * 44px. Sixty percent of the way *there* is still visibly a photograph in
 * flight, which is what wants to be the last thing you see of it.
 */
const FADE_COMPLETE_AT = 0.6

/** Long enough to outlast galleryMorph, in case its completion never fires. */
const MORPH_FALLBACK_MS = Math.round(galleryMorph.duration * 1000) + 150

export interface CloseFlight {
  image: CapturedImage
  /** Where the capture was painted when the gallery was dismissed. */
  rect: { top: number; left: number; width: number; height: number }
}

/**
 * The payload a gallery hands to its close, measured off the capture as painted.
 *
 * Read in the click handler, before any state has changed — on the touch gallery
 * the visible card may be carrying a parallax offset mid-swipe, and flying from
 * where the capture can actually be seen is the point.
 */
export function closeFlightFrom(
  node: HTMLElement | null,
  image: CapturedImage | undefined,
): CloseFlight | undefined {
  if (!node || !image) return undefined
  const box = node.getBoundingClientRect()
  if (!box.width || !box.height) return undefined
  return { image, rect: { top: box.top, left: box.left, width: box.width, height: box.height } }
}

interface GalleryCloseFlightProps {
  flight: CloseFlight
  onComplete: () => void
}

/**
 * The gallery's close, for the case where the capture on screen is not the one
 * the shared element is bound to.
 *
 * The morph that normally draws this is a layoutId pair between the fullscreen
 * capture and the thumbnail in the control bar — and the thumbnail only ever
 * shows the latest capture. Swipe or arrow your way to an older one and that
 * pair no longer describes anything: on desktop the flight is handed to a
 * thumbnail showing a different photograph, on mobile it starts from a slide
 * that is off screen.
 *
 * So this draws the collapse instead, from the departing capture's own rect to
 * the thumbnail's box, and fades to nothing on the way — leaving the thumbnail
 * showing the latest capture, which is what it is supposed to be showing.
 *
 * Geometry, spring and aperture are the morph's own: `layout` on a clipping box
 * around a `layout` image is the same projection Framer runs for a layoutId
 * pair, so the radius correction and the counter-scale that keeps the picture
 * from squashing come with it. The only thing that is new here is the opacity.
 *
 * Rendered by the page rather than by the gallery, for two reasons: the gallery
 * is unmounted by AnimatePresence as soon as its backdrop has finished fading,
 * a good 200ms before this lands — and its root drops to z-0 on the close frame,
 * so anything inside it would be painted underneath the control bar and slide
 * behind it on arrival.
 */
export function GalleryCloseFlight({ flight, onComplete }: GalleryCloseFlightProps) {
  const { image, rect } = flight

  // The thumbnail's box as painted, and the flip onto it.
  //
  // Measured after the commit rather than during the render: the thumbnail is
  // remounting in this very commit to leave the layoutId stack (see
  // CaptureSlot), so during the render there is a moment where the outgoing
  // element has gone and the incoming one is not in the document yet. It is at
  // rest by then either way — the press affordance belongs to the click that
  // opened the gallery, not to the one closing it.
  //
  // And the landing box is only taken up a frame later. A layout animation needs
  // a layout to change, so the departing rect has to be painted once before the
  // landing box replaces it — and that first frame is the rect the gallery's own
  // copy occupied until the commit before, so there is nothing to see in it.
  const [landing, setLanding] = useState<{
    top: number
    left: number
    width: number
    height: number
    radius: number
  } | null>(null)

  // Framer drives layout projection off a 0→1 progress on the transition it is
  // given, so a progress of our own on the same spring is frame-locked to the
  // collapse and can be read as a fraction of the distance covered.
  const progress = useMotionValue(0)
  const opacity = useTransform(progress, [0, FADE_COMPLETE_AT], [1, 0])

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  useLayoutEffect(() => {
    const node = document.querySelector<HTMLElement>("[data-capture-thumbnail]")
    // Nothing to fly home to — the last capture was deleted on the way out.
    if (!node) {
      onCompleteRef.current()
      return
    }
    const box = node.getBoundingClientRect()
    const radius = Number.parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
    // The fade is started here rather than on mount, in the same frame that
    // hands the element its landing box: a spring covers a third of its distance
    // in its first two frames, so a fade that set off even one frame early was
    // visibly ahead of the collapse the whole way down.
    let controls: ReturnType<typeof animate> | undefined
    const frame = requestAnimationFrame(() => {
      setLanding({ top: box.top, left: box.left, width: box.width, height: box.height, radius })
      controls = animate(progress, 1, {
        ...galleryMorph,
        onComplete: () => onCompleteRef.current(),
      })
    })
    const fallback = window.setTimeout(() => onCompleteRef.current(), MORPH_FALLBACK_MS)
    return () => {
      cancelAnimationFrame(frame)
      controls?.stop()
      window.clearTimeout(fallback)
    }
  }, [progress])

  // The image overhangs the box and is clipped by it, exactly as it is at the
  // thumbnail end of the morph — the capture fills the aperture the whole way
  // across, and what changes is how much of it you are allowed to see.
  const box = landing ?? { ...rect, radius: 0 }
  const picture = landing
    ? coverBox(image, landing.width, landing.height)
    : { width: rect.width, height: rect.height }

  return (
    <motion.div
      layout
      aria-hidden
      data-gallery-close-flight
      transition={galleryMorph}
      className="fixed overflow-hidden pointer-events-none z-50"
      style={{
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        borderRadius: box.radius,
        opacity,
      }}
    >
      {/* Centred by a flex parent rather than by a transform: the image below is
          a projection node, and Framer overwrites its transform every frame. */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.img
          layout
          transition={galleryMorph}
          src={image.dataUrl || "/placeholder.svg"}
          alt=""
          className="max-w-none shrink-0"
          style={{ width: picture.width, height: picture.height }}
        />
      </div>
    </motion.div>
  )
}
