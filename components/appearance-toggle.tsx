"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { FluidTooltip } from "@/components/ui/tooltip"
import { playDigitalClick } from "@/lib/audio-feedback"
import { spring } from "@/lib/springs"

/**
 * Three states, not two. A sun/moon toggle can only express the two overrides,
 * so the first click strands the user off `system` with no way back — and
 * `system` is the one setting that respects an OS-level preference that may
 * have been made for photophobia rather than taste. Cycling keeps it reachable
 * at the same one-click cost.
 *
 * Deliberately no time-of-day default either: the OS already switches on real
 * sunset for the user's location and publishes the result through
 * `prefers-color-scheme`, which `system` reads. A clock heuristic here would
 * be a worse copy of that, and would disagree with it for hours at a time.
 */
const ORDER = ["system", "light", "dark"] as const
type Appearance = (typeof ORDER)[number]

const ICONS: Record<Appearance, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
}

const LABELS: Record<Appearance, string> = {
  system: "Appearance: match system",
  light: "Appearance: light",
  dark: "Appearance: dark",
}

export function AppearanceToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => setMounted(true), [])

  // `theme` is undefined until next-themes reads storage on the client, and
  // rendering a guessed icon before then would flash the wrong one.
  const current: Appearance = mounted && ORDER.includes(theme as Appearance) ? (theme as Appearance) : "system"
  const Icon = ICONS[current]

  const handleClick = () => {
    void playDigitalClick("medium")
    setTheme(ORDER[(ORDER.indexOf(current) + 1) % ORDER.length])
  }

  return (
    <FluidTooltip content={mounted ? LABELS[current] : "Appearance"} side="top">
      <button
        type="button"
        onClick={handleClick}
        // The label carries the state, not just the control's name: an
        // icon-only button that cycles gives a screen reader no other way to
        // know which of the three it is currently on.
        aria-label={mounted ? LABELS[current] : "Appearance"}
        // 32px, not the 36px the sliders use: the credit line needs 206px of
        // the sidebar's 247px, and a 36px button plus the gap tipped the row
        // over into wrapping the text at the *default* width, not just the
        // minimum. `shrink-0` keeps it square while the text reflows around it.
        //
        // `-mr-2` is optical alignment, not a nudge. The box is 32px around a
        // 16px glyph, so sitting the box flush with the column left the mark
        // 8px inside the right edge every slider and swatch above it lines up
        // on. Pulling the box out by exactly its own padding puts the glyph on
        // that edge while the 32px hit area survives; the hover fill bleeds
        // into the sidebar's padding, which still leaves 8px to the frame.
        className="-mr-2 shrink-0 flex size-8 items-center justify-center rounded-[8px] text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hoverFine:text-foreground hoverFine:bg-foreground/[0.06] active:scale-[0.97] motion-reduce:transition-none"
      >
        {/* The icon swaps rather than morphs — three unrelated glyphs have no
            shared shape to tween — so it cross-fades on a short rise. */}
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={current}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -3, transition: spring.fast.exit }}
            transition={spring.fast}
            className="flex"
          >
            <Icon className="size-4" />
          </motion.span>
        </AnimatePresence>
      </button>
    </FluidTooltip>
  )
}
