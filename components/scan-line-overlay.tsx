"use client"

import { useEffect, useRef } from "react"
import { playScanSound } from "@/lib/scan-audio"

interface ScanLineOverlayProps {
  src: string
  onComplete: () => void
}

export function ScanLineOverlay({ src, onComplete }: ScanLineOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number>()
  const startTimeRef = useRef<number>()
  const glRef = useRef<WebGLRenderingContext | null>(null)
  const programRef = useRef<WebGLProgram | null>(null)
  const positionBufferRef = useRef<WebGLBuffer | null>(null)
  const positionLocationRef = useRef<number>(0)
  const textureRef = useRef<WebGLTexture | null>(null)
  const uResolutionRef = useRef<WebGLUniformLocation | null>(null)
  const uTimeRef = useRef<WebGLUniformLocation | null>(null)
  const uTextureRef = useRef<WebGLUniformLocation | null>(null)
  const soundCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    })
    glRef.current = gl
    if (!gl) return

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    const precision = isMobile ? "lowp" : "mediump"

    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    const fsSource = `
      precision ${precision} float;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform sampler2D u_texture;

      void main() {
        vec2 uv = gl_FragCoord.xy / u_resolution.xy;
        uv.y = 1.0 - uv.y; // scan starts at top

        vec4 texColor = texture2D(u_texture, uv);

        float t = u_time;
        float scanPos;
        if (t < 0.5) {
          scanPos = 4.0 * t * t * t;
        } else {
          float f = (2.0 * t - 2.0);
          scanPos = 0.5 * f * f * f + 1.0;
        }

        float dist = abs(uv.y - scanPos);

        float core = 1.0 - smoothstep(0.0, 0.02, dist);

        float glow = exp(-dist * 14.0);
        glow = pow(glow, 1.8);

        float trail = exp(-dist * 3.0) * 0.2;
        trail *= 1.0 - smoothstep(0.0, 0.4, uv.y - scanPos);

        vec3 glowColor = vec3(0.8, 1.0, 1.1); // bright cyan-white

        vec3 color = texColor.rgb + glowColor * (core + glow + trail);

        gl_FragColor = vec4(color, 1.0);
      }
    `

    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource)

    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    programRef.current = program
    if (!program) return

    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return
    }

    uResolutionRef.current = gl.getUniformLocation(program, "u_resolution")
    uTimeRef.current = gl.getUniformLocation(program, "u_time")
    uTextureRef.current = gl.getUniformLocation(program, "u_texture")

    const positionBuffer = gl.createBuffer()
    positionBufferRef.current = positionBuffer
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, -1.0, 1.0, 1.0, -1.0, 1.0, 1.0]),
      gl.STATIC_DRAW,
    )

    const positionLocation = gl.getAttribLocation(program, "position")
    positionLocationRef.current = positionLocation
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    const texture = gl.createTexture()
    textureRef.current = texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    const DURATION = 1200

    function animate(time: number) {
      const gl = glRef.current
      const program = programRef.current
      const uResolution = uResolutionRef.current
      const uTime = uTimeRef.current
      const uTexture = uTextureRef.current
      if (!gl || !program) return

      if (!startTimeRef.current) {
        startTimeRef.current = time
        soundCleanupRef.current = playScanSound()
      }

      const elapsed = time - startTimeRef.current
      const progress = Math.min(elapsed / DURATION, 1.0)

      gl.clearColor(0.0, 0.0, 0.0, 0.0)
      gl.clear(gl.COLOR_BUFFER_BIT)

      // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API method, not a React hook
      gl.useProgram(program)

      if (uResolution !== null) gl.uniform2f(uResolution, canvas.width, canvas.height)
      if (uTime !== null) gl.uniform1f(uTime, progress)
      if (uTexture !== null) gl.uniform1i(uTexture, 0)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (progress < 1.0) {
        requestRef.current = requestAnimationFrame(animate)
      } else {
        onComplete()
      }
    }

    const image = new Image()
    image.crossOrigin = "anonymous"
    image.src = src
    image.onload = () => {
      canvas.width = image.width
      canvas.height = image.height
      gl.viewport(0, 0, canvas.width, canvas.height)

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)

      requestRef.current = requestAnimationFrame(animate)
    }

    image.onerror = (error) => {
      onComplete()
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      if (soundCleanupRef.current) soundCleanupRef.current()

      if (gl) {
        if (textureRef.current) {
          gl.deleteTexture(textureRef.current)
          textureRef.current = null
        }
        if (positionBufferRef.current) {
          gl.deleteBuffer(positionBufferRef.current)
          positionBufferRef.current = null
        }
        if (programRef.current) {
          gl.deleteProgram(programRef.current)
          programRef.current = null
        }
      }
    }
  }, [src, onComplete])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-contain"
      style={{
        transform: "translate3d(0,0,0)",
        WebkitTransform: "translate3d(0,0,0)",
      }}
    />
  )
}
