"use client"

import { useState, useEffect, useRef } from "react"
import { Rnd } from "react-rnd"
import { Plus, Minus } from "lucide-react"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { ParameterGroup } from "./parameter-group"
import { ShaderSelector } from "./shader-selector"
import { getShaderConfig } from "@/lib/shader-configs"
import { CreditsFooter } from "./credits-footer"
import { useReducedMotion } from "framer-motion"

interface FloatingControlsPanelProps {
  params: ShaderParams
  setParams: (params: ShaderParams) => void
  shaderId: string
  onShaderChange: (shaderId: string) => void
}

const HEADER_HEIGHT = 36
const DEFAULT_WIDTH = 300
const DEFAULT_HEIGHT = 450
// Corner grab area, larger than the 15px grip it sits over.
const RESIZE_HANDLE_SIZE = 28
const STORAGE_KEY = "shader-player:panel-state"

// Position is deliberately not persisted — the panel returns to its default
// top-right spot on every reload.
interface PanelState {
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

function saveState(state: PanelState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function defaultPosition(width: number) {
  return { x: Math.max(0, window.innerWidth - width - 24), y: 24 }
}

export function FloatingControlsPanel({ params, setParams, shaderId, onShaderChange }: FloatingControlsPanelProps) {
  const [mounted, setMounted] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const rndRef = useRef<Rnd>(null)
  const [position, setPosition] = useState({ x: 0, y: 24 })
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT })
  const [expandedHeight, setExpandedHeight] = useState(DEFAULT_HEIGHT)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const saved = loadState()
    const w = saved.width ?? DEFAULT_WIDTH
    // Keep the panel inside the viewport on short windows.
    const h = Math.min(saved.height ?? DEFAULT_HEIGHT, window.innerHeight - 48)
    const collapsed = saved.isCollapsed ?? false

    setPosition(defaultPosition(w))
    setExpandedHeight(h)
    setSize({ width: w, height: collapsed ? HEADER_HEIGHT : h })
    setIsCollapsed(collapsed)
    setMounted(true)
  }, [])

  const updateParam = (key: string, value: number | string) => {
    setParams({ ...params, [key]: value })
  }

  const shaderConfig = getShaderConfig(shaderId)

  const handleCollapse = () => {
    if (isCollapsed) {
      setIsCollapsed(false)
      setSize(prev => ({ ...prev, height: expandedHeight }))
      saveState({ width: size.width, height: expandedHeight, isCollapsed: false })
    } else {
      setIsCollapsed(true)
      setSize(prev => ({ ...prev, height: HEADER_HEIGHT }))
      saveState({ width: size.width, height: expandedHeight, isCollapsed: true })
    }
  }

  let bodyTransition = isCollapsed
    ? 'opacity 120ms ease-out'
    : 'opacity 180ms ease-out 60ms'
  if (prefersReducedMotion) bodyTransition = 'none'

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
        resizeHandleStyles={{
          bottomRight: {
            width: RESIZE_HANDLE_SIZE,
            height: RESIZE_HANDLE_SIZE,
            right: 0,
            bottom: 0,
            cursor: "nwse-resize",
          },
        }}
        style={{ pointerEvents: "auto" }}
        onDragStop={(_e, d) => {
          setPosition({ x: d.x, y: d.y })
        }}
        onResizeStop={(_e, _dir, ref, _delta, pos) => {
          const newSize = {
            width: parseInt(ref.style.width),
            height: parseInt(ref.style.height),
          }
          setSize(newSize)
          setExpandedHeight(newSize.height)
          setPosition(pos)
          saveState({ width: newSize.width, height: newSize.height, isCollapsed })
        }}
      >
        <div className="relative flex flex-col h-full bg-background backdrop-blur-md border border-border rounded-xl shadow-2xl overflow-hidden">
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
              transition: bodyTransition,
            }}
          >
            <div className="h-full overflow-y-auto">
              <div className="p-4 space-y-5">
                <ShaderSelector currentShaderId={shaderId} onShaderChange={onShaderChange} />

                {shaderConfig.parameterGroups.map((group) => (
                  <ParameterGroup
                    key={group.name}
                    group={group}
                    params={params}
                    onChange={updateParam}
                    shaderId={shaderId}
                    spacing="compact"
                  />
                ))}

                <CreditsFooter />
              </div>
            </div>
          </div>

          {/* Resize affordance. Purely visual — the Rnd handle above it takes the drag. */}
          {!isCollapsed && (
            <div
              aria-hidden
              className="pointer-events-none absolute bottom-1.5 right-1.5 grid gap-[3px] opacity-25"
              style={{ gridTemplateColumns: "repeat(3, 3px)" }}
            >
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className={
                    Math.floor(i / 3) + (i % 3) >= 2
                      ? "w-[3px] h-[3px] rounded-full bg-foreground"
                      : "w-[3px] h-[3px]"
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Rnd>
    </div>
  )
}
