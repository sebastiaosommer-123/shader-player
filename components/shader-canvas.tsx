"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { useReducedMotion } from "framer-motion"
import type { ShaderParams } from "@/lib/shader-uniforms"
import {
  disposeShader,
  initShader,
  updateUniforms,
  type ShaderResources,
} from "@/lib/shader-renderer"

interface ShaderCanvasProps {
  params: ShaderParams
  shaderId: string
  isPaused?: boolean
}

export interface ShaderCanvasRef {
  getCanvas: () => HTMLCanvasElement | null
}

export const ShaderCanvas = forwardRef<ShaderCanvasRef, ShaderCanvasProps>(({ params, shaderId, isPaused = false }, ref) => {
  const prefersReducedMotion = useReducedMotion()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const resourcesRef = useRef<ShaderResources | null>(null)
  const animationRef = useRef<number | null>(null)
  const paramsRef = useRef<ShaderParams>(params)
  const shaderIdRef = useRef<string>(shaderId)
  const isPausedRef = useRef(isPaused)
  const reducedMotionRef = useRef(Boolean(prefersReducedMotion))
  const pausedAtRef = useRef<number | null>(null)
  const totalPausedTimeRef = useRef(0)
  const renderFnRef = useRef<(() => void) | null>(null)
  const drawFrameRef = useRef<(() => void) | null>(null)
  const isLoopRunningRef = useRef(false)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }))

  useEffect(() => {
    paramsRef.current = params
    if (isPausedRef.current || reducedMotionRef.current) {
      drawFrameRef.current?.()
    }
  }, [params])

  useEffect(() => {
    const wasStopped = isPausedRef.current || reducedMotionRef.current

    isPausedRef.current = isPaused
    reducedMotionRef.current = Boolean(prefersReducedMotion)

    const isStopped = isPausedRef.current || reducedMotionRef.current

    if (isStopped && !wasStopped) {
      pausedAtRef.current = Date.now()
      drawFrameRef.current?.()
    } else if (!isStopped && wasStopped) {
      if (pausedAtRef.current !== null) {
        totalPausedTimeRef.current += Date.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
      if (!isLoopRunningRef.current && renderFnRef.current) {
        isLoopRunningRef.current = true
        renderFnRef.current()
      }
    }
  }, [isPaused, prefersReducedMotion])

  useEffect(() => {
    if (shaderIdRef.current === shaderId) return

    const gl = glRef.current
    if (!gl) return

    console.log("[v0] Shader changed, reinitializing program")
    const next = initShader(gl, shaderId)
    if (!next) return

    const previous = resourcesRef.current
    resourcesRef.current = next
    shaderIdRef.current = shaderId
    drawFrameRef.current?.()

    if (previous) disposeShader(gl, previous)
  }, [shaderId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", {
      antialias: true,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: true,
    })
    if (!gl) {
      console.error("[v0] WebGL not supported")
      return
    }

    glRef.current = gl
    resourcesRef.current = initShader(gl, shaderIdRef.current)

    const startTime = Date.now()
    totalPausedTimeRef.current = 0
    pausedAtRef.current = isPausedRef.current || reducedMotionRef.current ? startTime : null

    // Elapsed shader time, frozen at the moment of pausing so a redraw while
    // paused reproduces the same frame rather than jumping forward.
    const elapsed = () => {
      const now = pausedAtRef.current ?? Date.now()
      return (now - startTime - totalPausedTimeRef.current) / 1000
    }

    const drawFrame = () => {
      const resources = resourcesRef.current
      if (!resources) return

      updateUniforms(
        gl,
        resources.program,
        paramsRef.current,
        elapsed(),
        canvas.width,
        canvas.height,
        shaderIdRef.current,
      )

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    drawFrameRef.current = drawFrame

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      gl.viewport(0, 0, canvas.width, canvas.height)

      // Resizing the drawing buffer wipes it, and ResizeObserver callbacks run
      // *after* this frame's requestAnimationFrame — so without an immediate
      // redraw the browser paints one empty (black) frame for every step of a
      // sidebar drag, which reads as flicker.
      drawFrame()
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
    })
    resizeObserver.observe(canvas)

    resize()

    window.addEventListener("resize", resize)

    const render = () => {
      if (!resourcesRef.current || isPausedRef.current || reducedMotionRef.current) {
        isLoopRunningRef.current = false
        return
      }

      drawFrame()

      animationRef.current = requestAnimationFrame(render)
    }

    renderFnRef.current = render
    isLoopRunningRef.current = true
    render()

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", resize)
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (resourcesRef.current) {
        disposeShader(gl, resourcesRef.current)
        resourcesRef.current = null
      }
      glRef.current = null
      renderFnRef.current = null
      drawFrameRef.current = null
      isLoopRunningRef.current = false
    }
  }, [])

  return <canvas ref={canvasRef} className="w-full h-full" />
})

ShaderCanvas.displayName = "ShaderCanvas"
