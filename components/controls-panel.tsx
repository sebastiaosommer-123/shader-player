"use client"

import { useCallback, useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useReducedMotion } from "framer-motion"
import { X } from "lucide-react"

import type { ShaderParams } from "@/lib/shader-uniforms"
import { getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { controlsSplit } from "@/lib/springs"
import { CreditsFooter } from "./credits-footer"
import { ParameterGroup } from "./parameter-group"
import { ShaderTabs } from "./shader-tabs"

interface ControlsPanelProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
  /** Freezes the shader picker mid-clip. The parameters below it stay live. */
  isRecording?: boolean
}

/** The scrim reaches full strength this far into the scroll. */
const SCRIM_RAMP_PX = 24

/** The visible fade, and the number this was specified at. */
const SCRIM_HEIGHT_PX = 56

/**
 * How far the scrim reaches *up*, behind the header, and why it has to.
 *
 * The scroll region and the scrim are two boxes sharing one edge — the header's
 * bottom — and a shared edge is a rounding decision each of them makes on its
 * own. The scroller is composited on its own layer, so its clip and the scrim's
 * paint land on device pixels independently: wherever the edge falls on a
 * fraction, one of them rounds up and a hairline of unveiled content survives
 * between them. It is invisible at DPR 2 with an even viewport, where the edge
 * is a whole device pixel; a phone at DPR 3 with an odd height puts it on a half.
 *
 * Overlapping removes the shared edge rather than trying to align it. The four
 * pixels cost nothing — they sit behind an opaque header — and the gradient's
 * first stop is pushed down by the same amount, so the *visible* fade still
 * starts exactly at the header's edge and is still SCRIM_HEIGHT_PX tall.
 */
const SCRIM_OVERLAP_PX = 4

/**
 * The bottom half of the mobile screen, once the viewfinder has stepped back to
 * make room for it.
 *
 * Not a sheet, which is what it used to be and why it used to be called one. A
 * sheet slides over the canvas; this occupies space the canvas gave up — see
 * `controlsSplit` for the mechanism, and app/page.tsx for the half that moves.
 *
 * Still a Radix dialog, though, and deliberately: the focus trap, Escape,
 * focus return and dismiss-on-outside-tap all come free, and the last of those
 * is now a required behaviour — the shrunken canvas above is the natural way
 * back out, and it is "outside" as far as the dialog is concerned.
 */
export function ControlsPanel({
  params,
  setParams,
  open,
  onOpenChange,
  shaderId,
  onShaderChange,
  isRecording = false,
}: ControlsPanelProps) {
  const prefersReducedMotion = useReducedMotion()
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const scrimRef = useRef<HTMLDivElement>(null)

  const { enter, exit, ease, panelTravelPx, openFraction } = controlsSplit
  const duration = open ? enter.panelMs : exit.panelMs
  const delay = open ? enter.panelDelayMs : 0

  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  /**
   * The scrim's strength, written straight to the element.
   *
   * No state and no re-render: this fires on every scroll frame, and a setState
   * here would re-render every parameter group and every slider in the panel to
   * change one number on one div. The same reasoning RecordingTimer gives for
   * taking a MotionValue instead of a prop.
   *
   * Ramped rather than switched, because at rest there is nothing underneath the
   * header to veil — a scrim that is already at full strength on an unscrolled
   * panel just makes the first group look dimmed.
   */
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const scrim = scrimRef.current
    if (!scrim) return
    scrim.style.opacity = `${Math.min(event.currentTarget.scrollTop / SCRIM_RAMP_PX, 1)}`
  }, [])

  const shaderConfig = getShaderConfig(shaderId)

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-modal="true"
          aria-describedby={undefined}
          inert={!open}
          onOpenAutoFocus={() => {
            // There is no Radix trigger in this controlled composition, so
            // remember the control that opened us before focus enters the panel.
            returnFocusRef.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
            returnFocusRef.current = null
          }}
          onEscapeKeyDown={() => playDigitalClick("strong")}
          // Tapping the canvas above is a dismiss, and it gets the same receipt
          // as the X and as Escape.
          onPointerDownOutside={() => playDigitalClick("strong")}
          // `dark` matches the mobile control bar: this panel only ever opens on
          // mobile, so it stays on the dark palette whatever the page theme is.
          //
          // No radius, no border and no shadow. Those were a sheet's — the edge
          // where something lying on top of the page begins. This is the page:
          // the canvas ends, and the controls start.
          className="dark fixed inset-x-0 bottom-0 top-[50vh] z-50 flex flex-col bg-background text-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:pointer-events-none motion-reduce:animate-none"
          style={{
            // The other half of controlsSplit.openFraction. The page root is
            // exactly 100dvh tall and the canvas is scaled against that same
            // fraction of it, so this edge and the canvas's bottom edge are
            // derived from one number and cannot drift — the canvas simply stops
            // controlsSplit.canvasGapPx short of it.
            //
            // `top-[50vh]` in the class list above is the fallback for browsers
            // without `dvh`, which drop this declaration and keep that one —
            // the same arrangement the page root uses for h-screen/100dvh. It
            // is the one number here that has to be kept in step with
            // openFraction by hand, because Tailwind cannot see a computed
            // class name.
            top: `${openFraction * 100}dvh`,
            // The travel, from the token rather than from a slide-in-from-*
            // utility, so `panelTravelPx` is the only place it is written down.
            // tw-animate-css's enter/exit keyframes read exactly these two.
            "--tw-enter-translate-y": `${panelTravelPx}px`,
            "--tw-exit-translate-y": `${panelTravelPx}px`,
            animationDuration: prefersReducedMotion ? "0ms" : `${duration}ms`,
            animationDelay: prefersReducedMotion ? "0ms" : `${delay}ms`,
            animationTimingFunction: ease,
            // Required, not defensive. tw-animate-css defaults the fill mode to
            // `forwards`, so for the length of animationDelay the panel would
            // sit at its *resting* style — fully opaque, in place — and then
            // snap back to the start of the animation. `both` holds the first
            // keyframe through the delay instead.
            animationFillMode: "both",
          } as React.CSSProperties}
        >
          {/* Fixed, and that is the whole shape of this panel: the title and the
              way out never move, and everything else runs underneath them. */}
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              onClick={() => playDigitalClick("strong")}
              // `relative z-10 bg-background` is what the scrim's overlap hides
              // behind. The colour is the same one the panel root already paints,
              // so nothing changes to look at — it is here to be opaque, and to
              // sit above a sibling that now reaches up underneath it.
              className="relative z-10 flex w-full shrink-0 items-center justify-between bg-background px-4 py-4 transition-transform duration-[125ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <DialogPrimitive.Title asChild>
                <span className="font-mono text-sm">Shader Controls</span>
              </DialogPrimitive.Title>
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>

          <div className="relative min-h-0 flex-1">
            <div
              onScroll={handleScroll}
              // touch-action is not inherited, but html and body carry
              // `touch-action: none` below 768px to kill the page bounce — so a
              // scroller here has to name the axis it wants back. Same move the
              // gallery carousel makes for `pan-x`.
              className="flex h-full min-h-0 flex-col overflow-y-auto overscroll-contain px-4 [touch-action:pan-y]"
              style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
            >
              {/* The shader picker scrolls with the parameters now, where it
                  used to be pinned above them on the argument that which shader
                  you are on is the frame for everything below. That argument was
                  written for a sheet that covered the artwork. It no longer
                  holds: the shader is on screen above this panel the entire
                  time, so the track is not what tells you which one you have —
                  and in a panel half a screen tall, a second row of fixed chrome
                  is 48px that the parameters need more.

                  `w-fit` because the track is a recess the cells sit in, not a
                  bar the panel is divided by. Left to stretch it spans the full
                  width — a flex container is block-level — and the run of empty
                  track past the last cell reads as a fourth slot that never
                  fills. */}
              <div className="w-fit shrink-0 pb-4">
                <ShaderTabs
                  shaderId={shaderId}
                  onShaderChange={onShaderChange}
                  layoutIdPrefix="panel"
                  size="mobile"
                  disabled={isRecording}
                />
              </div>

              <div className="space-y-6">
                {shaderConfig.parameterGroups.map((group) => (
                  <ParameterGroup
                    // Keyed by shader too — see the matching note in
                    // ControlsSidebar. A bare group-name key lets React carry a
                    // Collapsible over to a shader that shares the name, and it
                    // replays its open animation against the height it measured
                    // for the previous shader.
                    key={`${shaderId}:${group.name}`}
                    group={group}
                    params={params}
                    onChange={updateParam}
                    shaderId={shaderId}
                  />
                ))}
              </div>

              {/* No appearance control: this panel and the bar behind it are
                  both pinned `dark`, so the only thing the setting still reaches
                  from here is the wallpaper gallery — not enough to justify a
                  control that can't show its own effect. */}
              <div className="mt-auto pt-6">
                <CreditsFooter />
              </div>
            </div>

            {/* Where the scrolling half passes under the fixed half. A gradient
                in the panel's own background rather than a mask on the scroller:
                a mask would clip the colour picker's popover, which opens out of
                this box, and parameter-group already documents what a stray clip
                does to a slider's tooltip. */}
            <div
              ref={scrimRef}
              aria-hidden
              className="pointer-events-none absolute inset-x-0"
              style={{
                top: -SCRIM_OVERLAP_PX,
                height: SCRIM_HEIGHT_PX + SCRIM_OVERLAP_PX,
                opacity: 0,
                // Solid until the overlap is spent, so the fade itself begins on
                // the header's edge and runs the full SCRIM_HEIGHT_PX below it.
                // The last stop is implicit at 100%, which is that exact point.
                backgroundImage: `linear-gradient(to bottom, var(--background) ${SCRIM_OVERLAP_PX}px, transparent)`,
              }}
            />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
