"use client"

import { useEffect, useRef } from "react"
import { playBurnSound } from "@/lib/burn-audio"

interface BurningImageProps {
  src: string
  onComplete: () => void
  onReady?: () => void
}

export function BurningImage({ src, onComplete, onReady }: BurningImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number>()
  const startTimeRef = useRef<number>()

  useEffect(() => {
    const stopSound = playBurnSound()
    return () => {
      stopSound()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl")
    if (!gl) return

    // Vertex shader
    const vsSource = `
      attribute vec2 position;
      varying vec2 vUv;
      void main() {
        vUv = position * 0.5 + 0.5;
        // Flip Y for texture
        vUv.y = 1.0 - vUv.y;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `

    // Fragment shader
    const fsSource = `
      precision mediump float;
      varying vec2 vUv;
      uniform sampler2D u_texture;
      uniform float u_progress;
      uniform float u_time;
      uniform float u_ratio;

      // Simple pseudo-random noise
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.5 * noise(p); p *= 2.0;
        v += 0.25 * noise(p); p *= 2.0;
        v += 0.125 * noise(p); p *= 2.0;
        return v;
      }

      void main() {
        vec4 texColor = texture2D(u_texture, vUv);
        
        // Create flame noise
        // We stretch it vertically to look like rising flames
        float n = fbm(vec2(vUv.x * 10.0, vUv.y * 10.0 - u_time * 3.0));
        
        // Calculate the burn frontier
        // u_progress goes 0 -> 1. We map it to cover the whole height plus buffers
        // We invert the direction so it burns from bottom (1.0 in UV because we flipped it) to top
        // Wait, in VS we did vUv.y = 1.0 - vUv.y. 
        // So vUv.y=0 is top, vUv.y=1 is bottom.
        // We want to burn from bottom (1.0) to top (0.0).
        
        float frontier = 1.0 - (u_progress * 1.4 - 0.2);
        
        // Add noise to the frontier
        float dist = vUv.y - frontier + n * 0.15;
        
        // If we are below the fire line (remember Y is inverted, so "below" means > frontier)
        if (dist > 0.0) {
           discard;
        }
        
        // Fire edge
        // We want a band of fire right at the edge
        if (dist > -0.15) {
           float t = (dist + 0.15) / 0.15; // 0 to 1
           
           // Fire palette
           vec3 color1 = vec3(1.0, 0.2, 0.0); // Red/Orange
           vec3 color2 = vec3(1.0, 0.9, 0.1); // Yellow
           vec3 color3 = vec3(1.0, 1.0, 1.0); // White hot
           
           vec3 fireColor = mix(color1, color2, t * 2.0);
           if (t > 0.5) fireColor = mix(color2, color3, (t - 0.5) * 2.0);
           
           // Add some sparkle/noise to the fire
           fireColor += vec3(0.2) * noise(vec2(vUv.x * 20.0, u_time * 10.0));
           
           // Blend with original image color to make it look like it's glowing before vanishing
           gl_FragColor = vec4(mix(texColor.rgb, fireColor, 0.8), 1.0);
        } else {
           gl_FragColor = texColor;
        }
      }
    `

    // Shader setup helper
    function createShader(gl: WebGLRenderingContext, type: number, source: string) {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader))
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vsSource)
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource)
    
    if (!vertexShader || !fragmentShader) return

    const program = gl.createProgram()
    if (!program) return
    
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program))
      return
    }

    gl.useProgram(program)

    // Buffer setup
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]), gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, "position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Texture setup
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    // Load image
    const image = new Image()
    image.src = src
    image.onload = () => {
      canvas.width = image.width
      canvas.height = image.height
      gl.viewport(0, 0, canvas.width, canvas.height)

      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
      
      // Start animation loop
      startTimeRef.current = performance.now()
      requestRef.current = requestAnimationFrame(animate)

      if (onReady) onReady()
    }

    const uTime = gl.getUniformLocation(program, "u_time")
    const uProgress = gl.getUniformLocation(program, "u_progress")

    const DURATION = 1500 // 1.5 seconds for the burn

    function animate(time: number) {
      if (!startTimeRef.current) startTimeRef.current = time
      const elapsed = time - startTimeRef.current
      const progress = Math.min(elapsed / DURATION, 1.0)

      gl.uniform1f(uTime, time * 0.001)
      gl.uniform1f(uProgress, progress)

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (progress < 1.0) {
        requestRef.current = requestAnimationFrame(animate)
      } else {
        onComplete()
      }
    }

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current)
      // Cleanup WebGL resources if needed
    }
  }, [src, onComplete, onReady])

  return (
    <canvas 
      ref={canvasRef} 
      className="w-full h-full object-contain"
    />
  )
}
