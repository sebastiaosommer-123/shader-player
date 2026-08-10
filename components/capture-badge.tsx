"use client"

import { Play } from "lucide-react"
import type { Capture } from "@/lib/types"
import { formatDuration } from "@/lib/video-capture"

interface CaptureBadgeProps {
  capture: Capture
  /**
   * `duration` where there is room for four characters, `play` where there is
   * not. See the note below on why this is a caller's decision.
   */
  variant: "duration" | "play"
}

/**
 * How you tell a recording from a still at thumbnail size.
 *
 * Two treatments for one meaning, which needs defending. The duration readout is
 * the better mark: only a video has a length, so the number *is* the badge, and
 * it says something a play triangle does not — the app speaks in Space Mono
 * everywhere else, and a generic media glyph is the one piece of borrowed
 * iconography in it.
 *
 * But it needs about 24px of width to stay legible, and the mobile filmstrip's
 * frames are 33px wide with a picture to show. There the triangle is the only
 * mark that survives, so that is where it is used and nowhere else.
 *
 * Bottom-right in both cases: the corner your eye reaches last, and the one the
 * shader's composition is least likely to be doing anything with.
 *
 * Achromatic like everything else, and legible over any frame because the
 * capture underneath can be any brightness — hence a scrim rather than plain
 * white type.
 */
export function CaptureBadge({ capture, variant }: CaptureBadgeProps) {
  if (capture.kind !== "video") return null

  if (variant === "play") {
    return (
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-1 right-1 flex size-[13px] items-center justify-center rounded-full bg-black/45 text-white"
      >
        {/* Nudged right by a hair: a triangle's optical centre is not the centre
            of its bounding box. */}
        <Play className="size-[7px] translate-x-[0.5px]" fill="currentColor" strokeWidth={0} />
      </span>
    )
  }

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-1 right-1 rounded-full bg-black/45 px-1 py-px text-[9px] leading-[1.3] text-white"
    >
      {formatDuration(capture.durationMs ?? 0)}
    </span>
  )
}
