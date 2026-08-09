# 006 — Move color-surface cursors with compositor transforms

- **Status**: DONE
- **Commit**: 3ae9987
- **Severity**: HIGH
- **Category**: Performance
- **Estimated scope**: 1 source file, about 55–85 changed lines

## Problem

The app-used saturation/brightness surface tracks the hover cursor in React
state. Every pointer move reads geometry and schedules a component render, even
when the pointer is only hovering:

```tsx
// components/ui/color-picker.tsx:430-480 — current
function SaturationSquare({ h, s, v, onChange }: SaturationSquareProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const hasMoved = useRef(false);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const shape = useShape();

  const updateCursorPos = useCallback((clientX: number, clientY: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setCursorPos({
      x: clamp01((clientX - rect.left) / rect.width) * 100,
      y: clamp01((clientY - rect.top) / rect.height) * 100,
    });
  }, []);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      updateCursorPos(e.clientX, e.clientY);
      if (!dragging) return;
      hasMoved.current = true;
      updateFromPointer(e.clientX, e.clientY);
    },
    [dragging, updateFromPointer, updateCursorPos]
  );
```

Both the selected cursor and hover cursor are positioned with layout-triggering
`left` and `top` values:

```tsx
// components/ui/color-picker.tsx:543-572 — current
<motion.div
  className="absolute pointer-events-none rounded-full"
  initial={false}
  animate={{
    left: `${s * 100}%`,
    top: `${(1 - v) * 100}%`,
    width: 18,
    height: 18,
  }}
  transition={{ duration: 0 }}
  style={{
    transform: "translate(-50%, -50%)",
    border: "1px solid white",
    boxShadow: "0 0 0 1px rgba(0,0,0,1)",
    backgroundColor: thumbColor,
  }}
/>
{hovered && !dragging && cursorPos && (
  <div
    className="absolute pointer-events-none rounded-full"
    style={{
      left: `${cursorPos.x}%`,
      top: `${cursorPos.y}%`,
      width: 18,
      height: 18,
      transform: "translate(-50%, -50%)",
      border: "2px solid rgba(255, 255, 255, 0.55)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.2)",
    }}
  />
)}
```

During a drag, `onChange` must still update the controlled color and live shader.
The avoidable work is the second pointer-driven React state update and cursor
layout. This path is hit continuously while the full-screen WebGL canvas is
drawing, so the cursor geometry must stay off layout and off React's render loop.

## Target

Use one full transform-string `MotionValue` per cursor. Keep React state only to
mount the hover cursor once after the first move and unmount it on leave. The
pointer path writes pixel-space transforms directly; selected `s`/`v` changes
and surface resizes resynchronize the selected cursor through the same helper.

Update the imports:

```tsx
// components/ui/color-picker.tsx — target imports
import {
  createContext,
  forwardRef,
  useContext,
  useRef,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, useMotionValue } from "framer-motion";
```

Add this pure helper at module scope near `SaturationSquare`, then replace
`cursorPos` and add transform motion values plus stable helpers:

```tsx
// components/ui/color-picker.tsx — target at module scope
const cursorTransform = (x: number, y: number) =>
  `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

// target inside SaturationSquare
const [hoverCursorVisible, setHoverCursorVisible] = useState(false);
const hoverCursorVisibleRef = useRef(false);
const selectedTransform = useMotionValue(
  "translate3d(0px, 0px, 0) translate(-50%, -50%)"
);
const hoverTransform = useMotionValue(
  "translate3d(0px, 0px, 0) translate(-50%, -50%)"
);
const selectedValueRef = useRef({ s, v });
selectedValueRef.current = { s, v };

const syncSelectedCursor = useCallback(() => {
  const node = ref.current;
  if (!node) return;
  const { s: nextS, v: nextV } = selectedValueRef.current;
  selectedTransform.set(
    cursorTransform(nextS * node.clientWidth, (1 - nextV) * node.clientHeight)
  );
}, [selectedTransform]);

useLayoutEffect(() => {
  syncSelectedCursor();
}, [s, v, syncSelectedCursor]);

useEffect(() => {
  const node = ref.current;
  if (!node || typeof ResizeObserver === "undefined") return;
  const observer = new ResizeObserver(syncSelectedCursor);
  observer.observe(node);
  return () => observer.disconnect();
}, [syncSelectedCursor]);
```

Replace the hover position updater with one that returns normalized selection
coordinates, writes the compositor transforms, and only enters React on the
first hover movement:

```tsx
// components/ui/color-picker.tsx — target pointer helper
const positionCursorsFromPointer = useCallback(
  (clientX: number, clientY: number, moveSelected: boolean) => {
    const node = ref.current;
    if (!node) return null;
    const rect = node.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    const normalizedX = clamp01((clientX - rect.left) / rect.width);
    const normalizedY = clamp01((clientY - rect.top) / rect.height);
    const layoutX = normalizedX * node.clientWidth;
    const layoutY = normalizedY * node.clientHeight;
    hoverTransform.set(cursorTransform(layoutX, layoutY));

    if (!hoverCursorVisibleRef.current) {
      hoverCursorVisibleRef.current = true;
      setHoverCursorVisible(true);
    }

    if (moveSelected) {
      selectedTransform.set(cursorTransform(layoutX, layoutY));
    }
    return {
      s: normalizedX,
      v: 1 - normalizedY,
    };
  },
  [hoverTransform, selectedTransform]
);
```

Use that helper from pointer-down and pointer-move. On a drag, set the selected
transform before calling the existing controlled `onChange`:

```tsx
// components/ui/color-picker.tsx — target pointer behavior
const onPointerDown = useCallback(
  (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    hasMoved.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const next = positionCursorsFromPointer(e.clientX, e.clientY, true);
    if (next) onChange(next.s, next.v);
  },
  [onChange, positionCursorsFromPointer]
);

const onPointerMove = useCallback(
  (e: React.PointerEvent<HTMLDivElement>) => {
    const next = positionCursorsFromPointer(
      e.clientX,
      e.clientY,
      dragging
    );
    if (!dragging || !next) return;
    hasMoved.current = true;
    onChange(next.s, next.v);
  },
  [dragging, onChange, positionCursorsFromPointer]
);
```

On pointer leave, clear only visibility state/ref; do not reset either transform:

```tsx
onPointerLeave={() => {
  setHovered(false);
  hoverCursorVisibleRef.current = false;
  setHoverCursorVisible(false);
}}
```

Render both cursors at a stable `left: 0; top: 0` with fixed dimensions and a
full transform motion value:

```tsx
// components/ui/color-picker.tsx — target cursor rendering
<motion.div
  className="absolute left-0 top-0 pointer-events-none rounded-full"
  style={{
    width: 18,
    height: 18,
    transform: selectedTransform,
    willChange: "transform",
    border: "1px solid white",
    boxShadow: "0 0 0 1px rgba(0,0,0,1)",
    backgroundColor: thumbColor,
  }}
/>
{hovered && !dragging && hoverCursorVisible && (
  <motion.div
    className="absolute left-0 top-0 pointer-events-none rounded-full"
    style={{
      width: 18,
      height: 18,
      transform: hoverTransform,
      willChange: "transform",
      border: "2px solid rgba(255, 255, 255, 0.55)",
      boxShadow: "0 0 0 1px rgba(0, 0, 0, 0.2)",
    }}
  />
)}
```

## Repo conventions to follow

- Follow the full-transform pattern already used by the reachable scrubber in
  `components/ui/slider.tsx:1203-1216` and `:1658-1699`: motion values carry a
  complete transform string, and the painted element sets
  `willChange: "transform"`.
- Direct manipulation must follow the pointer without a spring. The gallery
  rail documents the same rule in `components/gallery-thumbnail-strip.tsx:120-123`:
  continuous cursor input is written straight through.
- Keep `onChange` synchronous so the shader color remains attached to the hand.
- Keep the selected cursor's dynamic `backgroundColor`; repainting the cursor's
  actual color is necessary feedback and is outside the geometry optimization.

## Steps

1. Add `useLayoutEffect` and `useMotionValue` to the existing imports in
   `components/ui/color-picker.tsx`.
2. Remove `cursorPos` state, add `cursorTransform` at module scope, and add the
   two transform motion values, visibility state/ref, `selectedValueRef`, and
   `syncSelectedCursor` inside `SaturationSquare` exactly as shown.
3. Add the layout synchronization and `ResizeObserver`. The observer may update
   only the selected transform; it must not call `onChange`.
4. Delete `updateCursorPos` and `updateFromPointer`, replacing both with
   `positionCursorsFromPointer` in the pointer handlers. Keep pointer capture,
   `hasMoved`, keyboard handling, focus state, and controlled `onChange`
   semantics.
5. Replace the cursor markup with fixed-origin motion elements bound through
   `style.transform`. Remove all animated/runtime `left` and `top` cursor values.
6. Update nearby comments so they describe one transform write per pointer
   update rather than React cursor-position state.

## Boundaries

- Do NOT change color math, HSV/RGB conversion, keyboard increments, ARIA roles,
  cursor size, borders, shadows, surface height, or shape tokens.
- Do NOT debounce, throttle, spring, or delay direct pointer input.
- Do NOT stop controlled color updates from re-rendering the picker and shader;
  only cursor-position state and layout positioning are in scope.
- Do NOT use Framer's `x` or `y` shorthand props; use the complete
  `translate3d(...) translate(-50%, -50%)` string.
- Do NOT drive child transforms through CSS variables on the parent.
- Do NOT add dependencies.
- If the cited code has drifted from commit `3ae9987`, STOP and report instead
  of improvising.

## Verification

- **Mechanical**:
  - Run `npm run lint`; expect exit code 0.
  - Run `npm run build`; expect a successful Next.js production build.
  - Run
    `rg -n 'cursorPos|left:.*s \* 100|top:.*1 - v|left:.*cursorPos|top:.*cursorPos' components/ui/color-picker.tsx`;
    expect no matches in `SaturationSquare`.
  - Run
    `rg -n 'selectedTransform|hoverTransform|willChange: "transform"' components/ui/color-picker.tsx`;
    confirm both cursors use full transform motion values.
- **Feel check**:
  - Open every color picker and sweep the mouse rapidly over the saturation
    square without pressing. The ghost cursor must remain exactly under the
    pointer with no flicker on first appearance.
  - Press, drag fast circles along all four edges and corners, then release. The
    selected cursor and shader color must remain attached to the pointer; neither
    may trail, overshoot, or animate after release.
  - Resize the sidebar while the picker is open. The selected cursor must stay at
    the same normalized color coordinate.
  - Change saturation/brightness with Arrow keys. The selected cursor must move
    to the new value without a stale frame.
  - In DevTools Performance, record a five-second hover sweep. React commits
    should occur only when the ghost cursor mounts/unmounts, not for every hover
    pointer event. Controlled commits during an active color drag remain expected.
  - Enable Paint Flashing. Cursor position changes must not trigger layout of the
    surface; selected-cursor color repaint is allowed.
  - Use 4× CPU throttling and confirm the live shader and cursor stay smooth.
- **Done when**: both cursor positions are transform-driven, hover tracking no
  longer re-renders per pointer move, direct manipulation remains immediate, and
  resize/keyboard behavior preserves exact normalized color coordinates.
