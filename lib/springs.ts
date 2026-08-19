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

/**
 * The deleted capture leaving, and the one that takes its place arriving.
 *
 * Both gallery actions used to be gated behind an animation: the download did
 * not download for 1200ms and the delete did not delete for 1500ms, because the
 * real action was wired to a WebGL effect's completion callback. The action now
 * fires on the press, which is the fix that mattered; what is left here is only
 * how the outgoing frame gets off screen and the next one gets on.
 *
 * Deliberately not an *effect*. The shutter flash is ceremony because taking the
 * picture is the point of the app; deleting a bad frame is housekeeping, and
 * ceremony on housekeeping is what you notice on the two-hundredth time. The
 * canvas is where this project gets to be excessive. The gallery is a tool. Two
 * richer versions were built and cut — a fire burn and a particle dispersal —
 * and neither failed on timing: a dispersal needs edges to read as fragments,
 * and these captures are soft gradients with none, so it came apart into static
 * rather than into pieces.
 *
 * The two galleries no longer share an entrance, and that is the correction this
 * block exists to record. Both used to: one full screen of horizontal travel,
 * out of the same hook. It is true on touch, where the captures lie side by side
 * in a scroller and the neighbour really is one screen out. It was never true on
 * desktop, which has a vertical rail and a viewer that hard-cuts between
 * captures — so the replacement crossed in from an axis that surface does not
 * have, from off screen, while the very capture it claimed to be was sitting
 * visible in the rail the whole time. See revealScale.
 */
export const galleryEffects = {
  /**
   * How far the deleted capture recedes before it is gone.
   *
   * Not to nothing, and not by a hair either. The 0.97 this used to be is a
   * press affordance, not an exit — at that size the capture only fades, and a
   * fade on its own reads as the picture going dim rather than going away.
   * Pulling back to 0.8 gives it somewhere to go, which is what makes the
   * neighbour arriving read as a replacement rather than a swap.
   */
  dismissScale: 0.8,
  /** Scale and fade on the capture that has already left state. */
  dismissMs: 220,
  /**
   * Ease-out, and the delay below is what makes that safe.
   *
   * The trap captureFlash documents applies to any 1 → 0 fade: an ease-out
   * spends most of the opacity in the first few frames, so the capture is half
   * gone before it has been on screen for two, and what you register is not the
   * picture leaving but the backdrop appearing behind it. This used to answer
   * that with an ease-*in* on both properties, which worked while the exit was
   * only a fade.
   *
   * It stops working once the capture also moves. Ease-in on a transform is
   * dead for its first half — 110ms in, a capture on its way to 0.8 has barely
   * left 0.97 — and dead frames immediately after a press read as latency, not
   * as restraint. So the transform gets the ease-out it wants, and the fade
   * gets the hold it wants from a delay instead of from a curve.
   *
   * Also the desktop reveal's curve, deliberately: the two halves of that delete
   * are one gesture on one axis, and a shared curve is what keeps them from
   * reading as two events that happen to overlap.
   */
  dismissEase: "cubic-bezier(0.23, 1, 0.32, 1)",
  /**
   * How long the capture holds full opacity while it is already shrinking.
   *
   * Four frames at 60Hz, which is all the hold ever needed to be: long enough
   * that the picture is unmistakably the thing that moved first, short enough
   * that it is gone well before the capture replacing it has settled.
   */
  dismissFadeDelayMs: 60,
  /**
   * The neighbour stepping forward into the slot, on desktop.
   *
   * Not a slide, because the desktop viewer is not a strip. It is one slot with
   * a vertical rail of thumbnails beside it, and the wheel steps between
   * captures on a hard cut — nothing ever travels into that slot, so there is no
   * spatial habit for an entrance to be consistent with. What the viewer *is* is
   * a stack: the capture you are looking at, and the rest behind it. Delete the
   * top one and the next is revealed, because it was already there.
   *
   * So the entrance is the only move that is physically true here — the card
   * behind coming forward as the one in front falls back. The exit is already
   * receding on this axis (1 → 0.8); this is the same axis in the other
   * direction, on the same curve. Two properties, two elements, one gesture.
   *
   * 0.98 and not less. The whole distance is a hair, and it has to be: the
   * capture is not entering, it is being uncovered, and anything deeper starts
   * to look like it flew in from behind the screen. No opacity on it either —
   * these captures are near-identical soft gradients, and fading one up over
   * another is how you get mush instead of a replacement.
   */
  revealScale: 0.98,
  /**
   * Shorter than the exit on purpose, and starting on the same frame.
   *
   * The reverse of the reasoning replaceMs gives for the touch gallery. There,
   * the arrival outlasts the exit because it crosses the whole screen and is the
   * thing worth following. Here the arrival is 2% of a scale — it has nothing to
   * say on its own, and its whole job is to be finished and out of the way while
   * the capture you deleted is still visibly leaving.
   */
  revealMs: 200,
  /**
   * The neighbour arriving in the deleted capture's place on *touch* — a full
   * slide, one screen wide, from the side of the strip it actually lives on.
   *
   * Longer than anything else here because it is the only thing in the gallery
   * that crosses the whole screen, and the curve is the one iOS uses for a
   * full-screen push: nearly all the distance in the first half, then a long
   * quiet settle. A strong ease-out over a viewport width is the difference
   * between the strip stepping back and a card being thrown at you.
   *
   * It outlasts the exit on purpose. The capture you deleted is gone by 220ms
   * and the one that replaced it is still arriving, so the last thing the eye
   * follows is the picture that stayed.
   *
   * Touch only. The desktop viewer has no side for a capture to come from; see
   * revealScale.
   */
  replaceMs: 300,
  replaceEase: "cubic-bezier(0.32, 0.72, 0, 1)",
  /**
   * How long the backdrop lingers after the *last* capture has dissolved.
   *
   * Only ever used for that one case, and it exists because the gallery cannot
   * cover it itself: emptying the list makes the viewer render null on the same
   * commit, so its own backdrop is gone a frame before the exit begins and the
   * capture would be dissolving against the live shader. Held opaque for the
   * length of the exit and dropped afterwards, the order reads properly — the
   * picture goes, and only then does the canvas come back.
   */
  dismissBackdropMs: 220,
} as const;

// Fallback delay (ms) for deferred-unmount timers that guard an exit tween:
// popups keep their portal mounted until onAnimationComplete fires, but a
// throttled/background tab can stall the animation, so a timer force-unmounts
// after the tier's exit duration plus a safety buffer. Deriving it here keeps
// the timers in step with the tokens above.
export const exitFallbackMs = (tier: { exit: { duration: number } }) =>
  Math.round(tier.exit.duration * 1000) + 100;
