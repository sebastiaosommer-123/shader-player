# 001 — Freeze continuous shader motion for reduced-motion users

- **Status**: DONE
- **Commit**: 0b865e8
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file, about 35 lines changed

## Problem

`components/shader-canvas.tsx` renders the product's dominant, full-screen visual. Its WebGL loop advances `uTime` every animation frame regardless of the user's `prefers-reduced-motion` setting. The existing `isPaused` prop can stop the loop while the gallery is open, but reduced motion is not part of that stop condition.

The animation loop is unconditional whenever `isPaused` is false:

```tsx
// components/shader-canvas.tsx:126-139 — current
const render = () => {
  if (!gl || !programRef.current || isPausedRef.current) {
    isLoopRunningRef.current = false
    return
  }

  drawFrame()

  animationRef.current = requestAnimationFrame(render)
}

renderFnRef.current = render
isLoopRunningRef.current = true
render()
```

Each pass sends an advancing time value to the shader:

```tsx
// components/shader-canvas.tsx:82-99 — current
const startTime = Date.now()

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
```

`lib/shader-renderer.ts:452-464` confirms that this elapsed value is assigned directly to `uTime`:

```ts
// lib/shader-renderer.ts:452-464 — current
export function updateUniforms(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  params: ShaderParams,
  time: number,
  width: number,
  height: number,
  shaderId: string,
) {
  gl.useProgram(program)

  gl.uniform2f(gl.getUniformLocation(program, "uResolution"), width, height)
  gl.uniform1f(gl.getUniformLocation(program, "uTime"), time)
```

Simply stopping `requestAnimationFrame` is insufficient. The current parameter effect only updates a ref, relying on the continuous loop for the visible redraw:

```tsx
// components/shader-canvas.tsx:34-36 — current
useEffect(() => {
  paramsRef.current = params
}, [params])
```

Reduced-motion users must receive a live but static shader: the selected frame must remain visible, parameter edits must redraw that same frozen-time frame, shader changes must initialize and draw the new shader, and resizes must continue to repaint the resized drawing buffer.

## Target

Use Framer Motion's reactive `useReducedMotion()` hook, which is already a production dependency and the repository's established JS convention. Treat the render loop as stopped whenever either `isPaused` or `prefersReducedMotion` is true. Do not hide, remove, fade, or replace the canvas.

The exact behavior is:

- With `prefers-reduced-motion: no-preference` and `isPaused === false`, preserve the existing continuous `requestAnimationFrame` loop.
- With `prefers-reduced-motion: reduce`, draw a shader frame but do not schedule a continuing loop. Freeze the elapsed value used for `uTime` for the entire reduced-motion interval.
- While reduced motion is active, a `params` change must immediately redraw using the frozen elapsed time.
- While reduced motion is active, a resize must continue through the existing `resize()` → `drawFrame()` path. The resized canvas must never be left black or blank.
- While reduced motion is active, a `shaderId` change must still initialize and draw the selected shader. It may begin that newly initialized shader at `uTime === 0`; it must then remain static.
- If the preference changes from `reduce` back to `no-preference`, resume from the frozen frame. Exclude the stopped interval from elapsed shader time so there is no catch-up jump.
- Combine reduced motion with `isPaused` using logical OR. The loop may resume only when both conditions are false. For example, closing the gallery must not restart the shader while reduced motion remains enabled.

Implement that target in `components/shader-canvas.tsx` with this state shape and import:

```tsx
// target import
import { useReducedMotion } from "framer-motion"

// target component state, alongside the existing refs
const prefersReducedMotion = useReducedMotion()
const reducedMotionRef = useRef(Boolean(prefersReducedMotion))
const drawFrameRef = useRef<(() => void) | null>(null)
```

Replace the separate `isPaused`-only transition bookkeeping with one effect that computes the combined stop state before and after updating its refs:

```tsx
// target combined stop-state effect
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
```

The `Boolean(...)` normalization is intentional because `useReducedMotion()` can be nullable. Initialize the ref from the hook value so the first WebGL lifecycle pass knows whether it is allowed to start a loop.

Expose the lifecycle-local `drawFrame` to parameter and preference effects, and redraw parameters only when the loop is stopped:

```tsx
// target parameter effect
useEffect(() => {
  paramsRef.current = params
  if (isPausedRef.current || reducedMotionRef.current) {
    drawFrameRef.current?.()
  }
}, [params])

// target assignment immediately after the drawFrame declaration
drawFrameRef.current = drawFrame
```

At the start of each WebGL lifecycle, reset its time accounting and freeze initial elapsed time at zero when the component starts stopped:

```tsx
// target, immediately after `const startTime = Date.now()`
totalPausedTimeRef.current = 0
pausedAtRef.current = isPausedRef.current || reducedMotionRef.current ? startTime : null
```

Use the same combined condition in the render guard:

```tsx
// target render guard
if (!gl || !programRef.current || isPausedRef.current || reducedMotionRef.current) {
  isLoopRunningRef.current = false
  return
}
```

In the WebGL effect cleanup, clear the callback refs owned by that lifecycle after canceling any scheduled frame. This prevents a preference or parameter effect from calling closures tied to a disposed/replaced WebGL lifecycle:

```tsx
// target cleanup additions
renderFnRef.current = null
drawFrameRef.current = null
isLoopRunningRef.current = false
```

## Repo conventions to follow

- Reduced-motion decisions in React use Framer Motion's `useReducedMotion`, not a custom `matchMedia` hook. `components/controls-sheet.tsx:8-24` imports the hook, reads it inside the component, and branches behavior from the returned preference.
- Normalize only where a strict boolean ref is required. `components/gallery-thumbnail-strip.tsx:176-179` otherwise uses the hook value directly to select a no-motion transition.
- Remove motion while retaining useful static behavior. `components/gallery-thumbnail-strip.tsx:660-663` stops animated scrolling under reduced motion but still assigns the requested scroll position immediately. The canvas equivalent is to stop advancing `uTime` while still drawing state changes.
- Preserve the existing immediate resize redraw in `components/shader-canvas.tsx:101-122`. Its comment documents why `drawFrame()` is required after resizing the WebGL drawing buffer; do not gate that call on motion preference.
- Preserve the existing elapsed-time pause semantics in `components/shader-canvas.tsx:38-54` and `components/shader-canvas.tsx:84-89`: stopped time is subtracted so resuming does not jump ahead. Extend this established mechanism to the combined stop condition rather than creating a second clock.

## Steps

1. In `components/shader-canvas.tsx`, import `useReducedMotion` from `framer-motion`. Do not add a dependency; `framer-motion` is already declared in `package.json`.
2. Inside `ShaderCanvas`, read `const prefersReducedMotion = useReducedMotion()`. Add `reducedMotionRef`, initialized with `Boolean(prefersReducedMotion)`, and add `drawFrameRef` with the exact nullable callback type shown above.
3. Replace the current `useEffect(..., [params])` body with the target parameter effect. It must update `paramsRef.current` before requesting the static redraw and must redraw only while the combined stop condition is true.
4. Replace the current `useEffect(..., [isPaused])` with the target combined stop-state effect and dependency list `[isPaused, prefersReducedMotion]`. Use the transition between `wasStopped` and `isStopped` to start and finish one shared pause interval. Redraw once when entering the stopped state, then allow the already-scheduled animation callback to observe the ref and terminate itself.
5. In the WebGL lifecycle, immediately after `const startTime = Date.now()`, reset `totalPausedTimeRef.current` to `0` and set `pausedAtRef.current` to `startTime` when either stop condition is initially true, otherwise to `null`. This guarantees that initial reduced-motion and initial paused rendering use `uTime === 0` and that reinitializing for a new `shaderId` gets a fresh, internally consistent clock.
6. Immediately after defining `drawFrame`, assign it to `drawFrameRef.current`. Keep `resize()`'s unconditional `drawFrame()` call exactly as-is so resize redraw remains synchronous.
7. Extend the `render` guard with `reducedMotionRef.current`. Keep the existing `isLoopRunningRef.current = false` and early return. Do not schedule `requestAnimationFrame` from any reduced-motion-only redraw path.
8. In the WebGL effect cleanup, retain observer disconnection, event-listener removal, and animation-frame cancellation, then set `renderFnRef.current`, `drawFrameRef.current`, and `isLoopRunningRef.current` to their inert values shown in Target.
9. Do not alter `updateUniforms`, any GLSL source, the `ShaderCanvas` public props/ref interface, or its caller in `app/page.tsx`. The fix belongs entirely in the canvas loop lifecycle.

## Boundaries

- Modify only `components/shader-canvas.tsx`.
- Do NOT modify `lib/shader-renderer.ts`, `lib/shader-configs.ts`, shader source strings, shader parameters, or visual output calculations.
- Do NOT hide the canvas, replace it with a screenshot, set its opacity to zero, or disable resize drawing.
- Do NOT force `uTime` to a universal literal on every reduced-motion redraw. Freeze the lifecycle's elapsed clock so preference changes can resume without a discontinuity; a newly initialized shader may start at zero.
- Do NOT make reduced motion permanently override `isPaused`, or vice versa. The continuing loop runs only when both are false.
- Do NOT add dependencies, change component markup, change the `ShaderCanvasProps` or `ShaderCanvasRef` interfaces, or alter capture behavior.
- Do NOT run more than one continuous render loop. Preserve `isLoopRunningRef` as the guard against duplicate resumes.
- If these excerpts or lifecycle assumptions no longer match commit `0b865e8`, STOP and report the drift instead of improvising.

## Verification

- **Mechanical**:
  - Run `pnpm lint`; it must exit with status 0 and introduce no React Hooks dependency warnings in `components/shader-canvas.tsx`.
  - Run `pnpm build`; it must exit with status 0, including TypeScript compilation.
  - Search `components/shader-canvas.tsx` and confirm the only continuing `requestAnimationFrame(render)` call remains below a guard that includes both `isPausedRef.current` and `reducedMotionRef.current`.
  - Confirm `resize()` still calls `drawFrame()` unconditionally and the `params` effect calls `drawFrameRef.current?.()` only under the combined stop condition.
- **Feel check**:
  - Start with the OS/browser preference set to `no-preference`. Load each shader and confirm its continuous animation is unchanged.
  - In browser DevTools Rendering, emulate `prefers-reduced-motion: reduce` while the shader is moving. The current frame must remain visible and stop drifting; it must not disappear, flash black, or jump to an unrelated phase.
  - Leave reduced motion enabled and drag several shader parameter sliders. Each visual value must update immediately, but animation must remain frozen after each redraw.
  - Leave reduced motion enabled and switch among all shader tabs. Each selected shader must paint immediately as a static image; none may stay blank or inherit a continuing time loop.
  - Leave reduced motion enabled and resize the window and the desktop sidebar repeatedly. The shader must fill the new drawing-buffer size on every step without black frames or stale dimensions.
  - Open and close the gallery while reduced motion remains enabled. Closing the gallery must not restart the shader.
  - Disable reduced-motion emulation without opening the gallery. The shader must resume from the frozen phase with no elapsed-time catch-up jump. Toggle the preference rapidly several times and confirm that speed does not multiply, which would indicate duplicate loops.
  - Repeat preference toggling while the gallery is open, then close it. The shader must resume only if the final preference is `no-preference`.
- **Done when**: reduced-motion users see a present, responsive static shader; resize, shader selection, and parameter changes all redraw it; `uTime` does not advance between those redraws; normal motion remains unchanged; leaving reduced motion resumes continuously without a phase jump or duplicate loop; and the lint and production build both pass.
