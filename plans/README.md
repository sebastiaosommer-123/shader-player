# Animation improvement plans

Plans 001–003 are stamped against commit `0b865e8`; plans 004–008 are stamped
against commit `3ae9987`. Each executor must stop and report if the cited source
has drifted instead of improvising around it, except where a listed dependency
explicitly describes the expected earlier-plan changes.

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| [001](001-reduced-motion-shader-canvas.md) | Freeze continuous shader motion for reduced-motion users | HIGH | DONE | — |
| [002](002-compositor-safe-sliders.md) | Move slider drag rendering onto transforms | HIGH | DONE | — |
| [003](003-instant-keyboard-slider-updates.md) | Make keyboard slider steps immediate | HIGH | DONE | 002 |
| [004](004-suppress-shader-group-mount-animations.md) | Animate parameter groups only when the user toggles them | HIGH | DONE | — |
| [005](005-single-pass-shader-program-swaps.md) | Compile each shader program once per selection | HIGH | DONE | — |
| [006](006-compositor-safe-color-surface.md) | Move color-surface cursors with compositor transforms | HIGH | DONE | — |
| [007](007-compositor-safe-gallery-rail.md) | Compose gallery-rail motion into transform strings | HIGH | DONE | — |
| [008](008-reduced-motion-parameter-overlays.md) | Remove parameter-control movement under reduced motion | MEDIUM | DONE | 006 |
| [009](009-video-recording.md) | Record the canvas as video | — | DONE | supersedes part of 001 |

## Execution status

Plans 001–008 are implemented and verified. Plan 008 was executed after plan
006 so its color-picker accessibility branches preserve the compositor-safe
saturation cursor work.

Plan 009 is a feature rather than an animation fix, and is recorded here because
it moves the reduced-motion decision plan 001 made: the shader canvas no longer
resolves that preference itself. Plan 009 also corrects plan 001's claim that
`useReducedMotion` is reactive — it is not, so every reduced-motion check in this
repo needs a reload rather than a live toggle.

## Status values

- `TODO`: not implemented.
- `IN PROGRESS`: currently being executed.
- `DONE`: implemented and verified against the plan's mechanical and feel checks.
- `RETIRED`: no longer applicable after source or product-direction changes.
