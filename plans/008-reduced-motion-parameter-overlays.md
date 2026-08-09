# 008 — Remove parameter-control movement under reduced motion

- **Status**: DONE
- **Commit**: 3ae9987
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 3 source files, about 90–140 changed lines

## Problem

The app's dominant canvas, gallery, sheet, capture arrival, and tab indicator
already honor `prefers-reduced-motion`. Three shared parameter-control files do
not import or read the preference.

Both slider implementations spring position values. The standard `Slider`, used
by the color picker's hue and alpha controls, springs programmatic/resize changes
and pointer-down jumps:

```tsx
// components/ui/slider.tsx:493-532,609-615 — current
const ro = new ResizeObserver(([entry]) => {
  const w = entry.contentRect.width;
  trackWidthRef.current = w;
  if (!dragging.current && initialSyncDone.current) {
    const v = valuesRef.current;
    const mn = minRef.current;
    const mx = maxRef.current;
    const px0 = valueToPixel(v[0], mn, mx, w);
    animate(motionX0, px0, spring.moderate);
    if (isRange && v[1] !== undefined) {
      const px1 = valueToPixel(v[1], mn, mx, w);
      animate(motionX1, px1, spring.moderate);
    }
  }
});

// ...

animate(motionX0, px0, spring.moderate);
if (isRange && v[1] !== undefined) {
  const px1 = valueToPixel(v[1], min, max, tw);
  animate(motionX1, px1, spring.moderate);
}

// ... pointer down ...
animate(motionX, finalPx, spring.moderate);
```

`SliderComfortable`, used for every shader parameter, correctly snaps keyboard
updates after plan 003 but still springs other programmatic/click changes:

```tsx
// components/ui/slider.tsx:1284-1308,1332-1344 — current
if (isKeyboardSync) {
  fillPercent.stop();
  zeroOffset.stop();
  fillPercent.set(percent);
  zeroOffset.set(nextZeroOffset);
  return;
}

animate(fillPercent, percent, spring.fast);
animate(zeroOffset, nextZeroOffset, spring.fast);

// ... pointer down ...
animate(fillPercent, newPercent, spring.fast);
animate(zeroOffset, newVal === min ? zeroTarget : 0, spring.fast);
```

Slider hover/value tooltips always travel vertically:

```tsx
// components/ui/slider.tsx:1442-1451 — current
<AnimatePresence>
  {hoverPreview && showHoverTooltip && !isPressed && (
    <motion.div
      ref={tooltipRef}
      key="hover-tooltip"
      className="absolute -translate-x-1/2 pointer-events-none z-20"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4, transition: spring.fast.exit }}
      transition={spring.fast}
```

The color format menu and outer app-used color picker always translate and
scale on entry/exit:

```tsx
// components/ui/color-picker.tsx:857-865,2083-2091 — current
<motion.div
  initial={{ opacity: 0, y: -4, scaleY: 0.96 }}
  animate={
    open
      ? { opacity: 1, y: 0, scaleY: 1 }
      : { opacity: 0, y: -4, scaleY: 0.96 }
  }
  transition={open ? spring.fast : spring.fast.exit}
  style={{ transformOrigin: "top center" }}
>

// outer popover uses the same values with spring.moderate
```

Finally, `FluidTooltip`, used by the appearance toggle and all color-channel
controls, always slides four pixels from its trigger side:

```tsx
// components/ui/tooltip.tsx:158-192 — current
const slideOffset = getSlideOffset(side);

// ...

<motion.div
  initial={{ opacity: 0, ...slideOffset }}
  animate={{
    opacity: open ? 1 : 0,
    x: 0,
    y: 0,
  }}
  transition={open ? spring.fast : spring.fast.exit}
>
```

Reduced motion should preserve useful opacity/color feedback while dropping
position and scale movement. These high-frequency controls currently do the
opposite of the surrounding app's established accessibility behavior.

## Target

### Shared motion-value update helper

In `components/ui/slider.tsx`, import `useReducedMotion` and `Transition`, then
add one helper near the existing constants. It must preserve normal spring
retargeting and stop/set only in reduced mode:

```tsx
// components/ui/slider.tsx — target imports/helper
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
  AnimatePresence,
  type MotionValue,
  type Transition,
} from "framer-motion";

function moveMotionValue(
  value: MotionValue<number>,
  target: number,
  transition: Transition,
  prefersReducedMotion: boolean,
) {
  if (prefersReducedMotion) {
    value.stop();
    value.set(target);
    return;
  }
  animate(value, target, transition);
}
```

Read and normalize the preference once inside both `Slider` and
`SliderComfortable`:

```tsx
const prefersReducedMotion = Boolean(useReducedMotion());
```

Replace spring calls that move `motionX0`, `motionX1`, `fillPercent`, or
`zeroOffset` in response to resize, pointer-down, pointer-up settle, and
programmatic changes with `moveMotionValue`. Example:

```tsx
moveMotionValue(
  motionX0,
  px0,
  spring.moderate,
  prefersReducedMotion,
);
```

```tsx
if (isKeyboardSync || prefersReducedMotion) {
  fillPercent.stop();
  zeroOffset.stop();
  fillPercent.set(percent);
  zeroOffset.set(nextZeroOffset);
  return;
}

animate(fillPercent, percent, spring.fast);
animate(zeroOffset, nextZeroOffset, spring.fast);
```

Direct pointer-move writes already use `.set(...)`; keep them direct. Add the
preference to every affected hook dependency list.

### Slider tooltip and hover movement

Pass `prefersReducedMotion` into `TooltipValue` and branch every slider tooltip
so reduced motion uses opacity only:

```tsx
// target for TooltipValue and both inline hover tooltips
initial={
  prefersReducedMotion
    ? { opacity: 0 }
    : { opacity: 0, y: 4 }
}
animate={
  prefersReducedMotion
    ? { opacity: 1 }
    : { opacity: 1, y: 0 }
}
exit={
  prefersReducedMotion
    ? { opacity: 0, transition: spring.fast.exit }
    : { opacity: 0, y: 4, transition: spring.fast.exit }
}
transition={spring.fast}
```

Keep the existing 80ms entry and 60ms exit tiers. For other slider hover motion:

- Standard-slider step dots remain `DOT_SIZE` under reduced motion; do not grow
  to `DOT_SIZE * 1.25`.
- `SliderComfortable`'s scrubber handle keeps
  `translateY(-50%) scaleY(1)` under reduced motion; do not shrink/grow on hover.
- Its pips handle retains fixed `top: 8` and `bottom: 8` under reduced motion.
- Color, opacity, focus outline, and tooltip fade feedback remain enabled.

### Color-picker popups and moving menu layers

In `components/ui/color-picker.tsx`, import `useReducedMotion`. Read it inside
both `FormatDropdown` and `ColorPickerPopover`:

```tsx
const prefersReducedMotion = Boolean(useReducedMotion());
```

Use opacity-only state objects for their outer popup wrappers:

```tsx
// target pattern; use spring.fast in FormatDropdown and spring.moderate in
// ColorPickerPopover exactly as each component does today
<motion.div
  initial={
    prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, y: -4, scaleY: 0.96 }
  }
  animate={
    prefersReducedMotion
      ? { opacity: open ? 1 : 0 }
      : open
        ? { opacity: 1, y: 0, scaleY: 1 }
        : { opacity: 0, y: -4, scaleY: 0.96 }
  }
  transition={open ? spring.fast : spring.fast.exit}
  style={{ transformOrigin: "top center" }}
>
```

For `ColorPickerPopover`, retain `spring.moderate`/`spring.moderate.exit` and
`transformOrigin: "top left"`.

The format menu's selected, hover, and focus layers also move through geometry.
Under reduced motion, snap `top`, `left`, `width`, and `height` with zero-duration
property transitions while retaining the existing 80ms opacity feedback:

```tsx
// components/ui/color-picker.tsx — target inside FormatDropdown
const fastGeometryTransition = prefersReducedMotion
  ? {
      top: { duration: 0 },
      left: { duration: 0 },
      width: { duration: 0 },
      height: { duration: 0 },
      opacity: { duration: 0.08 },
    }
  : { ...spring.fast, opacity: { duration: 0.08 } };

const moderateGeometryTransition = prefersReducedMotion
  ? {
      top: { duration: 0 },
      left: { duration: 0 },
      width: { duration: 0 },
      height: { duration: 0 },
      opacity: { duration: 0.08 },
    }
  : { ...spring.moderate, opacity: { duration: 0.08 } };
```

Use `moderateGeometryTransition` for the checked layer and
`fastGeometryTransition` for hover/focus. Keep their existing exit fades. Add
`motion-reduce:transform-none` to the format chevron so it does not jump to a
rotated state with its transition removed.

### Shared tooltip

In `components/ui/tooltip.tsx`, import and read `useReducedMotion` inside
`FluidTooltip`, then branch to opacity-only states:

```tsx
// components/ui/tooltip.tsx — target
import { motion, useReducedMotion } from "framer-motion";

// inside FluidTooltip
const prefersReducedMotion = Boolean(useReducedMotion());
const slideOffset = getSlideOffset(side);

// ...

<motion.div
  initial={
    prefersReducedMotion
      ? { opacity: 0 }
      : { opacity: 0, ...slideOffset }
  }
  animate={
    prefersReducedMotion
      ? { opacity: open ? 1 : 0 }
      : { opacity: open ? 1 : 0, x: 0, y: 0 }
  }
  transition={open ? spring.fast : spring.fast.exit}
  onAnimationComplete={handleExitComplete}
>
```

The tooltip remains mounted through its fade and retains the current 80ms/60ms
entry/exit timing. Only spatial travel is removed.

## Repo conventions to follow

- Use Framer Motion's `useReducedMotion`, matching
  `components/shader-canvas.tsx:4-27`, `components/controls-sheet.tsx:5-29`, and
  `components/gallery-thumbnail-strip.tsx:176-179`.
- Normalize with `Boolean(...)` only where a strict boolean is passed to helpers
  or child props.
- Follow the app's established policy: remove movement while preserving opacity
  or color. `components/wallpaper-gallery-mobile.tsx:293-356` keeps a 150ms
  reduced-motion crossfade while removing the shared-element movement.
- Preserve the completed keyboard-specific direct-update behavior from plan 003
  in `components/ui/slider.tsx:1292-1303`.
- Do not invent new timings. Keep `spring.fast` at 80ms/60ms exit,
  `spring.moderate` at 160ms/120ms exit, and existing 80ms opacity transitions.

## Steps

1. In `components/ui/slider.tsx`, add the imports and `moveMotionValue` helper,
   then read `prefersReducedMotion` inside both exported slider implementations.
2. Replace position spring calls for resize, programmatic sync, pointer-down,
   pointer-up settle, and `zeroOffset` updates with the helper or the explicit
   stop/set branch shown above. Keep direct drag `.set(...)` calls unchanged.
3. Thread the boolean through `TooltipValue` and branch all three slider tooltip
   variants to opacity-only reduced motion. Freeze the step-dot and handle-size
   hover transforms under the preference while retaining color/opacity feedback.
4. In `components/ui/color-picker.tsx`, add `useReducedMotion`, branch both popup
   wrappers to opacity-only reduced states, snap the three moving geometry layers,
   and suppress reduced-motion chevron rotation.
5. In `components/ui/tooltip.tsx`, add `useReducedMotion` and branch
   `FluidTooltip` to opacity-only entry/exit.
6. Audit the three edited files for any remaining reduced-mode `x`, `y`,
   `scale`, `scaleY`, animated `top`/`left`, or hover-size changes. Leave static
   transforms used solely for centering in place.

## Boundaries

- Do NOT remove all feedback: opacity, color, background, focus, and selected
  state must remain visible under reduced motion.
- Do NOT change direct pointer tracking, value math, snapping, keyboard steps,
  tooltip delays, popup positioning, focus management, deferred unmount timers,
  or ARIA semantics.
- Do NOT change spring values or introduce new durations/easings.
- Do NOT convert geometry to compositor transforms here; plans 006 and the
  separate format-menu performance finding own those optimizations. This plan
  only snaps geometry under reduced motion.
- Do NOT modify press affordances in app-level buttons; audit finding 6 is a
  separate future plan.
- Do NOT add dependencies.
- Execute plan 006 first because both plans edit
  `components/ui/color-picker.tsx`; if 006 has changed the cited saturation-square
  code, preserve its transform implementation and apply reduced motion only to
  the popups/menu layers described here.
- If any other cited code has drifted from commit `3ae9987`, STOP and report
  instead of improvising.

## Verification

- **Mechanical**:
  - Run `npm run lint`; expect exit code 0.
  - Run `npm run build`; expect a successful Next.js production build.
  - Run
    `rg -n 'useReducedMotion' components/ui/slider.tsx components/ui/color-picker.tsx components/ui/tooltip.tsx`;
    confirm all three files import and consume it.
  - Run
    `rg -n 'initial=\{\{ opacity: 0, y:|animate\(motionX|animate\(fillPercent|animate\(zeroOffset' components/ui/slider.tsx`;
    inspect every remaining match and confirm it is unreachable when
    `prefersReducedMotion` is true.
- **Feel check**:
  - With normal motion, test hue/alpha sliders, shader scrubbers, their hover
    tooltips, the color-format menu, outer color picker, channel tooltips, pips,
    focus rings, and programmatic value updates. Their current motion and timing
    must be unchanged.
  - Toggle `prefers-reduced-motion: reduce` in DevTools Rendering. Click empty
    points on both slider variants: values and visual positions must update on
    the same frame with no spring tail.
  - Hover slider values and channel inputs. Tooltips must fade but never move
    four pixels.
  - Open/close the outer color picker and format menu repeatedly. They must fade
    in place with no translate or `scaleY` movement.
  - Sweep pointer and keyboard focus across format rows. Selection, hover, and
    focus layers must snap to their new geometry while retaining the 80ms
    opacity feedback.
  - Change system reduced-motion preference while popups are open, then repeat
    every interaction. No component may get stuck mounted, invisible, or in an
    intermediate transform.
  - In DevTools Animations at 10% playback, reduced mode must show only opacity
    tracks for the audited overlays and no positional/scale tracks.
- **Done when**: normal motion is unchanged, reduced-motion sliders snap,
  popups/tooltips fade in place, menu geometry does not travel, and all focus,
  value, and deferred-unmount behavior remains functional.
