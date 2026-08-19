"use client"

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { galleryEffects } from "@/lib/springs"

let nextKey = 0

/** Which side of the strip the arriving capture comes from. Slides only. */
export type SlideFrom = -1 | 1

/**
 * How the capture taking a deleted one's place gets into the slot.
 *
 * `slide` is the touch gallery, and it is true there: the captures lie side by
 * side in a horizontal scroller, the neighbour genuinely is one screen out, and
 * swiping between them is the whole interaction. A capture crossing the screen
 * is the strip stepping, which is a thing the user has done by hand many times
 * before they ever delete anything.
 *
 * `reveal` is the desktop viewer, which is not a strip. It is one slot with a
 * vertical rail of thumbnails beside it, and the wheel steps between captures on
 * a hard cut — nothing has ever travelled into that slot. Desktop used to take
 * the slide anyway, off this same hook, which meant the replacement crossed a
 * whole viewport from an axis the surface does not have while the capture it
 * claimed to be sat visible in the rail the entire time. It steps forward out of
 * the stack instead. See galleryEffects.revealScale.
 */
export type Entrance = "slide" | "reveal"

/**
 * The capture that takes a deleted one's place, entering the slot it left.
 *
 * Both galleries drive their entrance off this, on different elements and in
 * different directions: the desktop viewer scales the wrapper around the single
 * image it renders, the touch gallery translates the card of the slide the
 * scroller has just been jumped onto. What they share is the awkward part — a
 * transition needs a *from* to leave, and setting the offset and the target in
 * one commit gives it nothing to interpolate between, so the capture simply
 * appears in place. Two commits: the first paints the from-state with no
 * transition on it at all, the second lets it come home.
 *
 * A transition and not a keyframe, deliberately. Delete is a button you can hit
 * twice in 300ms, and keyframes restart from zero where a transition retargets
 * from wherever the capture had got to.
 */
export function useCaptureReplacement(entrance: Entrance) {
  const [step, setStep] = useState<{ key: number; from: SlideFrom } | null>(null)
  const [settled, setSettled] = useState(false)

  const durationMs = entrance === "reveal" ? galleryEffects.revealMs : galleryEffects.replaceMs

  useEffect(() => {
    if (!step) return
    const start = requestAnimationFrame(() => setSettled(true))
    // Cleared rather than left at rest, so the element goes back to owning its
    // own transform the moment the entrance is over — on the touch gallery that
    // is the scroll-driven parallax getting its card back.
    const end = window.setTimeout(() => setStep(null), durationMs + 60)
    return () => {
      cancelAnimationFrame(start)
      window.clearTimeout(end)
    }
  }, [step, durationMs])

  /**
   * `from` is the side the capture comes from, and only slides have one. The
   * reveal has no direction to be given: it is the card behind coming forward,
   * which is the same move whichever capture fills the slot.
   */
  const beginReplacement = useCallback((from: SlideFrom = 1) => {
    setSettled(false)
    setStep({ key: nextKey++, from })
  }, [])

  const replacementStyle: CSSProperties | undefined = !step
    ? undefined
    : entrance === "reveal"
      ? settled
        ? {
            transform: "scale(1)",
            transition: `transform ${galleryEffects.revealMs}ms ${galleryEffects.dismissEase}`,
          }
        : { transform: `scale(${galleryEffects.revealScale})`, transition: "none" }
      : settled
        ? {
            transform: "translateX(0)",
            transition: `transform ${galleryEffects.replaceMs}ms ${galleryEffects.replaceEase}`,
          }
        // Percentages, not pixels: a slide is always exactly one screen of
        // travel, and the element that has to cross it is sized by its slide.
        : { transform: `translateX(${step.from * 100}%)`, transition: "none" }

  return { replacing: step !== null, replacementStyle, beginReplacement }
}
