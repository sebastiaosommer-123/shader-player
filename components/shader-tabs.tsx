"use client"

import { motion, useReducedMotion } from "framer-motion"
import { getAllShaderIds, getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useSurface } from "@/lib/surface-context"
import { raisedThumb } from "@/lib/surface-classes"
import { spring } from "@/lib/springs"
import { cn } from "@/lib/utils"

interface ShaderTabsProps {
  shaderId: string
  onShaderChange: (shaderId: string) => void
  /**
   * The desktop toolbar and the mobile bar are both mounted at all times — they
   * are only CSS-hidden — so a single shared layoutId would leave two
   * indicators fighting over one animation. One prefix per instance keeps each
   * morph inside its own bar.
   */
  layoutIdPrefix: string
  size?: "desktop" | "mobile"
}

/**
 * Not one set of numbers for both bars: each track has to sit with whatever its
 * own bar puts beside it, and the two bars put different things there.
 *
 * Both tracks are 48 tall with 4px of inset, which puts their cells at 40. That
 * keeps the track's ends on the same line as the thumbnail slot and the shutter
 * either side of it, while the selected cell stays a step down from them — the
 * tabs are where you are, not the thing you came here to press.
 *
 * They differ only between the cells: desktop butts them, keeping the track at
 * 128, while mobile spaces them for the touch targets.
 */
const SIZES = {
  desktop: { track: "gap-0 p-1", cell: "size-10", text: "text-sm" },
  mobile: { track: "gap-1 p-1", cell: "size-10", text: "text-sm" },
} as const

/**
 * Every shader, always visible. Replaces the dropdown that used to hide the
 * fact that there is more than one shader at all.
 */
export function ShaderTabs({ shaderId, onShaderChange, layoutIdPrefix, size = "desktop" }: ShaderTabsProps) {
  const prefersReducedMotion = useReducedMotion()
  const substrate = useSurface()
  const shaderIds = getAllShaderIds()

  // The track is a recess pressed into whatever surface it lands on; the
  // selected cell climbs back out of it. Reading the substrate rather than
  // hardcoding a level is what lets the same component sit in the light
  // floating toolbar and in the pinned-dark mobile bar and read raised in both.
  // The recipe itself lives in lib/surface-classes.ts, shared with the
  // appearance toggle.
  const raised = raisedThumb(substrate)

  const handleSelect = (id: string) => {
    if (id === shaderId) return
    void playDigitalClick("medium")
    onShaderChange(id)
  }

  return (
    <div
      role="radiogroup"
      aria-label="Shader"
      className={cn("flex items-center rounded-full bg-foreground/[0.06]", SIZES[size].track)}
    >
      {shaderIds.map((id, index) => {
        const isSelected = id === shaderId
        const shader = getShaderConfig(id)

        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={shader.name}
            title={shader.name}
            onClick={() => handleSelect(id)}
            className={cn(
              "relative flex items-center justify-center rounded-full transition-[color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
              SIZES[size].cell,
              SIZES[size].text,
              isSelected ? "text-foreground" : "text-muted-foreground hoverFine:text-foreground",
            )}
          >
            {isSelected && (
              <motion.span
                layoutId={prefersReducedMotion ? undefined : `${layoutIdPrefix}-shader-tab`}
                transition={spring.moderate}
                aria-hidden
                className={cn("absolute inset-0 rounded-full", raised)}
              />
            )}
            {/* Above the indicator, which is painted into the same box. */}
            <span className="relative">{index + 1}</span>
          </button>
        )
      })}
    </div>
  )
}
