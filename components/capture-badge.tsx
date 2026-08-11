"use client"

import { Play } from "lucide-react"
import type { Capture } from "@/lib/types"

interface CaptureBadgeProps {
  capture: Capture
}

/**
 * How you tell a recording from a still at thumbnail size.
 *
 * One mark, both gallery strips. The desktop rail used to carry the clip's
 * length instead, and in isolation that is the better badge — only a video has a
 * duration, so the number *is* the mark, and it says it in the Space Mono the
 * app speaks everywhere else rather than in borrowed media iconography. What it
 * cost was a second vocabulary for one meaning: the same recording announced
 * itself two different ways depending on which device you were holding. Only one
 * of the two survives the mobile strip's 33px-wide picture, so the triangle is
 * the one both keep.
 *
 * The readout is not missed, because it was never the only copy. Select a
 * recording and GalleryVideoControls prints elapsed and total beside its own
 * play button — in this same corner, which is the other half of why the mark
 * moved here from bottom-right. Thumbnail triangle and transport control now
 * occupy the same place, so the badge reads as the control's resting state
 * rather than as a sticker.
 *
 * One size for both, which the geometry allows: the two pictures are 68×44 and
 * 33×44 — the frame sizes less their 2px border and their padding — so a mark
 * drawn to clear the narrow one at their shared height is the same mark on each.
 *
 * A drop shadow rather than a scrim disc. The disc read more safely over a
 * bright frame, but at this size it was mostly disc — a 13px circle around a 7px
 * triangle is a button drawn where nothing is pressable. The shadow is the one
 * the colour picker's scrub cursor already uses, this project's other white mark
 * over arbitrary colour.
 *
 * It sits 6px in from the picture's left and lower edges — but the offsets below
 * do not say 6, and that is the icon's doing. Lucide draws this triangle from
 * x=6 to x=20 inside a 24 viewBox, and the rounding stroke pushes the outline
 * 1.5 units further out, so an 11px box carries 2.06px of empty margin at its
 * left and 0.69px under its point. Insetting the *box* by 6 would stand the
 * visible glyph 8.06px off the edge. Below is 6px minus that margin, one axis at
 * a time because the icon's own padding is not symmetric — recheck both if
 * lucide-react is upgraded, or if the stroke width changes.
 *
 * 11 does not divide the 24 viewBox into whole pixels the way 12 did, which is
 * why the offsets stop being tidy. They are written to the hundredth rather than
 * rounded to something readable because the alternative is the mark sitting a
 * visible fraction off the 6px it shares with the other orientation.
 *
 * The gallery only, and not a button. The bar's thumbnail holds exactly one
 * capture, the newest, taken seconds ago and needing told apart from nothing — a
 * mark earns its keep when there is a collection to scan. And the frame around
 * this one is already the button; a second target inside a 33px picture would be
 * well under 24px.
 */
export function CaptureBadge({ capture }: CaptureBadgeProps) {
  if (capture.kind !== "video") return null

  return (
    // Stroked in its own fill colour, which is the whole of how the corners get
    // their radius: lucide already defaults strokeLinejoin to round, so the
    // sharpness was `strokeWidth={0}` refusing the stroke rather than anything
    // about the path. Painting it back rounds each join by half the width: 3
    // gives 1.5 units of a 24 viewBox, so 0.69px here, near enough a pixel and a
    // half at 2×. The radius cannot be set independently of the weight, the one
    // thing this trick costs — 3 rather than lucide's 2 is a hair more curve
    // bought with a quarter-pixel more ink on each edge.
    <Play
      aria-hidden
      className="pointer-events-none absolute bottom-[5.31px] left-[3.94px] size-[11px] text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.4)]"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth={3}
    />
  )
}
