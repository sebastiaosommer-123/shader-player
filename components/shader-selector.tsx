"use client"

import { ChevronDown } from 'lucide-react'
import { useState } from "react"
import { getAllShaderIds, getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from "@/components/ui/dropdown"
import { MenuItem } from "@/components/ui/menu-item"

interface ShaderSelectorProps {
  currentShaderId: string
  onShaderChange: (shaderId: string) => void
}

export function ShaderSelector({ currentShaderId, onShaderChange }: ShaderSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const shaderIds = getAllShaderIds()
  const currentShader = getShaderConfig(currentShaderId)
  const selectedIndex = shaderIds.indexOf(currentShaderId)

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen && !isOpen) void playDigitalClick("weak")
    setIsOpen(nextOpen)
  }

  const handleSelect = async (shaderId: string) => {
    await playDigitalClick("medium")
    onShaderChange(shaderId)
    setIsOpen(false)
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownTrigger
        render={
          <button className="flex h-9 w-full items-center justify-between rounded-lg border border-border bg-muted/50 px-3 text-sm text-foreground transition-colors duration-150 hoverFine:bg-muted/70">
            <span className="font-normal">{currentShader.name}</span>
            <ChevronDown
              className="size-4 transition-transform duration-150 motion-reduce:transition-none"
              style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
            />
          </button>
        }
      />
      <DropdownContent checkedIndex={selectedIndex} className="w-[248px] rounded-xl">
        {shaderIds.map((shaderId, index) => {
          const shader = getShaderConfig(shaderId)
          return (
            <MenuItem
              key={shaderId}
              index={index}
              label={shader.name}
              checked={shaderId === currentShaderId}
              onSelect={() => handleSelect(shaderId)}
            />
          )
        })}
      </DropdownContent>
    </DropdownMenu>
  )
}
