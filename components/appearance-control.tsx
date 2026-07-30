"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { motion, useReducedMotion } from "framer-motion"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useSurface } from "@/lib/surface-context"
import { raisedThumb } from "@/lib/surface-classes"
import { spring } from "@/lib/springs"
import { cn } from "@/lib/utils"

const themeOptions = ["system", "light", "dark"] as const

interface AppearanceControlProps {
  /**
   * The sidebar and the mobile sheet are both mounted at all times — they are
   * only CSS-hidden — so a single shared layoutId would leave two indicators
   * fighting over one animation. One prefix per instance keeps each morph
   * inside its own copy. Same reasoning as ShaderTabs.
   */
  layoutIdPrefix: string
}

export function AppearanceControl({ layoutIdPrefix }: AppearanceControlProps) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const prefersReducedMotion = useReducedMotion()
  const substrate = useSurface()

  useEffect(() => setMounted(true), [])

  // Same thumb as the shader tabs: fill from the surface ladder, contact shadow,
  // no ring. The old `bg-background` fill was the bug — on the dark sidebar it
  // painted the selected cell *darker* than its own track, so the cell read as a
  // hole punched through the control and no shadow could rescue it.
  const raised = raisedThumb(substrate)

  const handleSelect = (option: string) => {
    if (theme === option) return
    void playDigitalClick("medium")
    setTheme(option)
  }

  return (
    <div>
      <div className="h-px bg-border -mx-4 mb-4" />
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Appearance</div>
        {/* Bordered, unlike the shader tabs. Those sit on a floating bar that
            already has an edge of its own; this one sits flat in the sidebar
            column, where the border is what separates it from the surrounding
            surface. The fill is still `foreground/6%` — the shader tabs' token,
            and strong enough to define the track by itself — so the border is
            drawing the outline rather than standing in for a recess. */}
        <div
          // 8px, matching the parameter sliders. Shape follows the surface, not
          // the component type: this column is an 8px world, while the floating
          // toolbar — where the shader tabs live — is entirely pills, down to
          // the capture button. So the two segmented controls deliberately
          // don't share a radius; they share everything else.
          className="relative grid grid-cols-3 gap-1 rounded-[8px] border border-border bg-foreground/[0.06] p-1"
          role="radiogroup"
          aria-label="Appearance"
        >
          {themeOptions.map((option) => {
            const isSelected = mounted && theme === option

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => handleSelect(option)}
                className={cn(
                  // Only colour and transform transition here now — the fill and
                  // shadow moved onto the indicator, which animates by morphing
                  // rather than by cross-fading.
                  "relative h-8 rounded-[3px] px-2 text-xs capitalize transition-[color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
                  isSelected ? "text-foreground" : "text-muted-foreground hoverFine:text-foreground",
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : `${layoutIdPrefix}-appearance-tab`}
                    transition={spring.moderate}
                    aria-hidden
                    // 3px, not 4: the thumb is inset by the 1px border as well
                    // as the 4px of padding, so 8 - 5 is what keeps its corners
                    // concentric with the track's.
                    className={cn("absolute inset-0 rounded-[3px]", raised)}
                  />
                )}
                {/* Above the indicator, which is painted into the same box. */}
                <span className="relative">{option}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
