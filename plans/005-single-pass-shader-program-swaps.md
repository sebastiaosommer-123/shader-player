# 005 — Compile each shader program once per selection

- **Status**: DONE
- **Commit**: 3ae9987
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 2 source files, about 70–110 changed lines

## Problem

`ShaderCanvas` has two independent owners for a shader change. The first effect
compiles a new program directly:

```tsx
// components/shader-canvas.tsx:68-74 — current
useEffect(() => {
  if (shaderIdRef.current !== shaderId && glRef.current) {
    console.log("[v0] Shader changed, reinitializing program")
    shaderIdRef.current = shaderId
    programRef.current = initShader(glRef.current, shaderId)
  }
}, [shaderId])
```

The WebGL lifecycle effect also depends on `shaderId`, so React tears down its
animation frame and `ResizeObserver`, then immediately calls `initShader` again:

```tsx
// components/shader-canvas.tsx:76-96,156-166 — current
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

  // ... render loop and ResizeObserver setup ...

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
```

`initShader` compiles both shaders, links a program, and creates a new position
buffer on each call:

```tsx
// lib/shader-renderer.ts:415-449 — current
export function initShader(gl: WebGLRenderingContext, shaderId: string): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShaderSource =
    shaderId === "terracotta"
      ? terracottaFragmentShaderSource
      : shaderId === "plasma"
        ? plasmaFragmentShaderSource
        : shaderId === "pixelTopography"
          ? pixelTopographyFragmentShaderSource
          : terracottaFragmentShaderSource
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[v0] Program link error:", gl.getProgramInfoLog(program))
    return null
  }

  const positionBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)

  const positionLocation = gl.getAttribLocation(program, "position")
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  return program
}
```

Successful shaders, programs, and buffers are never deleted. A tab press thus
does duplicate GPU compilation and resource allocation at the exact moment the
160ms selection indicator is moving, then resets the canvas clock and render
lifecycle. This is avoidable main-thread/GPU work on a frequent interaction.

## Target

The canvas and its observer/render loop initialize once. Shader selection owns
one resource swap: compile/link once, replace only after successful creation,
draw the new program immediately, then dispose the previous program and buffer.

Change `initShader` to return an explicit resource bundle and add one disposal
function:

```tsx
// lib/shader-renderer.ts — target
export interface ShaderResources {
  program: WebGLProgram
  positionBuffer: WebGLBuffer
}

export function disposeShader(
  gl: WebGLRenderingContext,
  resources: ShaderResources,
) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.deleteProgram(resources.program)
}

export function initShader(
  gl: WebGLRenderingContext,
  shaderId: string,
): ShaderResources | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  if (!vertexShader) return null

  const fragmentShaderSource =
    shaderId === "terracotta"
      ? terracottaFragmentShaderSource
      : shaderId === "plasma"
        ? plasmaFragmentShaderSource
        : shaderId === "pixelTopography"
          ? pixelTopographyFragmentShaderSource
          : terracottaFragmentShaderSource
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!fragmentShader) {
    gl.deleteShader(vertexShader)
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  const linked = gl.getProgramParameter(program, gl.LINK_STATUS)
  if (!linked) {
    console.error("[v0] Program link error:", gl.getProgramInfoLog(program))
  }

  gl.detachShader(program, vertexShader)
  gl.detachShader(program, fragmentShader)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (!linked) {
    gl.deleteProgram(program)
    return null
  }

  const positionBuffer = gl.createBuffer()
  if (!positionBuffer) {
    gl.deleteProgram(program)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  )

  const positionLocation = gl.getAttribLocation(program, "position")
  gl.enableVertexAttribArray(positionLocation)
  gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

  return { program, positionBuffer }
}
```

In `ShaderCanvas`, replace `programRef` with the bundle, keep the lifecycle
effect mounted for the component's lifetime, and make the shader-change effect
the only post-mount swap path:

```tsx
// components/shader-canvas.tsx — target imports and refs
import {
  disposeShader,
  initShader,
  updateUniforms,
  type ShaderResources,
} from "@/lib/shader-renderer"

const resourcesRef = useRef<ShaderResources | null>(null)
```

```tsx
// components/shader-canvas.tsx — target shader-change effect
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
```

The one-time lifecycle must initialize from the ref, draw through the resource
bundle, and have an empty dependency list:

```tsx
// components/shader-canvas.tsx — target lifecycle excerpts
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

  // ... existing clock, resize, observer and render-loop setup ...

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

  // render() must test `resourcesRef.current`, not `programRef.current`.

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
```

Do not add a crossfade in this plan. The selected shader must paint on the next
available draw without adding UI latency.

## Repo conventions to follow

- Keep the reduced-motion and gallery-pause clock behavior in
  `components/shader-canvas.tsx:38-66` exactly intact. It is the completed result
  of plan 001.
- Keep the immediate redraw after canvas resize at
  `components/shader-canvas.tsx:124-129`; its comment documents the black-frame
  failure it prevents.
- Keep shader compilation and uniform wiring in `lib/shader-renderer.ts`; the
  component owns lifecycle, while the renderer owns WebGL resource creation.
- Programmatic shader selection is a high-frequency action. It must not wait for
  an animation callback or artificial timer.

## Steps

1. In `lib/shader-renderer.ts`, export `ShaderResources` and `disposeShader` as
   shown in **Target**.
2. Rewrite `initShader` to return `{ program, positionBuffer }`, and clean up
   every partially created shader/program on all failure paths. Delete compiled
   shader objects immediately after linking; linked programs no longer need
   them.
3. In `components/shader-canvas.tsx`, update the renderer import and replace
   `programRef` with `resourcesRef`.
4. Rewrite the shader-change effect so it compiles exactly once, swaps only on
   success, draws immediately, and disposes the previous bundle.
5. Change the WebGL lifecycle initialization to call
   `initShader(gl, shaderIdRef.current)` and update `drawFrame`/`render` to read
   `resourcesRef.current`.
6. Change the lifecycle effect dependency array from `[shaderId]` to `[]`. Do
   not suppress the lint rule; remove all direct `shaderId` reads from that
   effect by using `shaderIdRef.current`.
7. Extend lifecycle cleanup to cancel the frame, dispose the live resource
   bundle, and clear the refs exactly as shown.

## Boundaries

- Do NOT add a shader crossfade, loading spinner, delay, cache, or new visual
  effect.
- Do NOT alter fragment shader source, uniform values, parameter defaults,
  shader timing, capture behavior, or canvas dimensions.
- Do NOT undo the reduced-motion freeze/resume behavior from plan 001.
- Do NOT create a new WebGL context during a shader selection.
- Do NOT dispose the previous resources until the replacement has compiled and
  linked successfully; a failed selection must leave the current picture alive.
- Do NOT add dependencies.
- If the cited code has drifted from commit `3ae9987`, STOP and report instead
  of improvising.

## Verification

- **Mechanical**:
  - Run `npm run lint`; expect exit code 0.
  - Run `npm run build`; expect a successful Next.js production build.
  - Run `rg -n 'programRef|useEffect\(.*\[shaderId\]' components/shader-canvas.tsx`;
    expect no matches.
  - Temporarily instrument `initShader` with `console.count("initShader")` while
    verifying, then remove the instrumentation. Initial load must count once;
    every shader selection must increment by exactly one.
  - In a development-only verification pass, inspect WebGL resources with the
    browser's graphics tooling while switching shaders repeatedly; live program
    and buffer counts must remain bounded rather than growing per switch.
- **Feel check**:
  - Switch rapidly among all shader tabs for at least 30 seconds. The selection
    indicator must stay smooth and the canvas must never flash black or blank.
  - Turn DevTools Performance CPU throttling to 4× and record repeated tab
    changes. Confirm one compile/link path per press and no teardown/recreation
    of `ResizeObserver` or the render loop.
  - Resize the desktop sidebar continuously after switching each shader. The
    immediate redraw must still prevent black frames.
  - Toggle `prefers-reduced-motion: reduce`, switch all shaders, and confirm each
    new shader draws once and remains static. Disable the preference and confirm
    the loop resumes once without time multiplication.
  - Open/close the gallery after several switches and confirm pause/resume is
    unchanged.
- **Done when**: each shader selection compiles exactly one program, the canvas
  lifecycle remains mounted, replaced GL resources are disposed, selection has
  no blank frame, and reduced-motion/gallery pause semantics remain intact.
