"use client"

import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterSlider } from "./parameter-slider"
import { ColorPicker } from "./color-picker"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { CreditsFooter } from "./credits-footer"

interface ControlsSidebarProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

export function ControlsSidebar({ params, setParams, shaderId, onShaderChange }: ControlsSidebarProps) {
  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  const shaderConfig = getShaderConfig(shaderId)

  return (
    <div className="w-[280px] h-full bg-background border-l border-border overflow-y-auto flex flex-col">
      <div className="p-4 space-y-5 bg-background flex-1 flex flex-col">
        <h2 className="text-sm font-semibold">Shader Controls</h2>

        <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />

        {shaderConfig.parameterGroups.map((group) => (
          <div key={group.name} className="space-y-1">
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
  )
}
