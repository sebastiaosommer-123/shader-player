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
      // Ring heavier than the gap it encloses, as on mobile: a thin ring with a
      // wide gap reads as two concentric shapes rather than one shutter. The
      // 36px dot is unchanged, so it still matches the selected shader tab.
      className="group flex size-12 rounded-full border-4 border-shutter-ink bg-transparent p-[2px] shadow-none hoverFine:bg-transparent cursor-pointer"
      aria-label="Capture frame"
    >
      <span className="size-9 rounded-full bg-shutter-ink transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
    </Button>
  )
}
