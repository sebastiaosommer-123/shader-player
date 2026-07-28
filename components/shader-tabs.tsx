"use client"

import { motion, useReducedMotion } from "framer-motion"
import { getAllShaderIds, getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { useSurface } from "@/lib/surface-context"
import { surfaceClasses } from "@/lib/surface-classes"
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
 * Desktop's cells fill the track outright — no padding, no gap — so the selected
 * indicator is a 48px circle, the same box as the thumbnail slot and the shutter
 * ring on either side of it. Three identical circles across the bar, and the
 * recess reads as the capsule behind the two unselected digits. The digit steps
 * up to 16px with them; 14px is lost in a 48px circle.
 *
 * Mobile's neighbours are 44 and its cells are 40 for the touch target, so it
 * keeps its inset track.
 */
const SIZES = {
  desktop: { track: "gap-0 p-0", cell: "size-12", text: "text-base" },
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
  //
  // Four steps, not one, because the thing to clear is the track, not the bar.
  // The track is a 6% white wash over the substrate, which in dark mode lifts
  // it further than a single surface step does — at +1 the "raised" cell came
  // out *darker* than the recess around it, and the only thing still reading as
  // a thumb was the ring. Fill first, outline second.
  //
  // Shadow pinned at 2 for the same reason: level 3 and up add a black
  // `0 0 0 1px` outside the box, which is a contact shadow for something
  // floating on a page. There is nothing to cast onto inside a recess, so on a
  // dark track it just draws a moat.
  const raised = surfaceClasses(substrate + 4, 2)

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
            // The label is a placeholder digit until each shader has an icon, so
            // the name has to reach screen readers and hover some other way —
            // there is no dropdown listing the names any more.
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
                // Both themes paint a 1px hairline, on opposite sides of the
                // box: light spreads it outward (`0 0 0 1px`), dark draws it
                // inset. Filling the cell edge to edge would therefore render
                // 50px in light and 48 in dark, against a shutter that is 48 in
                // both — its ring being a border, always inside. So pull the
                // box in by the hairline's width only where the hairline sits
                // outside it, and both themes land on 48.
                className={cn("absolute inset-px dark:inset-0 rounded-full", raised)}
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
