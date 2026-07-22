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
      // `dark` pins this to the dark palette, so `foreground` stays near-white in
      // both themes. It floats over the artwork rather than over a themed
      // surface, so following the page theme inverted it into a black disc on
      // the shader whenever dark mode was on.
      className="dark group hidden md:flex fixed bottom-6 right-[304px] size-14 rounded-full border-2 border-foreground bg-transparent p-1 shadow-none z-10 hoverFine:bg-transparent cursor-pointer"
      aria-label="Capture frame"
    >
      <span className="size-11 rounded-full bg-foreground transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
    </Button>
  )
}
