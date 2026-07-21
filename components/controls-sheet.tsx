"use client"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterGroup } from "./parameter-group"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { X } from "lucide-react"
import { playDigitalClick } from "@/lib/audio-feedback"
import { CreditsFooter } from "./credits-footer"
import { useReducedMotion } from "framer-motion"
import { AppearanceControl } from "./appearance-control"

interface ControlsSheetProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

export function ControlsSheet({ params, setParams, open, onOpenChange, shaderId, onShaderChange }: ControlsSheetProps) {
  const prefersReducedMotion = useReducedMotion()
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
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background text-foreground rounded-t-2xl border-t border-border h-[400px] sm:h-[80vh] transition-transform"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          transitionDuration: sheetDuration,
          transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
        }}
      >
        <button
          onClick={() => {
            playDigitalClick("strong")
            onOpenChange(false)
          }}
          className="w-full py-4 flex items-center justify-between px-4"
        >
          <span className="font-mono text-sm">Shader Controls</span>
          <X className="w-4 h-4" />
        </button>

        {/* Content - always rendered but with opacity transition */}
        <div
          className="overflow-y-auto h-[calc(100%-56px)] px-4 space-y-6 transition-opacity flex flex-col"
          style={{
            paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))",
            opacity: open ? 1 : 0,
            transitionDuration: contentDuration,
            transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
            transitionDelay: !prefersReducedMotion && open ? "50ms" : "0ms",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div>
            <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />
          </div>

          {shaderConfig.parameterGroups.map((group) => (
            <ParameterGroup key={group.name} group={group} params={params} onChange={updateParam} />
          ))}

          <div className="mt-auto space-y-4">
            <AppearanceControl />
            <CreditsFooter />
          </div>
        </div>
      </div>
    </>
  )
}
