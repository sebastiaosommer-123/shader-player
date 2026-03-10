"use client"

import { useEffect, useRef, forwardRef, useImperativeHandle } from "react"
import type { ShaderParams } from "@/lib/shader-uniforms"
import { initShader, updateUniforms } from "@/lib/shader-renderer"

interface ShaderCanvasProps {
  params: ShaderParams
  shaderId: string
}

export interface ShaderCanvasRef {
  getCanvas: () => HTMLCanvasElement | null
}

export const ShaderCanvas = forwardRef<ShaderCanvasRef, ShaderCanvasProps>(({ params, shaderId }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const animationRef = useRef<number>()
  const paramsRef = useRef<ShaderParams>(params)
  const shaderIdRef = useRef<string>(shaderId)

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }))

  useEffect(() => {
    paramsRef.current = params
  }, [params])

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
      if (!gl || !programRef.current) return

      const time = (Date.now() - startTime) / 1000
      updateUniforms(gl, programRef.current, paramsRef.current, time, canvas.width, canvas.height, shaderIdRef.current)

      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      animationRef.current = requestAnimationFrame(render)
    }

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
