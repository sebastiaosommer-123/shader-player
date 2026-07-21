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
      className="group hidden md:flex fixed bottom-6 right-[304px] size-14 rounded-full border-2 border-background bg-transparent p-1 shadow-none z-10 hoverFine:bg-transparent cursor-pointer"
      aria-label="Capture frame"
    >
      <span className="size-11 rounded-full bg-background transition-transform duration-100 ease-out group-active:scale-90 motion-reduce:transition-none" />
    </Button>
  )
}
