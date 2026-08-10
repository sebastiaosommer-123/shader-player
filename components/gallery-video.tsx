"use client"

import { useEffect, useRef, useState } from "react"
import { Play } from "lucide-react"
import type { Capture } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GalleryVideoProps {
  capture: Capture
  /**
   * Whether the shared-element morph has landed. The video is not mounted until
   * it has — see below.
   */
  ready: boolean
}

/**
 * The recording, playing over its own poster.
 *
 * **It is not the shared element.** The poster `<img>` underneath keeps the
 * layoutId and does the whole morph; this fades in on top once the flight has
 * landed, and the poster stays mounted underneath forever. Three reasons, none
 * of them theoretical:
 *
 * 1. A `<video>` whose blob has not decoded yet paints as nothing, so making it
 *    the morph target means watching a black rectangle grow out of the thumbnail
 *    and only then become a picture — the exact failure the nested-layoutId
 *    comments in the galleries were written to prevent.
 * 2. iOS Safari stutters compositing a playing video under a 450ms animated
 *    transform, and the touch gallery adds a scroll-driven translate on top.
 * 3. `<video>` has an intrinsic 300×150, so any frame before the explicit size
 *    applies hands the projection a box of the wrong shape.
 *
 * Leaving the poster underneath also means the close morph is byte-for-byte what
 * it was before video existed, `captureRef` stays an HTMLImageElement for
 * GalleryCloseFlight, and a refused `play()` simply leaves the still on screen.
 *
 * `pointer-events: none` is what keeps the gallery's click and swipe semantics
 * intact: the poster underneath still stops propagation, the card still closes
 * on a background click, and the carousel still pages under a finger.
 */
export function GalleryVideo({ capture, ready }: GalleryVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !ready) return
    // iOS in Low Power Mode refuses muted inline autoplay outright. Caught so
    // the poster stays put and the user is offered the play, rather than left
    // with a frame that never moves and no way to ask it to.
    const attempt = video.play()
    if (attempt) attempt.then(() => setBlocked(false)).catch(() => setBlocked(true))
  }, [ready, capture.dataUrl])

  if (!ready) return null

  return (
    <>
      <video
        ref={videoRef}
        src={capture.dataUrl}
        // muted and playsInline are both mandatory: without them iOS blocks the
        // autoplay and then takes the video fullscreen.
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        onPlaying={() => setPlaying(true)}
        aria-hidden
        // Sized by the box it is dropped into — which is the poster's box on
        // both galleries, so the two are registered without this having to know
        // anything about letterboxing. object-contain rather than fill because a
        // capture recorded before a resize can differ in aspect from the frame
        // it is being shown in, and a stretched wallpaper is worse than a
        // letterboxed one.
        className={cn(
          "pointer-events-none absolute inset-0 block h-full w-full object-contain transition-opacity duration-150 ease-out motion-reduce:transition-none",
          playing ? "opacity-100" : "opacity-0",
        )}
        style={{ WebkitTouchCallout: "none" }}
      />

      {blocked && !playing && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void videoRef.current?.play()
          }}
          aria-label="Play recording"
          className="absolute left-1/2 top-1/2 flex size-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-transform duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none"
        >
          {/* Nudged right by an eighth of its width: a triangle's optical centre
              is not its bounding box's. */}
          <Play className="size-6 translate-x-[1.5px]" fill="currentColor" strokeWidth={0} />
        </button>
      )}
    </>
  )
}
