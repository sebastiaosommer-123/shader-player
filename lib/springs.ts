export const spring = {
  fast: {
    type: "spring" as const,
    duration: 0.08,
    bounce: 0,
    exit: { duration: 0.06 },
  },
  // Critically damped: same perceived speed as a bouncier tier, but lands
  // exactly with no overshoot — for short travel and panels/sheets that must
  // settle precisely (dropdowns, tabs, drawers, merged selection backgrounds).
  moderate: {
    type: "spring" as const,
    duration: 0.16,
    bounce: 0,
    exit: { duration: 0.12 },
  },
  slow: {
    type: "spring" as const,
    duration: 0.24,
    bounce: 0.12,
    exit: { duration: 0.16 },
  },
} as const;

/**
 * The shutter flash over the viewfinder: rise, *hold*, release.
 *
 * The hold is the whole thing. An earlier version peaked for a single instant
 * and decayed on an ease-out — which, applied to 1→0, dumps half the brightness
 * in the first 10ms and then lingers dim. At 60Hz that never rendered a single
 * full-opacity frame: it read as a flicker with a smear, not a flash. Holding
 * full for ~3 frames and releasing on an ease-in inverts both mistakes.
 *
 * The colours mirror --background in app/globals.css rather than resolving it,
 * because the flash renders inside the canvas wrapper — which is pinned `dark`
 * at every width — but has to answer to the *page* theme instead. Keep them in
 * step with the two --background declarations.
 */
export const captureFlash = {
  durationMs: 190,
  /** Full opacity by here. */
  riseMs: 35,
  /**
   * Held at full until here, then released for the remainder.
   *
   * Also what the toolbar waits for: the slot and the thumbnail are held back
   * until the black starts lifting, so the shutter reads as one event finishing
   * before the next begins rather than everything moving at once.
   */
  holdEndMs: 85,
  light: "oklch(1 0 0)",
  dark: "oklch(0.145 0 0)",
} as const;

/**
 * The thumbnail ↔ fullscreen gallery morph.
 *
 * Also outside the tiers above, and for the same reason as captureFlight: it
 * crosses the whole screen. Shared by both ends of the shared-element pair so
 * opening and closing are mirror images — whichever element Framer happens to
 * be driving, the curve is the same.
 */
export const galleryMorph = {
  type: "spring" as const,
  duration: 0.45,
  bounce: 0.08,
} as const;

// Fallback delay (ms) for deferred-unmount timers that guard an exit tween:
// popups keep their portal mounted until onAnimationComplete fires, but a
// throttled/background tab can stall the animation, so a timer force-unmounts
// after the tier's exit duration plus a safety buffer. Deriving it here keeps
// the timers in step with the tokens above.
export const exitFallbackMs = (tier: { exit: { duration: number } }) =>
  Math.round(tier.exit.duration * 1000) + 100;
