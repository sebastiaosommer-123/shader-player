"use client"

import { Camera } from 'lucide-react'
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
      className="hidden md:flex fixed bottom-6 right-[304px] h-14 w-14 rounded-full shadow-lg z-10 hoverFine:bg-zinc-800 text-white transition-[background,transform] duration-150 hoverFine:brightness-110 active:scale-[0.97] bg-background cursor-pointer"
      aria-label="Capture frame"
    >
      <Camera className="h-6 w-6" />
    </Button>
  )
}
