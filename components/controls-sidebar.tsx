"use client"

import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterGroup } from "./parameter-group"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { CreditsFooter } from "./credits-footer"
import { AppearanceControl } from "./appearance-control"

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
        <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />

        {shaderConfig.parameterGroups.map((group) => (
          <ParameterGroup key={group.name} group={group} params={params} onChange={updateParam} />
        ))}

        <div className="mt-auto space-y-4">
          <AppearanceControl />
          <CreditsFooter />
        </div>
      </div>
    </div>
  )
}
