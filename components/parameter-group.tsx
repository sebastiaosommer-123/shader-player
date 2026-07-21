"use client"

import type { ShaderParameterGroup } from "@/lib/shader-configs"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { cn } from "@/lib/utils"
import { ParameterSlider } from "./parameter-slider"
import { ColorPicker } from "./color-picker"

interface ParameterGroupProps {
  group: ShaderParameterGroup
  params: ShaderParams
  onChange: (key: string, value: number | string) => void
  // The floating panel packs its groups tighter than the sidebar and sheet do.
  spacing?: "normal" | "compact"
}

export function ParameterGroup({ group, params, onChange, spacing = "normal" }: ParameterGroupProps) {
  const gap = spacing === "compact" ? "space-y-1" : "space-y-3"

  return (
    <div className={gap}>
      <h3 className="uppercase tracking-wider text-muted-foreground text-sm">{group.name}</h3>
      <div className={cn(group.layout === "wrap" ? "flex flex-wrap gap-2" : gap)}>
        {group.parameters.map((param) => {
          if (param.type === "slider") {
            return (
              <ParameterSlider
                key={param.key}
                label={param.label}
                value={params[param.key] as number}
                min={param.min}
                max={param.max}
                step={param.step}
                onChange={(v) => onChange(param.key, v)}
              />
            )
          }
          return (
            <ColorPicker
              key={param.key}
              label={param.label}
              value={params[param.key] as string}
              onChange={(v) => onChange(param.key, v)}
            />
          )
        })}
      </div>
    </div>
  )
}
