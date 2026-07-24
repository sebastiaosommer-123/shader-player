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
  onResizeStart: (event: React.PointerEvent<HTMLElement>) => void
  isResizing: boolean
}

export function ControlsSidebar({
  params,
  setParams,
  shaderId,
  onShaderChange,
  onResizeStart,
  isResizing,
}: ControlsSidebarProps) {
  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  const shaderConfig = getShaderConfig(shaderId)

  return (
    // No width transition: it would lag behind the pointer during a drag. The
    // scroll lives on the inner column, not here — `overflow-y-auto` computes
    // `overflow-x` to `auto` too, which would clip the half of the grip that
    // hangs outside this box.
    <div className="relative w-[var(--sidebar-width,280px)] shrink-0 h-full bg-background border-l border-border flex flex-col">
      {/* Resize grip. A 6px strip straddling the border gives the pointer
          something to catch; the 1px line inside is the visible part, tinted
          only on hover and while dragging so the border reads as usual at rest. */}
      <div
        onPointerDown={onResizeStart}
        aria-hidden
        className="group absolute inset-y-0 -left-[3px] z-20 w-[6px] cursor-col-resize touch-none"
      >
        <div
          className={`h-full w-px transition-colors duration-150 motion-reduce:transition-none ${
            isResizing ? "bg-foreground/20" : "bg-transparent group-hoverFine:bg-foreground/20"
          }`}
        />
      </div>

      {/* The scroll container has to be its own wrapper: putting the overflow on
          the padded column below turns that column into a definite-height flex
          parent, and its children — the shader dropdown first — get squashed
          instead of keeping their natural height. */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        <div className="p-4 space-y-5 bg-background flex-1 flex flex-col">
          <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />

          {shaderConfig.parameterGroups.map((group) => (
            <ParameterGroup
              key={group.name}
              group={group}
              params={params}
              onChange={updateParam}
              shaderId={shaderId}
            />
          ))}

          <div className="mt-auto space-y-4">
            <AppearanceControl />
            <CreditsFooter />
          </div>
        </div>
      </div>
    </div>
  )
}
