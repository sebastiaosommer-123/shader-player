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
        {/* No border: the shader tabs' track has none, and with the fill below
            doing the work it was drawing a second edge around an element that
            already reads as a recess. The fill has to carry it alone, which is
            why this is `foreground/6%` — the shader tabs' token — and not the
            old `muted/40`, which was faint enough in light mode that the border
            was the only thing defining the track at all. */}
        <div
          // 8px to match the parameter sliders, which is the other rectangular
          // control in this column — the shader tabs' pill shape doesn't
          // transfer to word labels.
          className="relative grid grid-cols-3 gap-1 rounded-[8px] bg-foreground/[0.06] p-1"
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
                  "relative h-8 rounded-[4px] px-2 text-xs capitalize transition-[color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
                  isSelected ? "text-foreground" : "text-muted-foreground hoverFine:text-foreground",
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId={prefersReducedMotion ? undefined : `${layoutIdPrefix}-appearance-tab`}
                    transition={spring.moderate}
                    aria-hidden
                    // The shell is 8px with 4px of padding, so the thumb has to
                    // sit 4px tighter to stay concentric.
                    className={cn("absolute inset-0 rounded-[4px]", raised)}
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
