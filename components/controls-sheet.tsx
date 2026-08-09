"use client"

import { useRef } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { useReducedMotion } from "framer-motion"
import { X } from "lucide-react"

import type { ShaderParams } from "@/lib/shader-uniforms"
import { getShaderConfig } from "@/lib/shader-configs"
import { playDigitalClick } from "@/lib/audio-feedback"
import { CreditsFooter } from "./credits-footer"
import { ParameterGroup } from "./parameter-group"

interface ControlsSheetProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  shaderId: string
}

export function ControlsSheet({ params, setParams, open, onOpenChange, shaderId }: ControlsSheetProps) {
  const prefersReducedMotion = useReducedMotion()
  const returnFocusRef = useRef<HTMLElement | null>(null)
  let sheetDuration = open ? "250ms" : "200ms"
  let contentDuration = open ? "150ms" : "100ms"
  if (prefersReducedMotion) {
    sheetDuration = "0ms"
    contentDuration = "0ms"
  }
  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

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
            // remember the control that opened us before focus enters the sheet.
            returnFocusRef.current = document.activeElement as HTMLElement | null
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            returnFocusRef.current?.focus()
            returnFocusRef.current = null
          }}
          onEscapeKeyDown={() => playDigitalClick("strong")}
          // `dark` matches the mobile control bar: this sheet only ever opens
          // on mobile, so it stays on the dark palette whatever the page theme
          // is.
          className="dark fixed bottom-0 left-0 right-0 z-50 h-[400px] rounded-t-2xl border-t border-border bg-background text-foreground outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom-full data-[state=closed]:slide-out-to-bottom-full data-[state=closed]:pointer-events-none motion-reduce:animate-none sm:h-[80vh]"
          style={{
            animationDuration: sheetDuration,
            animationTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
          }}
        >
          <DialogPrimitive.Close asChild>
            <button
              type="button"
              onClick={() => playDigitalClick("strong")}
              className="flex w-full items-center justify-between px-4 py-4 transition-transform duration-[125ms] ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
            >
              <DialogPrimitive.Title asChild>
                <span className="font-mono text-sm">Shader Controls</span>
              </DialogPrimitive.Title>
              <X className="h-4 w-4" />
            </button>
          </DialogPrimitive.Close>

          <div
            data-state={open ? "open" : "closed"}
            className="flex h-[calc(100%-56px)] flex-col space-y-6 overflow-y-auto px-4 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 motion-reduce:animate-none"
            style={{
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
              animationDuration: contentDuration,
              animationTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
              animationDelay: !prefersReducedMotion && open ? "50ms" : "0ms",
            }}
          >
            {/* No shader picker here: the tab bar in the control bar behind this
                sheet already shows all three, so the sheet is purely the active
                shader's parameters. */}
            {shaderConfig.parameterGroups.map((group) => (
              <ParameterGroup
                // Keyed by shader too — see the matching note in ControlsSidebar.
                // A bare group-name key lets React carry a Collapsible over to a
                // shader that shares the name, and it replays its open animation
                // against the height it measured for the previous shader.
                key={`${shaderId}:${group.name}`}
                group={group}
                params={params}
                onChange={updateParam}
                shaderId={shaderId}
              />
            ))}

            {/* No appearance control: this sheet and the bar behind it are both
                pinned `dark`, so the only thing the setting still reaches from
                here is the wallpaper gallery — not enough to justify a control
                that can't show its own effect. */}
            <div className="mt-auto">
              <CreditsFooter />
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
