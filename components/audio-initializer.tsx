"use client"

import { useEffect } from "react"
import { initializeAudioContext } from "@/lib/audio-context"

export function AudioInitializer() {
  useEffect(() => {
    const handleInteraction = async () => {
      await initializeAudioContext()
      // Remove listeners after first successful initialization
      window.removeEventListener("click", handleInteraction)
      window.removeEventListener("touchstart", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
    }

    window.addEventListener("click", handleInteraction, { once: false })
    window.addEventListener("touchstart", handleInteraction, { once: false })
    window.addEventListener("keydown", handleInteraction, { once: false })

    return () => {
      window.removeEventListener("click", handleInteraction)
      window.removeEventListener("touchstart", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
    }
  }, [])

  return null
}
