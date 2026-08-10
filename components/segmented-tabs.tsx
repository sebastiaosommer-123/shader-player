"use client"

import { motion, useReducedMotion } from "framer-motion"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useSurface } from "@/lib/surface-context"
import { raisedThumb } from "@/lib/surface-classes"
import { spring } from "@/lib/springs"
import { cn } from "@/lib/utils"

export interface SegmentedOption {
  id: string
  label: string
}

interface SegmentedTabsProps {
  options: SegmentedOption[]
  value: string
  onChange: (id: string) => void
  /** Names the group for assistive tech: "Shader", "Capture mode". */
  ariaLabel: string
  /**
   * Both control bars are mounted at all times — they are only CSS-hidden — and
   * the sheet carries a third copy of the shader picker. A single shared layoutId
   * across those would leave several indicators fighting over one animation, so
   * every instance gets its own prefix and each morph stays inside its own bar.
   */
  layoutIdPrefix: string
  /** Distinguishes the tracks *within* one bar: "shader-tab" against "mode-tab". */
  layoutIdSuffix: string
  size?: "desktop" | "mobile"
  /**
   * Inert and dimmed. Used while a recording is running, where changing the
   * capture mode mid-clip would freeze the canvas halfway through it.
   */
  disabled?: boolean
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
 * The height is the fixed number and the width is not: cells are `h-10 px-3`
 * rather than `size-10`, so each one is as wide as the word it holds. A square
 * cell is what a numeral wanted; a word wants a pill.
 *
 * 13px rather than text-sm, which is what the sliders are set at. A numeral gave
 * you nothing to compare it against, so the extra pixel it used to carry went
 * unnoticed; a word sits in the same bar as words elsewhere and has to agree
 * with them. Everything in the app is Space Mono 400 — size, case and tracking
 * are the only things that ever vary.
 *
 * They differ only between the cells: desktop butts them, mobile spaces them for
 * the touch targets.
 */
const SIZES = {
  desktop: { track: "gap-0 p-1", cell: "h-10 px-3", text: "text-[13px]" },
  mobile: { track: "gap-1 p-1", cell: "h-10 px-3", text: "text-[13px]" },
} as const

/**
 * The selected cell's height, and so half of it is the indicator's radius.
 *
 * Written out rather than left to `rounded-full`, because the indicator morphs
 * *width* as well as position — the cells are not all the same size. Framer's
 * layout projection interpolates whatever number it is given, so a 9999px
 * sentinel rides the whole morph as an ellipse; 20 is the real radius and stays
 * a pill at both ends. Same lesson as SLOT_RADIUS in lib/toolbar-geometry.ts.
 */
const CELL_HEIGHT = 40

/**
 * A row of choices with the selected one raised out of the track.
 *
 * The shape of every top-level choice in this app: which shader is playing, and
 * what the shutter produces. Extracted from ShaderTabs when the second one
 * arrived, so the two cannot drift — the track is a recess pressed into whatever
 * surface it lands on, and the selected cell climbs back out of it. Reading the
 * substrate rather than hardcoding a level is what lets the same component sit
 * in the light floating toolbar, in the pinned-dark mobile bar and in the sheet
 * and read raised in all three. The recipe itself lives in
 * lib/surface-classes.ts, shared with the appearance toggle.
 */
export function SegmentedTabs({
  options,
  value,
  onChange,
  ariaLabel,
  layoutIdPrefix,
  layoutIdSuffix,
  size = "desktop",
  disabled = false,
}: SegmentedTabsProps) {
  const prefersReducedMotion = useReducedMotion()
  const substrate = useSurface()
  const raised = raisedThumb(substrate)

  const handleSelect = (id: string) => {
    if (disabled || id === value) return
    void playDigitalClick("medium")
    onChange(id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      // Dimmed and inert together. The same idiom the mobile bar already uses
      // for the controls it hides behind the sheet, rather than a new disabled
      // variant that would have to invent its own colour.
      className={cn(
        "flex items-center rounded-full bg-foreground/[0.06] transition-opacity duration-150 ease-out motion-reduce:transition-none",
        SIZES[size].track,
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {options.map((option) => {
        const isSelected = option.id === value

        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => handleSelect(option.id)}
            className={cn(
              "relative flex items-center justify-center rounded-full transition-[color,transform] duration-150 ease-out active:scale-[0.97] motion-reduce:transition-none",
              SIZES[size].cell,
              SIZES[size].text,
              isSelected ? "text-foreground" : "text-muted-foreground hoverFine:text-foreground",
            )}
          >
            {isSelected && (
              <motion.span
                layoutId={
                  prefersReducedMotion ? undefined : `${layoutIdPrefix}-${layoutIdSuffix}`
                }
                transition={spring.moderate}
                aria-hidden
                className={cn("absolute inset-0", raised)}
                style={{ borderRadius: CELL_HEIGHT / 2 }}
              />
            )}
            {/* Above the indicator, which is painted into the same box. */}
            <span className="relative whitespace-nowrap">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
