import { AppearanceToggle } from "./appearance-toggle"

interface CreditsFooterProps {
  /**
   * The mobile panel omits the appearance toggle: its own chrome is pinned
   * `dark`, so the only surface the setting still reaches from there is the
   * wallpaper gallery. Not worth a control in a sheet that can't show its own
   * effect — light/dark stays a desktop choice.
   */
  showAppearanceToggle?: boolean
}

export function CreditsFooter({ showAppearanceToggle = false }: CreditsFooterProps) {
  return (
    <div className="mt-auto">
      {/* Full-width divider with negative margins to counteract parent padding */}
      <div className="h-px bg-border -mx-4 mb-4" />
      {/* One row, never wrapping to two: the toggle stays pinned top-right and
          the credit line reflows under it instead. `min-w-0` is what allows
          that — a flex item defaults to `min-width: auto`, so without it the
          text refuses to shrink below its 206px natural width and pushes the
          button out of the 247px column.

          `items-center`, not `items-start`: the credit line carries 10px of
          vertical padding, so aligning the two boxes at their tops left the
          button sitting 4px above the text it reads as being beside. Centring
          lines up what is actually visible. */}
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-sm text-foreground mt-0 py-2.5">
          Made by{" "}
          <a
            href="https://www.sebastiaosommer.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Sebastião Sommer
          </a>
        </p>
        {showAppearanceToggle && <AppearanceToggle />}
      </div>
    </div>
  )
}
