"use client"

import type { CSSProperties } from "react"
import { playDigitalClick } from "@/lib/audio-feedback"
import { cn } from "@/lib/utils"

/**
 * Ring, gap, fill — the shutter every camera app draws, at the two sizes this
 * app needs it.
 *
 * The proportions are not shared between them and should not be: the desktop
 * shutter sits in a 48px bar next to a 48px thumbnail slot and has to line up
 * with both, while the mobile one owns its own row and is sized for a thumb.
 * What *is* shared is the relationship — a ring deliberately heavier than the
 * gap it encloses, because at low contrast a thin ring plus a wide gap reads as
 * two concentric shapes rather than as one shutter.
 *
 * `fill` is written out rather than derived, so the arithmetic is checkable at a
 * glance: 48 − 2×2.5 − 2×1.5 = 40, and 68 − 2×4 − 2×2 = 56.
 */
const SHUTTER_SIZES = {
  desktop: { size: 48, ring: 2.5, gap: 1.5, fill: 40 },
  mobile: { size: 68, ring: 4, gap: 2, fill: 56 },
} as const

interface ShutterButtonProps {
  onPress: () => void
  size?: keyof typeof SHUTTER_SIZES
  ariaLabel?: string
  /** The mobile bar hides its controls behind the sheet with opacity/transform. */
  style?: CSSProperties
  className?: string
}

/**
 * The shutter.
 *
 * One component for both bars, unified on `--shutter-ink`. That token resolves
 * to `var(--foreground)` in dark (app/globals.css) and the mobile bar is pinned
 * dark at every width, so the mobile shutter is pixel-identical to the
 * hardcoded `border-foreground` it replaced; only the light desktop shutter
 * takes the token's deliberate pullback from full-strength ink.
 *
 * **The press scales the fill, not the button.** On a real camera the ring is
 * part of the body and only the button travels; scaling both would read as the
 * whole shutter assembly shrinking into the bar.
 *
 * Hover pulls the ink back to 90%, ring and fill together — the same /90 the
 * Button variants use for a solid control, so the shutter answers the pointer
 * the way every other filled control in here does. Moving both keeps them
 * reading as one shutter rather than a disc dimming inside a ring that didn't.
 * One token, both themes, and it lands the right way round in each: the palette
 * is achromatic, so 90% of the ink is 10% of the surface behind it. Light mode's
 * dark shutter lifts toward the bar; dark mode's near-white one settles into it.
 *
 * hoverFine, not hover: a touch device would otherwise latch the state on after
 * a tap and hold it there through the capture.
 */
export function ShutterButton({
  onPress,
  size = "desktop",
  ariaLabel = "Capture frame",
  style,
  className,
}: ShutterButtonProps) {
  const geometry = SHUTTER_SIZES[size]

  const handlePress = () => {
    playDigitalClick("strong")
    onPress()
  }

  return (
    <button
      type="button"
      onClick={handlePress}
      aria-label={ariaLabel}
      // Unpositioned, like CaptureThumbnail: the bar around it does the layout.
      className={cn(
        "group flex items-center justify-center rounded-full border-shutter-ink bg-transparent shadow-none outline-none",
        "cursor-pointer transition-colors duration-150 ease-out motion-reduce:transition-none",
        "hoverFine:border-shutter-ink/90 hoverFine:bg-transparent",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className,
      )}
      style={{
        width: geometry.size,
        height: geometry.size,
        borderWidth: geometry.ring,
        borderStyle: "solid",
        padding: geometry.gap,
        ...style,
      }}
    >
      {/* Two timings on one element, which is why this is written out rather
          than left to `transition-transform`: the press is 100ms because a
          shutter should feel immediate, and the hover is 150ms to match the
          other hover fades in the chrome. A single duration would have to be
          wrong for one of them. */}
      <span
        className="block rounded-full bg-shutter-ink group-hoverFine:bg-shutter-ink/90 [transition:transform_100ms_ease-out,background-color_150ms_ease-out] group-active:scale-90 motion-reduce:transition-none"
        style={{ width: geometry.fill, height: geometry.fill }}
      />
    </button>
  )
}
