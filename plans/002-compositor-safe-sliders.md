# 002 — Move slider drag rendering onto transforms

- **Status**: DONE
- **Commit**: 0b865e8
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 source file, about 50–75 changed lines

## Problem

The app renders a live full-screen WebGL shader while its most frequently used controls update on every pointer move. The reachable parameter-control path is `components/parameter-slider.tsx:71-82`, which always renders `SliderComfortable` with `variant="scrubber"`:

```tsx
// components/parameter-slider.tsx:71-82 — current
<SliderComfortable
  value={value}
  onChange={handleValueChange}
  min={min}
  max={max}
  step={step}
  variant="scrubber"
  label={label}
  formatValue={(currentValue) => currentValue.toFixed(3)}
  // 36px on desktop to match the shader dropdown; the mobile sheet keeps
  // SliderComfortable's own 32px.
  className="w-full md:h-9 rounded-[8px]"
/>
```

During a scrub, `components/ui/slider.tsx:1315-1328` writes the new value into `fillPercent` on every pointer event:

```tsx
// components/ui/slider.tsx:1315-1328 — current
const handlePointerMove = useCallback(
  (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const newVal = getValueFromX(e.clientX);
    onChange(newVal);
    const newPercent = Math.max(0, Math.min(1, (newVal - min) / (max - min)));
    if (variant === "scrubber") {
      fillPercent.set(newPercent);
    } else {
      animate(fillPercent, newPercent, spring.fast);
    }
    animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast);
  },
  [getValueFromX, onChange, variant, fillPercent, zeroOffset, zeroTarget, min, max]
);
```

Those compositor-friendly numeric motion values are converted back into layout properties at `components/ui/slider.tsx:1192-1200` and `components/ui/slider.tsx:1622-1692`. The fill changes `width`; the visible handle line and the eight-pixel resize hit target change `left`. Each update can therefore trigger layout and paint while WebGL is also drawing:

```tsx
// components/ui/slider.tsx:1192-1200 — current
const fillWidthStyle = useTransform(fillPercent, (p) => `${p * 100}%`);
const handleLeftStyle = useTransform(
  [fillPercent, zeroOffset] as MotionValue<number>[],
  ([p, zo]) => `calc(${(p as number) * 100}% - 8px + ${zo as number}px)`
);
const handleLineLeftStyle = useTransform(
  [fillPercent, zeroOffset] as MotionValue<number>[],
  ([p, zo]) => `calc(${(p as number) * 100}% - 9px + ${zo as number}px)`
);
```

```tsx
// components/ui/slider.tsx:1622-1651,1683-1692 — current
{/* Scrubber: fill */}
{variant === "scrubber" && (
  <motion.div
    className="absolute left-0 top-0 bottom-0 pointer-events-none"
    style={{
      width: fillWidthStyle,
      backgroundColor: "var(--active)",
    }}
  />
)}

{/* Scrubber: handle line */}
{variant === "scrubber" && (
  <motion.div
    className="absolute rounded-full pointer-events-none z-10"
    initial={false}
    animate={{
      top: isActive ? 7 : 8,
      bottom: isActive ? 7 : 8,
      backgroundColor: isFocused
        ? "var(--foreground)"
        : isHovered
        ? "color-mix(in srgb, var(--foreground) 65%, transparent)"
        : "color-mix(in srgb, var(--foreground) 45%, transparent)",
    }}
    transition={spring.fast}
    style={{
      left: handleLineLeftStyle,
      width: 2,
    }}
  />
)}

{/* Resize handle (scrubber only) */}
{variant === "scrubber" && (
  <motion.div
    className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-20"
    style={{ left: handleLeftStyle }}
    onPointerDown={handleResizePointerDown}
    onPointerMove={handleResizePointerMove}
    onPointerUp={handleResizePointerUp}
    onPointerCancel={handleResizePointerUp}
  />
)}
```

The same file also backs both reachable color-picker ramps (`components/ui/color-picker.tsx:582-608` and `components/ui/color-picker.tsx:615-651`). Both use `Slider` with `showValue={false}` and `hideFill`, so their continuously moving visual is the thumb. That thumb uses Framer Motion's `x` shorthand at `components/ui/slider.tsx:776-792` instead of a full transform string:

```tsx
// components/ui/slider.tsx:776-792 — current
const renderVisualThumb = (index: number) => {
  const motionX = index === 0 ? motionX0 : motionX1;
  return (
    <motion.span
      key={`visual-thumb-${index}`}
      className="flex items-center justify-center pointer-events-none"
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        marginTop: -THUMB_SIZE / 2,
        x: motionX,
        position: "absolute",
        top: "50%",
        left: 0,
        zIndex: 10,
      }}
      initial={false}
    >
```

The result is unnecessary main-thread work in exactly the interaction where the shader and React parameter state are already busy. The value math itself is correct; this plan changes only how the existing motion values are painted.

## Target

Keep `motionX0`, `motionX1`, `fillPercent`, and `zeroOffset` as the sources of truth. Keep every pointer handler, spring, snapping formula, `onChange` call, Base UI primitive, focus state, tooltip calculation, hover-preview calculation, and public prop unchanged. Only replace drag-position render bindings with direct, full CSS transform strings.

### `Slider` visual thumbs

Derive one transform `MotionValue<string>` per thumb next to the existing `motionX0`/`motionX1` declarations. Use `translateX()`, not Framer's `x` shorthand:

```tsx
// components/ui/slider.tsx — target, immediately after motionX0/motionX1
const visualThumbTransform0 = useTransform(
  motionX0,
  (x) => `translateX(${x}px)`
);
const visualThumbTransform1 = useTransform(
  motionX1,
  (x) => `translateX(${x}px)`
);
```

Bind the selected full transform string in `renderVisualThumb`:

```tsx
// components/ui/slider.tsx — target
const renderVisualThumb = (index: number) => {
  const visualThumbTransform =
    index === 0 ? visualThumbTransform0 : visualThumbTransform1;
  return (
    <motion.span
      key={`visual-thumb-${index}`}
      className="flex items-center justify-center pointer-events-none"
      style={{
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        marginTop: -THUMB_SIZE / 2,
        transform: visualThumbTransform,
        willChange: "transform",
        position: "absolute",
        top: "50%",
        left: 0,
        zIndex: 10,
      }}
      initial={false}
    >
```

Do not change the numeric `motionX` values or their pixel coordinate system. Hue must still map `0..360` to the same `0..trackWidth - THUMB_SIZE` range; Alpha must still map `0..100` to that range.

### `SliderComfortable` scrubber fill, visible line, and hit target

Replace the three scrubber-only layout bindings with full transform strings. The fill is a full-width layer scaled from the left. The handle-line and resize-handle transforms must be attached to full-width wrappers: a percentage in `translateX(calc(...))` is relative to the transformed element's own width, so the wrappers must be exactly the slider's width. Their small children retain the existing two-pixel visible line and eight-pixel interactive target.

```tsx
// components/ui/slider.tsx — target, replacing fillWidthStyle,
// handleLeftStyle, and handleLineLeftStyle
const scrubberFillTransformStyle = useTransform(
  fillPercent,
  (p) => `scaleX(${p})`
);
const scrubberHandleLineTransformStyle = useTransform(
  [fillPercent, zeroOffset] as MotionValue<number>[],
  ([p, zo]) =>
    `translateX(calc(${(p as number) * 100}% - 9px + ${zo as number}px))`
);
const scrubberResizeHandleTransformStyle = useTransform(
  [fillPercent, zeroOffset] as MotionValue<number>[],
  ([p, zo]) =>
    `translateX(calc(${(p as number) * 100}% - 8px + ${zo as number}px))`
);
```

Do not change `zeroTarget`: it remains `17` for scrubbers and continues to keep the handle visible at minimum. Do not change the pips-specific `pipsFillWidthStyle`, `pipsHandleLineLeftStyle`, or `pipsMaskStyle`; the only reachable `SliderComfortable` consumer is the parameter scrubber, and the pips variant is outside this finding.

Render the scrubber fill as a fixed full-width layer. The transform origin must be exactly `left center` so `scaleX(0..1)` exposes the same left-to-right region as the old width:

```tsx
// components/ui/slider.tsx — target
{/* Scrubber: fill */}
{variant === "scrubber" && (
  <motion.div
    className="absolute inset-0 pointer-events-none"
    style={{
      transform: scrubberFillTransformStyle,
      transformOrigin: "left center",
      willChange: "transform",
      backgroundColor: "var(--active)",
    }}
  />
)}
```

Render the visible line inside a full-width transform wrapper. Move the existing hover/focus animation intact to the two-pixel child; do not alter `spring.fast`, its `top`/`bottom` values, or its three exact colors:

```tsx
// components/ui/slider.tsx — target
{/* Scrubber: handle line */}
{variant === "scrubber" && (
  <motion.div
    className="absolute inset-0 pointer-events-none z-10"
    style={{
      transform: scrubberHandleLineTransformStyle,
      willChange: "transform",
    }}
  >
    <motion.div
      className="absolute left-0 rounded-full"
      initial={false}
      animate={{
        top: isActive ? 7 : 8,
        bottom: isActive ? 7 : 8,
        backgroundColor: isFocused
          ? "var(--foreground)"
          : isHovered
          ? "color-mix(in srgb, var(--foreground) 65%, transparent)"
          : "color-mix(in srgb, var(--foreground) 45%, transparent)",
      }}
      transition={spring.fast}
      style={{ width: 2 }}
    />
  </motion.div>
)}
```

Render the interactive resize target as an eight-pixel child of a full-width transform wrapper. `pointer-events-none` on the wrapper plus `pointer-events-auto` on the child is intentional: only the original eight-pixel target may receive pointer input. Keep pointer capture on the child by leaving all four handlers on it:

```tsx
// components/ui/slider.tsx — target
{/* Resize handle (scrubber only) */}
{variant === "scrubber" && (
  <motion.div
    className="absolute inset-0 pointer-events-none z-20"
    style={{
      transform: scrubberResizeHandleTransformStyle,
      willChange: "transform",
    }}
  >
    <div
      className="absolute left-0 top-0 bottom-0 w-2 pointer-events-auto cursor-ew-resize"
      onPointerDown={handleResizePointerDown}
      onPointerMove={handleResizePointerMove}
      onPointerUp={handleResizePointerUp}
      onPointerCancel={handleResizePointerUp}
    />
  </motion.div>
)}
```

The target introduces no new timing or easing. Pointer drags remain direct because they still call `fillPercent.set(...)`; pointer-down and programmatic settling retain the repository's existing `spring.fast` (`duration: 0.08`, `bounce: 0`) and existing `spring.moderate` where currently used.

## Repo conventions to follow

- Keep Framer Motion state in `MotionValue`s and derive render strings with `useTransform`; `components/ui/slider.tsx:397-428` already follows that pattern for `fillLeft`, masks, and related values.
- Use a complete `transform` property instead of Framer shorthand. `hooks/use-capture-slide-in.ts:49-58` is the local exemplar: it emits complete `translateX(...)` strings and changes only `transform`.
- Keep the slider's established motion tiers from `lib/springs.ts:1-23`. This plan adds no duration, curve, or spring configuration.
- Preserve Base UI as the semantic/keyboard layer. The invisible `SliderPrimitive.Root` and `SliderPrimitive.Thumb` at `components/ui/slider.tsx:892-936` and `components/ui/slider.tsx:1476-1500` must remain the accessibility owners.
- Preserve layout-space pointer math. Existing `getBoundingClientRect()`, `offsetWidth`/`clientWidth`, ancestor-scale normalization, step rounding, and `zeroOffset` formulas deliberately align pointer coordinates with CSS pixels; transforms consume those results without changing them.

## Steps

1. In `components/ui/slider.tsx`, immediately after `motionX0` and `motionX1`, add `visualThumbTransform0` and `visualThumbTransform1` exactly as shown in **Target**. Keep `motionX0` and `motionX1` and every writer to them unchanged.
2. In `renderVisualThumb`, select the corresponding transform value and replace `style.x` with `style.transform`; add `willChange: "transform"`. Do not edit thumb dimensions, `left: 0`, vertical centering, inner thumb styling, focus-ring styling, or spring configuration.
3. In the `SliderComfortable` derived-values block, replace only `fillWidthStyle`, `handleLeftStyle`, and `handleLineLeftStyle` with the three exact scrubber transform values shown above. Preserve `fillPercent`, `zeroOffset`, `zeroTarget`, and all pips-derived values by name and behavior.
4. Replace the scrubber fill's animated `width` binding with the fixed `inset-0` layer, `scaleX(...)` transform value, `transformOrigin: "left center"`, and `willChange: "transform"` shown above.
5. Wrap the visible scrubber line in the full-width translated wrapper shown above. Move the existing line's hover/focus animation to its two-pixel child verbatim. Confirm the transform belongs to the full-width wrapper, never the two-pixel child; otherwise percentage travel will be two pixels instead of the track width.
6. Wrap the scrubber resize target in the full-width translated wrapper shown above. Move all four existing pointer handlers to the eight-pixel child and explicitly restore `pointer-events-auto` there. Confirm `setPointerCapture` still runs on that child in `handleResizePointerDown`.
7. Do a focused regression pass without changing code: standard parameter scrubbers, Hue, Alpha, min/max endpoints, hover preview, keyboard focus, and disabled state. Any discrepancy must be fixed only by correcting the transform binding; do not change value math or interaction policy.

## Boundaries

- Modify only `components/ui/slider.tsx` when executing this plan.
- Do **not** edit `components/parameter-slider.tsx` or `components/ui/color-picker.tsx`; they are consumer evidence and must benefit through the shared slider implementations.
- Do **not** change `motionX0`, `motionX1`, `fillPercent`, or `zeroOffset` names or numeric meaning. Plan 003 will separately change keyboard/programmatic synchronization policy and depends on these sources remaining stable.
- Do **not** implement finding #3's keyboard no-animation policy here. In particular, leave `components/ui/slider.tsx:507-524` and `components/ui/slider.tsx:1268-1274` behavior unchanged even though this plan changes what those motion values render into.
- Do **not** convert `TooltipValue`, tooltip entrance `y`, or other reduced-motion behavior; reduced-motion is owned by a separate accessibility plan.
- Do **not** change hover-preview state, geometry, direction-dependent border radii, tooltip clamping, or opacity timing. The visible preview segment must begin and end at exactly the same pixels as before.
- Do **not** change pips rendering or any pips-specific width, line, or mask binding.
- Do **not** change pointer hit-area sizes: the track remains extended by eight pixels at each edge and the resize handle remains eight pixels wide.
- Do **not** alter step snapping, range crossing, emitted values, parameter sound hooks, ARIA labels/value text, tab order, focus-visible styling, disabled behavior, or colors.
- Do **not** add CSS variables, animation tokens, dependencies, or new source files.
- If a step does not match the code at commit `0b865e8`, STOP and report the drift instead of improvising.

## Verification

- **Mechanical**:
  1. Run `pnpm exec tsc --noEmit`; expect exit code 0 and no TypeScript errors.
  2. Run `pnpm lint`; expect exit code 0. If the repository has pre-existing lint failures, record the baseline and verify this diff adds none in `components/ui/slider.tsx`.
  3. Run `pnpm build`; expect the Next.js production build to complete successfully.
  4. Run `rg -n 'x: motionX|width: fillWidthStyle|left: handleLineLeftStyle|left: handleLeftStyle' components/ui/slider.tsx`; expect no matches.
  5. Inspect the diff and confirm all new continuously changing bindings use `transform: <MotionValue<string>>`; no pointer handler, value conversion, Base UI primitive, `onChange` call, or ARIA prop changed.
- **Functional checks**:
  - Drag several parameter scrubbers slowly and rapidly. The fill edge, two-pixel line, displayed value, live shader response, and slider audio must remain synchronized at every snapped step.
  - Start a drag from the broad track, then start one precisely on the eight-pixel resize handle. Move outside the track before releasing. Pointer capture must keep both drags active until pointer-up/cancel, and no dead full-width hit layer may block the slider.
  - Reach minimum and maximum. At minimum the existing `zeroOffset=17` treatment must keep the line visible; at maximum the fill must reach the right edge, the line must match its previous inset, and the resize hit target must remain wholly inside the control.
  - Open the color picker and drag Hue from `0` to `360` and Alpha from `0` to `100`. The thumb center, gradient endpoints, color output, and one-unit snapping must be unchanged.
  - Hover parameter and color sliders without pressing. Hover-preview bars, tooltip positions, cap direction/radii, and 150ms opacity feedback must match the pre-change geometry exactly.
  - Tab to both slider variants and use Arrow keys, Home, and End. Values, ARIA output, and focus rings must still work. This plan intentionally preserves the current keyboard animation; plan 003 removes that separately.
  - Verify a disabled slider neither responds to pointer input nor loses its existing dimmed styling.
- **Performance-panel feel check under live shader load**:
  1. Run `pnpm dev`, open the shader page, keep the animated shader running, and open Chrome DevTools **Performance**. Enable screenshots and record while continuously scrubbing a parameter for at least three seconds, then while dragging Hue and Alpha for at least three seconds each. Repeat once with 4× CPU slowdown.
  2. In the trace, inspect frames during the drags. Slider fill, visible line, resize target, and color thumbs must update as compositor transforms. There must be no repeated **Layout** events attributable to their former `width`/`left`/Framer-`x` bindings. React/WebGL scripting caused by the intentional `onChange` path may remain.
  3. Turn on **Rendering → Paint flashing** and repeat the drags. The control must not repaint because its fill edge, handle line, resize target, or Hue/Alpha thumb changed position; focus/color transitions outside the drag-position path are not part of this criterion.
  4. Capture a 60fps screen recording and inspect rapid reversals frame by frame. The fill edge and handle/thumb must stay locked together with no one-frame lag, jump, blur, endpoint gap, or stale hit target.
- **Done when**: all three drag-position paths—parameter scrubber fill, parameter scrubber line/hit target, and Hue/Alpha visual thumbs—are driven by full `scaleX(...)`/`translateX(...)` transform strings; the Performance trace shows no repeated slider-position layout work; and emitted values, snapping, hit testing, hover previews, keyboard accessibility, focus styling, endpoints, and live shader response are visually and functionally unchanged.
