# Animation improvement plans

Plans are stamped against commit `0b865e8`. Each executor must stop and report
if the cited source has drifted instead of improvising around it.

| Plan | Title | Severity | Status | Depends on |
| --- | --- | --- | --- | --- |
| [001](001-reduced-motion-shader-canvas.md) | Freeze continuous shader motion for reduced-motion users | HIGH | DONE | — |
| [002](002-compositor-safe-sliders.md) | Move slider drag rendering onto transforms | HIGH | DONE | — |
| [003](003-instant-keyboard-slider-updates.md) | Make keyboard slider steps immediate | HIGH | DONE | 002 |

## Recommended execution order

1. Execute 001 to close the dominant full-screen accessibility gap.
2. Execute 002 to establish the slider's compositor-safe render geometry.
3. Execute 003 against the post-002 slider, adding the keyboard-specific direct-update policy without undoing the transform work.

Plans 001 and 002 touch different source files and may be executed in parallel.
Plan 003 must wait for plan 002 because both edit `components/ui/slider.tsx` and
003 assumes that 002 preserved `fillPercent`, `zeroOffset`, and `zeroTarget`.

## Status values

- `TODO`: not implemented.
- `IN PROGRESS`: currently being executed.
- `DONE`: implemented and verified against the plan's mechanical and feel checks.
- `RETIRED`: no longer applicable after source or product-direction changes.
