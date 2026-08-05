"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { galleryEffects } from "@/lib/springs"

let nextKey = 0

/** Which side of the strip the arriving capture comes from. */
export type SlideFrom = -1 | 1

/**
 * The capture that takes a deleted one's place, sliding a full screen into it.
 *
 * Both galleries drive the same motion off this, on different elements: the
 * desktop viewer translates the single image it renders, the touch gallery
 * translates the card of the slide the scroller has just been jumped onto. What
 * they share is the awkward part — a transition needs a *from* to leave, and
 * setting the offset and the target in one commit gives it nothing to interpolate
 * between, so the capture simply appears in place. Two commits: the first paints
 * it one screen out with no transition on it at all, the second lets it come
 * home.
 *
 * A transition and not a keyframe, deliberately. Delete is a button you can hit
 * twice in 300ms, and keyframes restart from zero where a transition retargets
 * from wherever the capture had got to.
 */
export function useCaptureSlideIn() {
  const [slide, setSlide] = useState<{ key: number; from: SlideFrom } | null>(null)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    if (!slide) return
    const start = requestAnimationFrame(() => setSettled(true))
    // Cleared rather than left at rest, so the element goes back to owning its
    // own transform the moment the slide is over — on the touch gallery that is
    // the scroll-driven parallax getting its card back.
    const end = window.setTimeout(() => setSlide(null), galleryEffects.replaceMs + 60)
    return () => {
      cancelAnimationFrame(start)
      window.clearTimeout(end)
    }
  }, [slide])

  const beginSlideIn = useCallback((from: SlideFrom) => {
    setSettled(false)
    setSlide({ key: nextKey++, from })
  }, [])

  // Percentages, not pixels: this is always exactly one screen of travel, and
  // the element that has to cross it is a different size in each gallery.
  const slideStyle: CSSProperties | undefined = !slide
    ? undefined
    : settled
      ? {
          transform: "translateX(0)",
          transition: `transform ${galleryEffects.replaceMs}ms ${galleryEffects.replaceEase}`,
        }
      : { transform: `translateX(${slide.from * 100}%)`, transition: "none" }

  return { sliding: slide !== null, slideStyle, beginSlideIn }
}
