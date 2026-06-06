"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
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
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number>()
  const paramsRef = useRef<ShaderParams>(params)
  const shaderIdRef = useRef<string>(shaderId)
  const isPausedRef = useRef(isPaused)
  const pausedAtRef = useRef<number | null>(null)
  const totalPausedTimeRef = useRef(0)
  const renderFnRef = useRef<(() => void) | null>(null)
  const isLoopRunningRef = useRef(false)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }))

  useEffect(() => {
    paramsRef.current = params
  }, [params])

  useEffect(() => {
    const wasPaused = isPausedRef.current
    isPausedRef.current = isPaused

    if (isPaused && !wasPaused) {
      pausedAtRef.current = Date.now()
    } else if (!isPaused && wasPaused) {
      if (pausedAtRef.current !== null) {
        totalPausedTimeRef.current += Date.now() - pausedAtRef.current
        pausedAtRef.current = null
      }
      if (!isLoopRunningRef.current && renderFnRef.current) {
        isLoopRunningRef.current = true
        renderFnRef.current()
      }
    }
  }, [isPaused])

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

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()

      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr

      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
    })
    resizeObserver.observe(canvas)

    resize()

    window.addEventListener("resize", resize)

    const startTime = Date.now()

    const render = () => {
      if (!gl || !programRef.current || isPausedRef.current) {
        isLoopRunningRef.current = false
        return
      }

      const time = (Date.now() - startTime - totalPausedTimeRef.current) / 1000
      updateUniforms(gl, programRef.current, paramsRef.current, time, canvas.width, canvas.height, shaderIdRef.current)

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

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
    }
  }, [shaderId])

  return <canvas ref={canvasRef} className="w-full h-full" />
})

ShaderCanvas.displayName = "ShaderCanvas"
