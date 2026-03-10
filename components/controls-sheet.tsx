"use client"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterSlider } from "./parameter-slider"
import { ColorPicker } from "./color-picker"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { X } from "lucide-react"
import { playDigitalClick } from "@/lib/audio-feedback"
import { CreditsFooter } from "./credits-footer"

interface ControlsSheetProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

export function ControlsSheet({ params, setParams, open, onOpenChange, shaderId, onShaderChange }: ControlsSheetProps) {
  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  const shaderConfig = getShaderConfig(shaderId)

  return (
    <>
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-black text-white rounded-t-2xl border-t border-white/10 h-[400px] sm:h-[80vh] transition-transform duration-[300ms]"
        style={{
          transform: open ? "translateY(0)" : "translateY(100%)",
          transitionTimingFunction: "cubic-bezier(0.0, 0.0, 0.2, 1)",
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
          <X
            className="w-4 h-4 transition-transform duration-[300ms]"
            style={{ transitionTimingFunction: "cubic-bezier(0.0, 0.0, 0.2, 1)" }}
          />
        </button>

        {/* Content - always rendered but with opacity transition */}
        <div
          className="overflow-y-auto h-[calc(100%-56px)] px-4 pb-4 space-y-6 transition-opacity duration-[150ms] flex flex-col"
          style={{
            opacity: open ? 1 : 0,
            transitionTimingFunction: "cubic-bezier(0.4, 0.0, 1, 1)",
            transitionDelay: open ? "50ms" : "0ms",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <div>
            <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />
          </div>

          {shaderConfig.parameterGroups.map((group) => (
            <div key={group.name} className="space-y-3">
              <h3 className="uppercase tracking-wider text-muted-foreground text-sm">{group.name}</h3>
              {group.parameters.map((param) => {
                if (param.type === "slider") {
                  return (
                    <ParameterSlider
                      key={param.key}
                      label={param.label}
                      value={params[param.key] as number}
                      min={param.min!}
                      max={param.max!}
                      step={param.step!}
                      onChange={(v) => updateParam(param.key, v)}
                    />
                  )
                } else if (param.type === "color") {
                  return (
                    <ColorPicker
                      key={param.key}
                      label={param.label}
                      value={params[param.key] as string}
                      onChange={(v) => updateParam(param.key, v)}
                    />
                  )
                }
                return null
              })}
            </div>
          ))}

          <CreditsFooter />
        </div>
      </div>
    </>
  )
}
