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
 * The captured frame's flight from canvas to thumbnail slot.
 *
 * Not one of the tiers above: nothing else on screen travels this far, and the
 * long deceleration is what sells the frame as a physical object being put
 * away. Shared because the toolbar's slot opens on the same curve — the slot
 * has to finish making room at the moment the frame arrives in it.
 */
export const captureFlight = {
  durationMs: 500,
  easing: "cubic-bezier(0.32, 0.72, 0, 1)",
  /** Reduced motion drops the travel for a plain fade. */
  reducedMs: 150,
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
