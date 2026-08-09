# 003 — Make keyboard slider steps immediate

- **Status**: DONE
- **Commit**: 0b865e8
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 source file, about 20 changed lines

## Problem

Every shader parameter is rendered through `SliderComfortable`:

```tsx
// components/parameter-slider.tsx:71-79 — current
<SliderComfortable
  value={value}
  onChange={handleValueChange}
  min={min}
  max={max}
  step={step}
  variant="scrubber"
  label={label}
  formatValue={(currentValue) => currentValue.toFixed(3)}
```

`SliderComfortable` keeps Base UI's slider in the document as its semantic and
keyboard control. The primitive and all of its children have pointer events
disabled, so its `onValueChange` callback is the keyboard-originated path:

```tsx
// components/ui/slider.tsx:1476-1499 — current
<SliderPrimitive.Root
  value={[value]}
  onValueChange={(v) => handleRadixChange(v as number[])}
  min={min}
  max={max}
  step={step}
  disabled={disabled}
  className="absolute inset-0 opacity-0 pointer-events-none [&_*]:pointer-events-none"
>
  <SliderPrimitive.Control className="w-full h-full">
    <SliderPrimitive.Track className="w-full h-full">
      <SliderPrimitive.Indicator />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb
      index={0}
      aria-label={label}
      className="block outline-none"
      onFocus={(e) => {
        if ((e.currentTarget as HTMLElement).matches(":focus-visible")) setIsFocused(true);
      }}
      onBlur={() => setIsFocused(false)}
    />
  </SliderPrimitive.Control>
</SliderPrimitive.Root>
```

That keyboard value is forwarded without recording its input source:

```tsx
// components/ui/slider.tsx:1372-1377 — current
const handleRadixChange = useCallback(
  (newValues: number[]) => {
    onChange(newValues[0]);
  },
  [onChange]
);
```

When the controlled `value` returns from the parent, the shared synchronization
effect treats it like any other programmatic change and starts two 80ms springs:

```tsx
// components/ui/slider.tsx:1268-1274 — current
// Sync fill on programmatic value change
useEffect(() => {
  if (dragging.current || handleDragging.current) return;
  const percent = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  animate(fillPercent, percent, spring.fast);
  animate(zeroOffset, value === min ? zeroTarget : 0, spring.fast);
}, [value, min, max, variant, fillPercent, zeroOffset, zeroTarget]);
```

Arrow-key repeat can issue another step before the previous 80ms spring lands.
The fill and handle therefore chase the selected value even though the text,
shader uniform, and accessible value have already changed. Keyboard adjustment
is a high-frequency action; its visual position must update on the same frame,
with no decorative travel or spring tail.

## Target

Execute plan 002 first. It changes slider rendering from `width`/`left` to full
CSS transforms but deliberately preserves `fillPercent`, `zeroOffset`,
`zeroTarget`, `handleRadixChange`, and the controlled-value synchronization
effect. This plan changes only the synchronization policy for a value known to
have originated from the hidden Base UI keyboard control.

Track the exact pending keyboard value rather than a boolean. A value comparison
prevents a stale marker from making a later unrelated programmatic update jump
if the parent rejects, clamps, or does not commit a keyboard callback:

```tsx
// components/ui/slider.tsx — target, beside dragging/handleDragging refs
const pendingKeyboardValueRef = useRef<number | null>(null);
```

Record the value immediately before forwarding it to the controlled parent:

```tsx
// components/ui/slider.tsx — target
const handleRadixChange = useCallback(
  (newValues: number[]) => {
    const nextValue = newValues[0];
    pendingKeyboardValueRef.current = nextValue;
    onChange(nextValue);
  },
  [onChange]
);
```

In the controlled-value synchronization effect, calculate the target values
once, consume the pending marker on every non-dragging update, and jump only
when the committed value exactly matches the recorded keyboard value:

```tsx
// components/ui/slider.tsx — target after plan 002
useEffect(() => {
  if (dragging.current || handleDragging.current) return;

  const percent = max === min
    ? 0
    : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const nextZeroOffset = value === min ? zeroTarget : 0;
  const isKeyboardSync =
    pendingKeyboardValueRef.current !== null &&
    Object.is(pendingKeyboardValueRef.current, value);

  pendingKeyboardValueRef.current = null;

  if (isKeyboardSync) {
    fillPercent.stop();
    zeroOffset.stop();
    fillPercent.set(percent);
    zeroOffset.set(nextZeroOffset);
    return;
  }

  animate(fillPercent, percent, spring.fast);
  animate(zeroOffset, nextZeroOffset, spring.fast);
}, [value, min, max, variant, fillPercent, zeroOffset, zeroTarget]);
```

`MotionValue.stop()` is required before `.set(...)`. Without it, an animation
started by a previous pointer click or programmatic update could keep writing
after the keyboard jump and pull the visual back toward an obsolete target.

The exact resulting behavior must be:

- Arrow keys, Page Up/Down, Home, and End update the visual value immediately.
- Holding an arrow key produces one direct visual step per committed value with
  no accumulated lag.
- Pointer-down jumps and programmatic prop changes retain the existing
  `spring.fast` configuration: `{ type: "spring", duration: 0.08, bounce: 0 }`.
- Pointer drags remain direct and keep using the existing pointer handlers.
- A rejected or unchanged keyboard value cannot contaminate the next external
  value update; a mismatched pending marker is cleared and the external update
  follows the normal spring path.

## Repo conventions to follow

- High-frequency direct manipulation is written straight through to motion
  values. `components/ui/slider.tsx:1315-1327` already uses
  `fillPercent.set(newPercent)` during scrubber drags instead of springing behind
  the pointer.
- Cancel obsolete motion before handing control to a direct input. The gallery
  rail uses `selectionAnimation.current?.stop()` before `selection.jump(...)`
  at `components/gallery-thumbnail-strip.tsx:630-635`.
- Keep the established spring tier for ordinary programmatic changes.
  `lib/springs.ts:1-8` defines `spring.fast` as exactly
  `{ type: "spring", duration: 0.08, bounce: 0 }`.
- Base UI remains the semantic keyboard owner. Do not replace the hidden
  `SliderPrimitive.Root` or add document-level keyboard handlers.

## Steps

1. Execute `plans/002-compositor-safe-sliders.md` first and confirm its slider
   checks pass. If it renamed or removed `fillPercent`, `zeroOffset`,
   `zeroTarget`, `handleRadixChange`, or the controlled-value sync effect, STOP
   and reconcile this plan instead of improvising.
2. In `SliderComfortable` within `components/ui/slider.tsx`, add
   `pendingKeyboardValueRef` beside the existing `dragging` and
   `handleDragging` refs, initialized to `null` with the exact type shown above.
3. Replace `handleRadixChange` with the target implementation. Set the pending
   value before calling `onChange` so a synchronous parent update cannot arrive
   before the source has been recorded.
4. Replace the controlled-value synchronization effect with the target effect.
   Preserve its dependency array and its early return during pointer/handle
   drags. Calculate `percent` and `nextZeroOffset` before selecting the input
   policy.
5. On the matching keyboard path, stop both MotionValues, set both targets
   directly, and return. On every other path, preserve the two existing
   `animate(..., spring.fast)` calls.
6. Confirm the pending marker is cleared before either branch exits. Do not add
   a timer, global event listener, key-name list, or React state for input-source
   tracking.

## Boundaries

- Modify only `components/ui/slider.tsx`.
- Plan 002 is a dependency and must execute first; plan 001 is independent.
- Do NOT modify `components/parameter-slider.tsx`, Base UI, or public slider
  props and callback types.
- Do NOT remove animation from pointer-down jumps or ordinary programmatic prop
  changes. This plan owns only keyboard-originated controlled updates.
- Do NOT alter pointer drag behavior, step rounding, min/max handling,
  `zeroTarget`, hover previews, tooltips, colors, focus rings, audio hooks, or
  displayed value formatting.
- Do NOT replace Base UI keyboard behavior with `onKeyDown`; preserve its Arrow,
  Page, Home, End, orientation, direction, and ARIA semantics.
- Do NOT use a boolean source flag. Store the pending numeric value and compare
  it to the committed controlled value with `Object.is`.
- Do NOT add a duration, easing, spring, dependency, source file, or token.
- If the cited code or plan-002 postcondition does not match commit `0b865e8`,
  STOP and report the drift instead of improvising.

## Verification

- **Mechanical**:
  - Run `pnpm exec tsc --noEmit`; expect exit code 0 and no TypeScript errors.
  - Run `pnpm lint`; expect exit code 0 with no new lint or React Hooks warnings
    in `components/ui/slider.tsx`.
  - Run `pnpm build`; expect the Next.js production build to complete.
  - Run `rg -n "pendingKeyboardValueRef|fillPercent\.stop|zeroOffset\.stop" components/ui/slider.tsx`; expect the source marker, both cancellation calls, and the matching-value branch.
  - Inspect the diff and confirm that pointer handlers, Base UI markup, public
    props, `onChange` value calculation, ARIA attributes, and `spring.fast`
    configuration are unchanged.
- **Feel check**:
  - Run `pnpm dev`, focus a parameter slider with Tab, and press Arrow Left and
    Arrow Right one step at a time. The fill edge, handle line, displayed number,
    and shader result must change together on the key frame.
  - Hold an Arrow key for at least two seconds. The visual must remain locked to
    every repeated value without trailing, easing, or catching up after release.
  - Press Home, End, Page Up, and Page Down where Base UI supports them. Endpoint
    and page steps must land immediately and preserve their current values.
  - In DevTools, inspect at 10% animation playback speed and record rapid key
    alternation. No fill/handle motion may continue between keyboard steps. A
    pointer click performed afterward must still show the existing 80ms,
    zero-bounce `spring.fast` settle.
  - While a pointer/programmatic spring is still settling, focus the slider and
    press an Arrow key. The prior spring must stop immediately; the keyboard
    target must not drift backward afterward.
  - Trigger a normal external value reset after keyboard use. It must retain its
    existing spring, demonstrating that the pending keyboard marker was consumed.
  - Emulate `prefers-reduced-motion: reduce` and repeat the keyboard checks. The
    keyboard path must remain immediate and functionally identical; this plan
    must not add or remove other reduced-motion behavior.
- **Done when**: every keyboard-originated parameter step updates the visual
  MotionValues immediately with no spring or residual velocity; pointer and
  ordinary programmatic behavior remain unchanged; stale source markers cannot
  affect later updates; plan 002's transform-only rendering remains intact; and
  typecheck, lint, and production build pass.
