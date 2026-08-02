"use client"

import { useEffect, useState } from "react"
import type { CapturedImage } from "@/lib/types"
import { captureFlash, spring } from "@/lib/springs"
import { CaptureThumbnail, THUMBNAIL_RADIUS, coverBox } from "./capture-thumbnail"

/**
 * How long the outgoing capture stays before it is dropped: the arrival's delay,
 * plus the arrival itself, plus a frame or two of margin.
 *
 * A timer rather than the incoming thumbnail's onAnimationComplete, which was the
 * first attempt and misfired — it reported complete while the thumbnail was still
 * at scale 0, pulling the layer out from under a hole.
 */
const OUTGOING_LIFETIME_MS = captureFlash.holdEndMs + spring.moderate.duration * 1000 + 80

interface CaptureSlotProps {
  image: CapturedImage
  /**
   * The capture this one is replacing, if any. A prop rather than something
   * remembered here: holding it in state meant the whole effect vanished
   * whenever this component was remounted — which the mobile bar does and the
   * desktop bar does not, so the bug showed up on exactly one of them. Derived
   * from the caller's list, it cannot be lost.
   */
  previous?: CapturedImage | null
  width: number
  height: number
  onClick: () => void
  elevated?: boolean
  radius?: number
}

/**
 * The thumbnail's place in a control bar, and whatever is being replaced there.
 *
 * A new capture scales up from nothing, which is right the first time — the slot
 * grows with it and the bar makes room. On every capture after that the slot is
 * already open, so scaling from nothing would leave a hole in the bar for the
 * whole arrival: the old picture gone the instant the new one mounts, and about
 * 120ms of empty circle before anything covers it. It read as a blink.
 *
 * So the capture being replaced stays exactly where it was, underneath, until the
 * incoming one has finished scaling over the top of it. The slot is never empty
 * and the bar never moves.
 *
 * The layer underneath is a plain <img>, deliberately: no layoutId, no click
 * target, nothing Framer tracks. It exists for about a fifth of a second and its
 * only job is to be the picture that was already there.
 */
export function CaptureSlot({
  image,
  previous,
  width,
  height,
  onClick,
  elevated = true,
  radius = THUMBNAIL_RADIUS,
}: CaptureSlotProps) {
  // Which capture has finished arriving. Latched by a timer, and deliberately
  // fails *safe*: a remount resets it to null, which shows the outgoing layer
  // for a moment too long rather than leaving the slot blank.
  const [settledId, setSettledId] = useState<string | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setSettledId(image.id), OUTGOING_LIFETIME_MS)
    return () => window.clearTimeout(timer)
  }, [image.id])

  const outgoing = settledId === image.id ? null : previous
  const outgoingCover = outgoing ? coverBox(outgoing, width, height) : null

  return (
    <>
      {outgoing && outgoingCover && (
        // Positioned identically to the arriving thumbnail's wrapper, so the two
        // are registered to the pixel and the swap is invisible.
        <div
          aria-hidden
          className="absolute overflow-hidden pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            marginLeft: -width / 2,
            marginTop: -height / 2,
            width,
            height,
            borderRadius: radius,
            boxShadow: elevated ? "0 4px 12px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)" : "none",
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <img
              src={outgoing.dataUrl || "/placeholder.svg"}
              alt=""
              className="max-w-none shrink-0"
              style={{ width: outgoingCover.width, height: outgoingCover.height }}
            />
          </div>
        </div>
      )}

      <CaptureThumbnail
        // Remounting on the id is what replays the arrival for every capture.
        key={image.id}
        image={image}
        width={width}
        height={height}
        radius={radius}
        elevated={elevated}
        onClick={onClick}
      />
    </>
  )
}
