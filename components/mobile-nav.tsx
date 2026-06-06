"use client"

import { useState } from "react"
import { Camera, ChevronRightIcon } from 'lucide-react'
import type { ShaderParams } from "@/lib/shader-uniforms"
import { ControlsSheet } from "./controls-sheet"
import { playDigitalClick } from "@/lib/audio-feedback"

interface MobileNavProps {
  onCapture: () => void
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

export function MobileNav({ onCapture, params, setParams, shaderId, onShaderChange }: MobileNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <div className="md:hidden fixed bottom-4 left-4 right-4 flex gap-2 z-40">
        {/* Shader Controls Button - fills available space */}
        <button
          onClick={() => {
            playDigitalClick("strong")
            setSheetOpen(true)
          }}
          className="flex-1 text-white px-5 border border-white/10 flex items-center gap-2 font-mono text-sm transition-[opacity,transform] duration-300 whitespace-nowrap justify-between rounded-full hoverFine:bg-zinc-800 active:scale-[0.97] bg-background h-11 pr-4"
          style={{
            opacity: sheetOpen ? 0 : 1,
            transform: sheetOpen ? "scale(0.9)" : "scale(1)",
            pointerEvents: sheetOpen ? "none" : "auto",
            transitionTimingFunction: "cubic-bezier(0.0, 0.0, 0.2, 1)",
          }}
        >
          <span>Shader Controls</span>
          <ChevronRightIcon className="w-4 h-4 text-gray-400" />
        </button>

        {/* Capture Button - circular with same height */}
        <button
          onClick={() => {
            playDigitalClick("strong")
            onCapture()
          }}
          className="flex items-center justify-center rounded-full hoverFine:bg-zinc-800 text-white transition-[background,transform] duration-150 active:scale-[0.97] border border-white/10 bg-background size-11"
          aria-label="Capture frame"
          style={{
            opacity: sheetOpen ? 0 : 1,
            transform: sheetOpen ? "scale(0.9)" : "scale(1)",
            pointerEvents: sheetOpen ? "none" : "auto",
            transitionTimingFunction: "cubic-bezier(0.0, 0.0, 0.2, 1)",
          }}
        >
          <Camera className="size-[18px]" />
        </button>
      </div>

      <ControlsSheet 
        params={params} 
        setParams={setParams} 
        open={sheetOpen} 
        onOpenChange={setSheetOpen}
        shaderId={shaderId}
        onShaderChange={onShaderChange}
      />
    </>
  )
}
