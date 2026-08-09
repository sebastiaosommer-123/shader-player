# 004 — Animate parameter groups only when the user toggles them

- **Status**: DONE
- **Commit**: 3ae9987
- **Severity**: HIGH
- **Category**: Purpose & frequency
- **Estimated scope**: 1 source file, about 15–25 changed lines

## Problem

Changing shaders is a frequent content-selection action. The desktop sidebar
keys every group by shader so React deliberately mounts a fresh
`ParameterGroup` for the selected shader:

```tsx
// components/controls-sidebar.tsx:59-73 — current
{shaderConfig.parameterGroups.map((group) => (
  <ParameterGroup
    // Keyed by shader too, not by group name alone. Two shaders can
    // name a group the same thing — "Vertical Wave" and "Horizontal
    // Wave" exist in both Gradient Wave and Pixel Topography — and a
    // bare name key makes React reuse the instance across the switch.
    // The Collapsible inside then keeps the height it measured for the
    // *other* shader's parameter count and replays its open animation
    // against it, so the group renders clipped to a stale height.
    key={`${shaderId}:${group.name}`}
    group={group}
    params={params}
    onChange={updateParam}
    shaderId={shaderId}
  />
))}
```

The mobile sheet uses the same key pattern at
`components/controls-sheet.tsx:90-101`. The key is correct and must remain: it
prevents Radix from reusing a collapsible whose measured height belongs to a
different shader.

The problem is inside the fresh component. Every mounted open group receives
an opening keyframe immediately, whether or not the user touched that group:

```tsx
// components/parameter-group.tsx:55-89 — current
const handleToggle = () => {
  playDigitalClick("weak")
  toggleCollapsed()
}

return (
  <Collapsible open={!collapsed} onOpenChange={handleToggle}>
    <CollapsibleTrigger className="group flex h-9 w-full cursor-pointer items-center justify-between text-sm uppercase tracking-wider text-muted-foreground transition-[color,transform] duration-[125ms] ease-[cubic-bezier(0.23,1,0.32,1)] hoverFine:text-foreground active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none">
      {/* ... */}
    </CollapsibleTrigger>

    <CollapsibleContent
      ref={contentRef}
      onAnimationStart={(e) => {
        if (e.target === e.currentTarget) setAnimating(true)
      }}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setAnimating(false)
      }}
      className={cn(
        "data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up motion-reduce:animate-none",
        (animating || collapsed) && "overflow-hidden"
      )}
    >
```

Groups default to expanded, so one shader-tab press can replay three to seven
simultaneous 200ms height animations. The user asked to replace the controls,
not to watch every section disclose itself again.

## Target

Keep the shader-specific keys. Add one local flag that starts `false` for each
freshly mounted group and becomes `true` only in the explicit Radix
`onOpenChange` handler. Apply the open/close keyframe classes only after that
flag is true:

```tsx
// components/parameter-group.tsx — target
const [animateDisclosure, setAnimateDisclosure] = useState(false)

const handleToggle = () => {
  setAnimateDisclosure(true)
  playDigitalClick("weak")
  toggleCollapsed()
}

// ...

<CollapsibleContent
  ref={contentRef}
  onAnimationStart={(e) => {
    if (e.target === e.currentTarget) setAnimating(true)
  }}
  onAnimationEnd={(e) => {
    if (e.target === e.currentTarget) setAnimating(false)
  }}
  className={cn(
    animateDisclosure &&
      "data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up",
    "motion-reduce:animate-none",
    (animating || collapsed) && "overflow-hidden"
  )}
>
```

The first render of a group, a shader-driven remount, hydration of a persisted
collapsed state, and a viewport switch between the already-mounted desktop and
mobile copies must all snap to the correct state with no disclosure animation.
After the user presses that group's header, its existing 200ms open/close
keyframes remain unchanged.

## Repo conventions to follow

- Keep `key={`${shaderId}:${group.name}`}` in
  `components/controls-sidebar.tsx:68` and
  `components/controls-sheet.tsx:96`; their comments document a real stale-height
  failure.
- Keep collapse state in `hooks/use-collapsed-group.ts`; it is intentionally
  shared between the desktop and mobile surfaces and scoped by shader.
- Keep the existing `motion-reduce:animate-none` behavior and the temporary
  overflow clipping managed by `animating` in
  `components/parameter-group.tsx:31-53`.
- This plan changes animation eligibility, not the existing keyframe duration,
  curve, sound, state storage, or layout.

## Steps

1. In `components/parameter-group.tsx`, add
   `const [animateDisclosure, setAnimateDisclosure] = useState(false)` beside the
   existing `animating` state.
2. In `handleToggle`, call `setAnimateDisclosure(true)` before
   `toggleCollapsed()` so the keyframe class and the Radix state change land in
   the same React commit.
3. Split the unconditional keyframe class in `CollapsibleContent` as shown in
   **Target**: gate only the two `animate-collapsible-*` utilities behind
   `animateDisclosure`, while leaving `motion-reduce:animate-none` unconditional.
4. Do not edit either caller's shader-specific key.

## Boundaries

- Do NOT remove or weaken the shader-specific React keys.
- Do NOT change `hooks/use-collapsed-group.ts` or persisted collapse semantics.
- Do NOT change the 200ms `tw-animate-css` keyframes; plan 008 handles reduced
  motion, and the separately audited interruptibility issue is not part of this
  plan.
- Do NOT animate the parameter list, shader canvas, sidebar root, or mobile
  sheet as a replacement effect.
- Do NOT add dependencies.
- If the cited code has drifted from commit `3ae9987`, STOP and report instead
  of improvising.

## Verification

- **Mechanical**:
  - Run `npm run lint`; expect exit code 0.
  - Run `npm run build`; expect a successful Next.js production build.
  - Run
    `rg -n 'animateDisclosure|animate-collapsible-(down|up)' components/parameter-group.tsx`;
    confirm the keyframe utilities are conditional on `animateDisclosure`.
- **Feel check**:
  - Load desktop with all groups expanded and switch rapidly among every shader.
    The parameter content must replace immediately; no section should grow from
    zero height, and the sidebar must not perform an accordion-like cascade.
  - Open and close one group by pressing its header. That explicit action must
    retain the existing disclosure animation and weak click sound.
  - Switch away and back. The remembered open/closed state must appear
    immediately without replaying either keyframe.
  - Repeat in the mobile controls sheet and after crossing the 768px breakpoint.
  - In DevTools, set animation playback to 10%. A shader-tab press must create no
    `collapsible-down` animations; a group-header press must create exactly one.
  - Toggle `prefers-reduced-motion: reduce`; header presses must still change
    state, with no height motion.
- **Done when**: shader changes replace controls without disclosure motion,
  explicit group toggles still animate, persisted state remains correct, and no
  stale-height clipping regression returns.
