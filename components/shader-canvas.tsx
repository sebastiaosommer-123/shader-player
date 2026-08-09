"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import { useReducedMotion } from "framer-motion"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { initShader, updateUniforms } from "@/lib/shader-renderer"

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
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number>()
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
    if (shaderIdRef.current !== shaderId && glRef.current) {
      console.log("[v0] Shader changed, reinitializing program")
      shaderIdRef.current = shaderId
      programRef.current = initShader(glRef.current, shaderId)
    }
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
    programRef.current = initShader(gl, shaderId)

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
      if (!gl || !programRef.current) return

      updateUniforms(gl, programRef.current, paramsRef.current, elapsed(), canvas.width, canvas.height, shaderIdRef.current)

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
      if (!gl || !programRef.current || isPausedRef.current || reducedMotionRef.current) {
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
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      renderFnRef.current = null
      drawFrameRef.current = null
      isLoopRunningRef.current = false
    }
  }, [shaderId])

  return <canvas ref={canvasRef} className="w-full h-full" />
})

ShaderCanvas.displayName = "ShaderCanvas"
