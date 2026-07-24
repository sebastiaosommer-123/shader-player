"use client"

import { ChevronRight } from "lucide-react"
import type { ShaderParameterGroup } from "@/lib/shader-configs"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { cn } from "@/lib/utils"
import { ParameterSlider } from "./parameter-slider"
import { ColorPicker } from "./color-picker"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useCollapsedGroup } from "@/hooks/use-collapsed-group"
import { playDigitalClick } from "@/lib/audio-feedback"

interface ParameterGroupProps {
  group: ShaderParameterGroup
  params: ShaderParams
  onChange: (key: string, value: number | string) => void
  // Collapsed state is kept per shader, so the same group name can be open in
  // one shader and closed in another.
  shaderId: string
  // The floating panel packs its groups tighter than the sidebar and sheet do.
  spacing?: "normal" | "compact"
}

export function ParameterGroup({ group, params, onChange, shaderId, spacing = "normal" }: ParameterGroupProps) {
  const gap = spacing === "compact" ? "space-y-1" : "space-y-3"
  // The header-to-parameters gap rides on the content, not on the group root:
  // as `space-y` it became a bottom margin on the header and survived the
  // collapse, leaving dead space under every closed section.
  const headerGap = spacing === "compact" ? "pt-1" : "pt-3"
  const [collapsed, toggleCollapsed] = useCollapsedGroup(shaderId, group.name)

  const handleToggle = () => {
    playDigitalClick("weak")
    toggleCollapsed()
  }

  return (
    <Collapsible open={!collapsed} onOpenChange={handleToggle}>
      <CollapsibleTrigger className="group flex h-9 w-full items-center justify-between uppercase tracking-wider text-muted-foreground text-sm cursor-pointer hoverFine:text-foreground transition-colors duration-150 motion-reduce:transition-none">
        <h3>{group.name}</h3>
        {/* Deliberately not the dropdown's ChevronDown: that one opens a menu
            over the page, this reveals content in place. Pointing right at rest
            keeps the two from looking alike, and the smaller size keeps a
            section header lighter than the shader control it sits under. */}
        <ChevronRight
          className="size-3.5 shrink-0 transition-transform duration-150 motion-reduce:transition-none group-data-[state=open]:rotate-90"
        />
      </CollapsibleTrigger>

      {/* The collapsible-down/up keyframes and the --radix-collapsible-content-height
          they read both ship with tw-animate-css, so the height animation needs
          no CSS of its own. */}
      <CollapsibleContent className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up motion-reduce:animate-none">
        <div className={cn(headerGap, group.layout === "wrap" ? "flex flex-wrap gap-2" : gap)}>
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
      </CollapsibleContent>
    </Collapsible>
  )
}
