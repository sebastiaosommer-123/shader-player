"use client"

import { motion, useReducedMotion } from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { playDigitalClick } from "@/lib/audio-feedback"
import { captureFlash, galleryMorph, spring } from "@/lib/springs"

export const THUMBNAIL_RADIUS = 8

/**
 * object-cover written out as a real box rather than left to the paint step.
 *
 * The gallery morph moves the <img> to the letterboxed rect it occupies
 * full-screen, and Framer drives that with a transform — so whatever aspect
 * ratio the element's own box has here is the one it is scaled *from*. A square
 * box (44×44) reaching a 9:19.5 rect means scaleX and scaleY differ by more than
 * 2×, and object-cover cannot undo that: it is resolved once at layout, not per
 * frame. The capture spent the first half of its flight visibly squashed.
 *
 * Sizing the box to the capture's own aspect and letting the round parent clip
 * it gives the identical cover framing with the two ends already in proportion,
 * so the morph is a plain uniform scale.
 *
 * A capture taken before the canvas has been sized comes back 0×0, and the ratio
 * with it: falling back to the box means a degenerate capture is still laid out,
 * rather than writing NaN into the style.
 *
 * Shared with the outgoing layer in CaptureSlot, which has to frame its picture
 * identically or the swap would visibly re-crop.
 */
export function coverBox(image: CapturedImage, width: number, height: number) {
  const ratio = image.width / image.height
  const aspect = Number.isFinite(ratio) && ratio > 0 ? ratio : width / height
  const isWider = aspect > width / height
  return {
    width: isWider ? height * aspect : width,
    height: isWider ? height : width / aspect,
  }
}

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
  /**
   * The true corner radius — half the box for a circle, not an oversized
   * sentinel. Framer interpolates this during the gallery morph, so a value the
   * browser would merely clamp at paint keeps the corner elliptical the whole
   * way across.
   */
  radius?: number
}

/**
 * The captured-image thumbnail itself, without any positioning. The mobile bar
 * and the desktop corner render this at different sizes — but only ever one at
 * a time, since two elements sharing a layoutId would break the gallery morph.
 */
export function CaptureThumbnail({
  image,
  width,
  height,
  onClick,
  elevated = true,
  radius = THUMBNAIL_RADIUS,
}: CaptureThumbnailProps) {
  const prefersReducedMotion = useReducedMotion()

  const handleClick = () => {
    playDigitalClick("strong")
    onClick()
  }

  const transition = prefersReducedMotion ? { duration: 0 } : galleryMorph

  const cover = coverBox(image, width, height)

  return (
    // The arrival, one layer further out again, and for the mirror of the
    // reason below: the press affordance drives transform from a CSS class, and
    // Framer writes transform inline. Sharing an element, the two overwrite each
    // other. Both call sites key this component on the image id, which is what
    // remounts it and replays `initial` for every capture rather than only the
    // first.
    //
    // Centred absolutely rather than sitting in flow, and scaled from 0 rather
    // than from the usual 0.85. Both are for the desktop slot, which grows from
    // 0 to 48 on this same spring at this same moment: a centred circle at
    // scale s is exactly as wide as a slot at progress s, so the two track each
    // other edge for edge and nothing ever needs clipping. Left in flow it
    // would be pinned to the slot's left edge at full width and spill straight
    // over the shader tabs, which is what it used to do.
    //
    // Negative margins for the centring, not a translate: Framer owns the
    // transform on this element and a -50% translate would have to be carried
    // through every keyframe of the scale.
    //
    // Scale alone, no opacity — growing from nothing is already the reveal, and
    // a fade on top of it only makes the edge mushy.
    <motion.div
      initial={prefersReducedMotion ? false : { scale: 0 }}
      animate={{ scale: 1 }}
      // Held until the flash starts lifting; see captureFlash.holdEndMs.
      transition={
        prefersReducedMotion
          ? { duration: 0 }
          : { ...spring.moderate, delay: captureFlash.holdEndMs / 1000 }
      }
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        marginLeft: -width / 2,
        marginTop: -height / 2,
        width,
        height,
      }}
    >
      {/* The press affordance sits out here rather than on the element below,
          because that element is the one Framer drives: it writes an inline
          transform on every frame of the gallery morph, and a CSS transition on
          transform/scale would re-ease each of those writes, smearing the spring
          into mush. Scaling from outside keeps the whole circle shrinking
          together — scaling from inside would pull the image off the clipped
          edge instead. */}
      <div
        className="active:scale-[0.97] transition-transform duration-150 ease-out motion-reduce:transition-none"
        style={{ width, height }}
      >
        <motion.div
          layoutId={prefersReducedMotion ? undefined : `gallery-container-${image.id}`}
          onClick={handleClick}
          className="cursor-pointer relative group overflow-hidden"
          style={{
            width,
            height,
            borderRadius: radius,
            boxShadow: elevated ? "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
          }}
          transition={transition}
          aria-label="View latest capture"
          role="button"
        >
          {/* Centred by a flex parent rather than by a transform: the image below
              is a projection node, and Framer overwrites its transform on every
              frame of the morph. */}
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Carries its own layoutId so Framer treats it as a projection node and
                cancels the container's scale out of it. Without that the photo is
                stretched by however unevenly the box grows — and a circle reaching a
                landscape viewport grows very unevenly indeed. */}
            <motion.img
              layoutId={prefersReducedMotion ? undefined : `gallery-image-${image.id}`}
              transition={transition}
              src={image.dataUrl || "/placeholder.svg"}
              alt="Latest capture"
              className="max-w-none shrink-0"
              style={{ width: cover.width, height: cover.height }}
            />
          </div>
          <div className="absolute inset-0 bg-white/0 group-hoverFine:bg-white/10 transition-colors duration-150 pointer-events-none" />
        </motion.div>
      </div>
    </motion.div>
  )
}
