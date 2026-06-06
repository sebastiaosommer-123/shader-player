"use client"

import { Check, ChevronDown } from 'lucide-react'
import { useState } from "react"
import { getAllShaderIds, getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { cn } from "@/lib/utils"

interface ShaderSelectorProps {
  currentShaderId: string
  onShaderChange: (shaderId: string) => void
}

export function ShaderSelector({ currentShaderId, onShaderChange }: ShaderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const shaderIds = getAllShaderIds()
  const currentShader = getShaderConfig(currentShaderId)

  const handleToggle = async () => {
    await playDigitalClick("weak")
    setIsOpen(!isOpen)
  }

  const handleSelect = async (shaderId: string) => {
    await playDigitalClick("medium")
    onShaderChange(shaderId)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/50 hoverFine:bg-muted/70 transition-colors text-sm text-foreground border border-border"
        style={{ borderRadius: '8px' }}
      >
        <span className="font-normal">{currentShader.name}</span>
        <ChevronDown
          className="w-4 h-4 transition-transform"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>

      <div
        className="fixed inset-0 z-10"
        style={{ pointerEvents: isOpen ? 'auto' : 'none' }}
        onClick={() => setIsOpen(false)}
      />
      <div
        className={cn(
          "absolute top-full left-0 right-0 mt-1 bg-popover border border-border shadow-lg overflow-hidden z-20",
          "transition-[opacity,transform] duration-150 origin-top",
          isOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
        )}
        style={{ borderRadius: '8px' }}
      >
        {shaderIds.map((shaderId) => {
          const shader = getShaderConfig(shaderId)
          const isSelected = shaderId === currentShaderId
          return (
            <button
              key={shaderId}
              onClick={() => handleSelect(shaderId)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm hoverFine:bg-muted/50 transition-colors text-left"
            >
              <span>{shader.name}</span>
              {isSelected && <Check className="w-4 h-4" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
