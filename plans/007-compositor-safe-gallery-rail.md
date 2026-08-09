# 007 — Compose gallery-rail motion into transform strings

- **Status**: DONE
- **Commit**: 3ae9987
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 source file, about 35–55 changed lines

## Problem

The desktop gallery rail computes a continuous Dock-like magnification field.
One pointer update performs an O(n) pass and writes two numeric motion values to
every visible frame:

```tsx
// components/gallery-thumbnail-strip.tsx:141-144,361-414 — current
interface FrameValues {
  scale: MotionValue<number>
  y: MotionValue<number>
}

const applyField = useCallback(() => {
  // ... scale and spread calculations ...

  for (let index = 0; index < count; index += 1) {
    const values = valueRefs.current[index]
    if (!values) continue
    values.scale.set(scales[index])
    values.y.set(spread[index] - anchor)
  }

  const ringPosition = Math.min(Math.max(selection.get(), 0), count - 1)
  const lower = Math.min(Math.floor(ringPosition), Math.max(count - 2, 0))
  const upper = Math.min(lower + 1, count - 1)
  const between = ringPosition - lower
  const lowerCenter = (centers[lower] ?? 0) + spread[lower] - anchor
  const upperCenter = (centers[upper] ?? 0) + spread[upper] - anchor
  ringScale.set(scales[lower] + (scales[upper] - scales[lower]) * between)
  ringY.set(lowerCenter + (upperCenter - lowerCenter) * between - height / 2)
}, [ringScale, ringY, selection, strength])
```

Those values are rendered through Framer Motion's `y` and `scale` shorthand
styles on every frame and on the selection ring:

```tsx
// components/gallery-thumbnail-strip.tsx:782-787,848-892 — current
<motion.div
  aria-hidden
  data-gallery-thumbnail-selection
  className="pointer-events-none absolute right-4 top-0 z-10 h-14 w-20 origin-right"
  style={{ y: ringY, scale: ringScale }}
>

// ...

const scale = useMotionValue(1)
const y = useMotionValue(0)

useEffect(() => {
  if (!isVertical) return
  const values = { scale, y }
  registerValues(displayIndex, values)
  return () => registerValues(displayIndex, null)
}, [displayIndex, isVertical, registerValues, scale, y])

// ...

style={isVertical ? { scale, y } : undefined}
```

Under the audit performance rules, Framer's individual transform shorthands are
main-thread motion. The cost multiplies with capture count and runs on pointer,
selection-spring, field-spring, scroll, and resize updates. React correctly sits
out already; the remaining fix is to hand the browser one compositor-friendly
full transform string per element instead of two shorthand properties.

## Target

Each vertical frame owns one `MotionValue<string>` containing both translation
and scale. The selection ring uses the same representation. Preserve the exact
scale/displacement math, `origin-right`, selection spring, field spring, scroll
coupling, mobile strip behavior, and reduced-motion branch.

Change the registry type and ring state:

```tsx
// components/gallery-thumbnail-strip.tsx — target
interface FrameValues {
  transform: MotionValue<string>
}

const IDENTITY_TRANSFORM = "translate3d(0, 0px, 0) scale(1)"

// inside GalleryThumbnailStrip
const ringTransform = useMotionValue(IDENTITY_TRANSFORM)
```

Remove `ringY` and `ringScale`. In `applyField`, write one complete string for
each frame and one for the ring:

```tsx
// components/gallery-thumbnail-strip.tsx — target applyField excerpt
for (let index = 0; index < count; index += 1) {
  const values = valueRefs.current[index]
  if (!values) continue
  const translateY = spread[index] - anchor
  values.transform.set(
    `translate3d(0, ${translateY}px, 0) scale(${scales[index]})`
  )
}

const ringPosition = Math.min(Math.max(selection.get(), 0), count - 1)
const lower = Math.min(Math.floor(ringPosition), Math.max(count - 2, 0))
const upper = Math.min(lower + 1, count - 1)
const between = ringPosition - lower
const lowerCenter = (centers[lower] ?? 0) + spread[lower] - anchor
const upperCenter = (centers[upper] ?? 0) + spread[upper] - anchor
const nextRingScale =
  scales[lower] + (scales[upper] - scales[lower]) * between
const nextRingY =
  lowerCenter + (upperCenter - lowerCenter) * between - height / 2

ringTransform.set(
  `translate3d(0, ${nextRingY}px, 0) scale(${nextRingScale})`
)
```

The callback dependency list becomes:

```tsx
}, [ringTransform, selection, strength])
```

Render the ring with the full transform and a compositor hint:

```tsx
<motion.div
  aria-hidden
  data-gallery-thumbnail-selection
  className="pointer-events-none absolute right-4 top-0 z-10 h-14 w-20 origin-right"
  style={{ transform: ringTransform, willChange: "transform" }}
>
```

Each `GalleryThumbnailFrame` registers and renders one transform value:

```tsx
// components/gallery-thumbnail-strip.tsx — target GalleryThumbnailFrame excerpt
const transform = useMotionValue(IDENTITY_TRANSFORM)

useEffect(() => {
  if (!isVertical) return
  const values = { transform }
  registerValues(displayIndex, values)
  return () => registerValues(displayIndex, null)
}, [displayIndex, isVertical, registerValues, transform])

useEffect(() => {
  if (isVertical) return
  transform.set(IDENTITY_TRANSFORM)
}, [isVertical, transform])

// ...

style={
  isVertical
    ? { transform, willChange: "transform" }
    : undefined
}
```

The function order is deliberate:
`translate3d(0, y, 0) scale(s)` keeps the translation in rail coordinates while
the card scales about the existing right-edge origin. Do not reverse it to
`scale(s) translateY(y)`, which would scale the displacement and break the
prefix-sum spacing math.

## Repo conventions to follow

- Follow the complete transform-string approach in
  `components/ui/slider.tsx:1203-1216` and `:1658-1699`, including
  `willChange: "transform"` on the element whose transform changes.
- Preserve the direct-write policy documented at
  `components/gallery-thumbnail-strip.tsx:118-128`: pointer tracking has no
  spring; only field activation/deactivation springs.
- Preserve `SELECTION_SPRING` exactly as
  `{ type: "spring", duration: 0.28, bounce: 0 }` and `FIELD_SPRING` exactly as
  `{ type: "spring", duration: 0.22, bounce: 0 }`.
- Preserve the comments and behavior around `origin-right`, the separate rail
  selection ring, and layout-independent `offsetTop` measurements.

## Steps

1. In `components/gallery-thumbnail-strip.tsx`, add `IDENTITY_TRANSFORM` near
   `FrameValues` and change `FrameValues` to one transform string motion value.
2. Replace `ringY`/`ringScale` with `ringTransform`.
3. Rewrite only the output portion of `applyField` as shown. Do not alter the
   falloff, scale, prefix-sum, anchor, or ring interpolation calculations.
4. Bind the selection ring through `style.transform` and add `willChange`.
5. In `GalleryThumbnailFrame`, replace the numeric `scale`/`y` motion values,
   registry object, reset effect, and vertical style with the single transform
   motion value shown in **Target**.
6. Update the component comment at `components/gallery-thumbnail-strip.tsx:165-168`
   from "writes two motion values per frame" to "writes one composed transform
   motion value per frame."

## Boundaries

- Do NOT change the magnification strength (`1.34`), spread (`2.5`), thumbnail
  geometry, radii, selection math, scroll centering, or any spring config.
- Do NOT change the mobile horizontal strip's `whileTap={{ scale: 0.97 }}`; that
  branch is not the O(n) desktop field and never receives the vertical transform.
- Do NOT reintroduce a shared-element selection ring inside each scaled frame;
  the existing comments document why projection cannot model that hierarchy.
- Do NOT use Framer's `x`, `y`, or `scale` style shorthands on the vertical rail.
- Do NOT use a parent CSS variable to drive child transforms.
- Do NOT add dependencies.
- If the cited code has drifted from commit `3ae9987`, STOP and report instead
  of improvising.

## Verification

- **Mechanical**:
  - Run `npm run lint`; expect exit code 0.
  - Run `npm run build`; expect a successful Next.js production build.
  - Run
    `rg -n 'style=\{\{ y: ringY, scale: ringScale \}\}|style=\{isVertical \? \{ scale, y \}' components/gallery-thumbnail-strip.tsx`;
    expect no matches.
  - Run
    `rg -n 'ringY|ringScale|values\.scale|values\.y' components/gallery-thumbnail-strip.tsx`;
    expect no executable-code matches.
  - Confirm `translate3d(0, ...px, 0) scale(...)` is the only vertical field
    transform order.
- **Feel check**:
  - Populate at least 20 captures, open the desktop gallery, and sweep the
    pointer quickly from top to bottom through the rail. The card under the
    pointer must remain anchored and neighbours must preserve their gaps exactly
    as before.
  - Move the pointer in and out repeatedly while changing the selected capture
    with wheel and keyboard input. The ring must remain glued to the current
    frame and must not overshoot or drift during overlapping 280ms steps.
  - Delete captures from the start, middle, and end while the field is active.
    Renumbering must not send the ring on a lap of the rail.
  - In DevTools, throttle CPU to 4× and record a long rail sweep. Confirm frame
    styles update as one `transform` and no React commits occur per pointer move.
  - Enable Paint Flashing and Layers. Thumbnails and ring should stay on
    compositor layers without layout/paint flashes from position changes.
  - Set animation playback to 10% and compare before/after recordings. The
    spatial curve, right-edge origin, selection timing, and field timing must be
    visually identical.
  - Toggle `prefers-reduced-motion: reduce`; desktop magnification must remain
    disabled and selection must still update immediately.
- **Done when**: the rail writes one full transform string per moving element,
  geometry and timing are unchanged, the ring stays attached under interruption,
  and long rails remain smooth under CPU throttling.
