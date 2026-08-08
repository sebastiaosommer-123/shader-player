"use client"

import { Button } from "@/components/ui/button"
import { playDigitalClick } from "@/lib/audio-feedback"

interface CaptureButtonProps {
  onCapture: () => void
}

export function CaptureButton({ onCapture }: CaptureButtonProps) {
  const handleCapture = () => {
    playDigitalClick("strong")
    onCapture()
  }

  return (
    <Button
      onClick={handleCapture}
      size="icon"
      // Unpositioned, like CaptureThumbnail: the floating toolbar lays it out.
      // It sits on a themed surface now rather than directly over the artwork,
      // so it follows the page theme instead of being pinned to one palette.
      //
      // Ring around a fill, the shutter every camera app draws. 2.5px ring,
      // 1.5px gap, 40px fill — 48 across, the same as the thumbnail slot at the
      // other end of the bar. The fill carries the control and the ring is a
      // hairline around it, close enough that the two read as one shutter
      // rather than as a disc parked inside a circle.
      //
      // The press scales the fill, not the button: on a real camera the ring is
      // part of the body and only the button travels. Scaling both would read
      // as the whole shutter assembly shrinking into the bar.
      //
      // Hover pulls the ink back to 90%, ring and fill together — the same /90
      // the Button variants already use for a solid control, so the shutter
      // answers the pointer the way every other filled control in here does.
      // Moving both keeps them reading as one shutter rather than a disc
      // dimming inside a ring that didn't.
      //
      // One token, both themes, and it lands the right way round in each: the
      // palette is achromatic, so 90% of the ink is 10% of the surface behind
      // it. Light mode's dark shutter lifts toward the bar; dark mode's near
      // white one settles into it. No new hue, because there isn't one in the
      // design to be coherent with.
      //
      // hoverFine, not hover: a touch device would otherwise latch the state on
      // after a tap and hold it there through the capture.
      className="group flex size-12 rounded-full border-[2.5px] border-shutter-ink hoverFine:border-shutter-ink/90 bg-transparent p-[1.5px] shadow-none hoverFine:bg-transparent cursor-pointer transition-colors duration-150 ease-out"
      aria-label="Capture frame"
    >
      {/* Two timings on one element, which is why this is written out rather
          than left to `transition-transform`: the press is 100ms because a
          shutter should feel immediate, and the hover is 150ms to match the
          other hover fades in the chrome. A single duration would have to be
          wrong for one of them. */}
      <span className="size-10 rounded-full bg-shutter-ink group-hoverFine:bg-shutter-ink/90 [transition:transform_100ms_ease-out,background-color_150ms_ease-out] group-active:scale-90 motion-reduce:transition-none" />
    </Button>
  )
}
