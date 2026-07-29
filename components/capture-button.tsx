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
      // The press scales the fill, not the button. Transforming the button
      // would change what getBoundingClientRect reports for it while the click
      // handler is still running, and measureDesktopSlotRect sizes the bar off
      // this element to aim the capture flight.
      className="group flex size-12 rounded-full border-[2.5px] border-shutter-ink bg-transparent p-[1.5px] shadow-none hoverFine:bg-transparent cursor-pointer"
      aria-label="Capture frame"
    >
      <span className="size-10 rounded-full bg-shutter-ink transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
    </Button>
  )
}
