"use client"

import { useState, useEffect, useRef } from "react"
import { Rnd } from "react-rnd"
import { Plus, Minus } from "lucide-react"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterSlider } from "./parameter-slider"
import { ColorPicker } from "./color-picker"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { CreditsFooter } from "./credits-footer"

interface FloatingControlsPanelProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

const HEADER_HEIGHT = 36
const DEFAULT_WIDTH = 280
const DEFAULT_HEIGHT = 360
const STORAGE_KEY = "shader-player:panel-state"

interface PanelState {
  x: number
  y: number
  width: number
  height: number
  isCollapsed: boolean
}

function loadState(): Partial<PanelState> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<PanelState>
  } catch {
    return {}
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function FloatingControlsPanel({ params, setParams, shaderId, onShaderChange }: FloatingControlsPanelProps) {
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const rndRef = useRef<Rnd>(null)
  const [position, setPosition] = useState({ x: 0, y: 24 })
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [expandedHeight, setExpandedHeight] = useState(DEFAULT_HEIGHT)

  useEffect(() => {
    const saved = loadState()
    const w = saved.width ?? DEFAULT_WIDTH
    const h = saved.height ?? DEFAULT_HEIGHT
    const collapsed = saved.isCollapsed ?? false
    const x = clamp(saved.x ?? window.innerWidth - w - 24, 0, window.innerWidth - w)
    const y = clamp(saved.y ?? 24, 0, window.innerHeight - HEADER_HEIGHT)

    setPosition({ x, y })
    setExpandedHeight(h)
    setSize({ width: w, height: collapsed ? HEADER_HEIGHT : h })
    setIsCollapsed(collapsed)
    setMounted(true)
  }, [])

  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  const shaderConfig = getShaderConfig(shaderId)

  const COLLAPSE_DURATION = 220

  const handleCollapse = () => {
    // Set transition directly on the DOM element before React's size update lands,
    // so the browser sees a previous painted state to interpolate from.
    const el = rndRef.current?.getSelfElement() as HTMLElement | null
    if (el) {
      el.style.transition = `height ${COLLAPSE_DURATION}ms cubic-bezier(0.23, 1, 0.32, 1)`
      setTimeout(() => { el.style.transition = '' }, COLLAPSE_DURATION + 50)
    }

    if (isCollapsed) {
      setIsCollapsed(false)
      setSize(prev => ({ ...prev, height: expandedHeight }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x, y: position.y,
        width: size.width, height: expandedHeight,
        isCollapsed: false,
      }))
    } else {
      setIsCollapsed(true)
      setSize(prev => ({ ...prev, height: HEADER_HEIGHT }))
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        x: position.x, y: position.y,
        width: size.width, height: expandedHeight,
        isCollapsed: true,
      }))
    }
  }

  if (!mounted) return null

  return (
    <div className="hidden md:block fixed inset-0 pointer-events-none z-40">
      <Rnd
        ref={rndRef}
        size={size}
        position={position}
        bounds="parent"
        minWidth={240}
        maxWidth={480}
        minHeight={isCollapsed ? HEADER_HEIGHT : 200}
        dragHandleClassName="drag-handle"
        enableResizing={isCollapsed ? false : { bottomRight: true }}
        style={{ pointerEvents: "auto" }}
        onDragStop={(_e, d) => {
          const newPos = { x: d.x, y: d.y }
          setPosition(newPos)
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            x: newPos.x, y: newPos.y,
            width: size.width, height: expandedHeight,
            isCollapsed,
          }))
        }}
        onResizeStop={(_e, _dir, ref, _delta, pos) => {
          const newSize = {
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
          }
          setSize(newSize)
          setExpandedHeight(newSize.height)
          setPosition(pos)
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            x: pos.x, y: pos.y,
            width: newSize.width, height: newSize.height,
            isCollapsed,
          }))
        }}
      >
        <div className="flex flex-col h-full bg-background backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header / drag handle */}
          <div className="drag-handle flex items-center gap-2 px-3 border-b border-border/50 cursor-grab active:cursor-grabbing select-none flex-shrink-0" style={{ height: HEADER_HEIGHT }}>
            <div className="grid gap-[3px] opacity-25 flex-shrink-0" style={{ gridTemplateColumns: "repeat(3, 3px)" }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-[3px] h-[3px] rounded-full bg-foreground" />
              ))}
            </div>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
<span className="text-sm text-foreground font-normal truncate">Shader Controls</span>
            </div>
            <button
              onClick={e => { e.stopPropagation(); handleCollapse() }}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hoverFine:text-foreground hoverFine:bg-accent transition-colors flex-shrink-0"
              aria-label={isCollapsed ? "Expand controls" : "Collapse controls"}
            >
              {isCollapsed ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
            </button>
          </div>

          {/* Body */}
          <div
            className="flex-1 overflow-hidden"
            style={{
              opacity: isCollapsed ? 0 : 1,
              transition: isCollapsed
                ? 'opacity 120ms ease-out'
                : 'opacity 180ms ease-out 60ms',
            }}
          >
            <div className="h-full overflow-y-auto">
              <div className="p-4 space-y-5">
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
          </div>
        </div>
      </Rnd>
    </div>
  )
}
