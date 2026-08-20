# 011 — Split the mobile screen between the viewfinder and the controls

Stamped against commit `908484e`. Status: DONE.

## What changed

The mobile controls were a bottom sheet: a Radix dialog pinned to the bottom
edge, `h-[400px]`, sliding up from `translateY(100%)` over the canvas. It covered
the one thing you open it to look at.

They are now a **split**. Tapping the filters button scales the shader canvas
down from its top edge, and the controls take the half of the screen it gives up.
Nothing slides over anything. On the way out the panel leaves, the canvas grows
back, and the control bar returns to meet it.

`components/controls-sheet.tsx` → `components/controls-panel.tsx`, because
"sheet" stopped being true.

## The split

One number, `controlsSplit.openFraction = 0.5`, read from two places that have to
agree:

- the panel's `top` is `50dvh`, straight CSS;
- the canvas scale is `(rootHeight × 0.5 − canvasGapPx) ÷ the canvas box's own
  layout height`, measured by `hooks/use-controls-split.ts`.

The page root is exactly `100dvh` tall, so the two edges come off one number and
cannot drift. `canvasGapPx` is **8px** of air between them, and it is spent on
the canvas rather than the panel: the panel's height is what the parameters have
to live in and is already the tighter of the two on a short phone, while the
canvas gives up 8px of an already-scaled box for about a hundredth of a point of
scale. Both surfaces are `--background`, so this is not a seam anyone can point
at — it is the difference between the artwork *ending* and the artwork being
cropped by the thing below it.

Measured at 375×812, 390×844 and 375×667 the gap is 8.0px on all three and the
scale lands between **0.61 and 0.65** — a fraction rather than a fixed panel
height, so a short phone and a tall one both get a viewfinder in proportion to
their screen.

`top-[50vh]` is in the class list as the fallback for browsers without `dvh`, the
same arrangement the page root uses for `h-screen`/`100dvh`. It is the one number
that has to be kept in step with `openFraction` by hand — Tailwind cannot see a
computed class name.

## Scale, not layout

The canvas box keeps its layout height and the element inside it takes
`transform: scale(k)` with `transform-origin: top center`. Three reasons, all
load-bearing:

1. **Aspect ratio.** A height change re-renders the shader into a shorter
   full-width box. A uniform scale gives a smaller copy of the same picture, with
   black gutters either side — which is what the design asks for. The artwork is
   not reframed, it is set back. Verified: 0.5752 natural → 0.5751 scaled.
2. **The compositor.** `height` is layout + paint + composite on the main thread,
   against a WebGL loop already drawing every frame.
3. **No buffer churn.** `ShaderCanvas` observes its `<canvas>` with a
   `ResizeObserver` that reallocates and *wipes* the drawing buffer on every
   callback. RO reports the border box, which a transform does not touch, so it
   stays silent for the whole transition. Verified by sampling `canvas.width ×
   canvas.height` every frame across a full open and a full close: one value,
   `750×1304`, throughout. A height animation would have wiped and redrawn the
   buffer once per frame.

The corner radius scales with the box, 12px → ~7.5px. Correct, not an oversight:
a card that has moved away has smaller corners.

## Three elements where there were two

The canvas subtree gained a middle wrapper, and it is not decoration.

```
canvas box        ← measured; layout height never changes
  relative box    ← unscaled frame of reference
    scaled box    ← transform lives here: <canvas> + CaptureFlash
    RecordingTimer
```

The flash stays *inside* the scale, because the flash is the frame blinking and
should be whatever size the frame currently is. The timecode stays *outside*,
because a readout taken down to 62% is eight pixels tall. It needs no
counter-transform to do that: its `top` already sits on the transform origin's
row, and its `left: min(50vw, …)` resolves to the origin's own column on mobile,
so leaving it in the unscaled box parks it exactly on the shrunken viewfinder's
top edge. Verified mid-recording — 13px, top 12, centre 187.5 — identical with
the panel open and closed.

## Timing

Curve is `cubic-bezier(0.23, 1, 0.32, 1)` everywhere, the app's existing hard
ease-out. It is right even though this is an element *moving on screen*, which
normally argues for an ease-in-out: the move is the response to the press, and an
ease-in-out is dead for its first third. Dead frames immediately after a press
read as latency — the same argument `galleryEffects.dismissEase` already makes.

No spring and no bounce. The return leg ends at `scale(1)`, the canvas at full
size against the viewport edges and the control bar; an overshoot has nowhere to
go but off screen and under the bar.

| | Delay | Duration |
| --- | --- | --- |
| **Enter** — bar out (existing `hide()`) | 0 | 150 / 180ms |
| **Enter** — canvas `1 → k` | 0 | 280ms |
| **Enter** — panel fade + 8px rise | 110ms | 180ms |
| **Exit** — panel fade + 8px drop | 0 | 100ms |
| **Exit** — canvas `k → 1` | 30ms | 200ms |
| **Exit** — bar in | 60ms | 150 / 180ms |

Enter settles at ~290ms, exit at ~240ms — about 17% quicker, the same
relationship the sheet had between its 250ms in and 200ms out.

Sampled per frame on the enter: at 110ms, when the panel begins, the canvas has
covered **87%** of its travel. The room exists before anything is put in it. On
the exit the ordering is the mechanism rather than a flourish — the panel is
opaque and sits above the canvas, so it has to be gone before the canvas grows
back through it. Sampled: panel at **0.6% opacity** by the time the canvas has
travelled 65%.

**The panel does not travel, beyond 8px of settle.** A panel sliding up while the
canvas shrinks down is two elements converging on one axis, and it would
re-import the very sheet vocabulary this change exists to remove. The canvas is
the only thing that moves; the panel materialises in the room it left.

**`animationFillMode: "both"` is required, not defensive.** tw-animate-css
defaults `--tw-animation-fill-mode` to `forwards`, so for the length of
`animationDelay` the panel would sit at its *resting* style — fully opaque, in
place — and then snap back to the first keyframe. This was a live (small) bug on
the old sheet's `animationDelay: "50ms"` content fade.

## Two decisions reversed

**The shader picker scrolls now.** It was pinned above the scroll region on the
argument that "which shader you are on is the frame for everything below, and a
frame that scrolls away is not one." That was written for a sheet that covered
the artwork. The shader is on screen above this panel the entire time, so the
track is not what tells you which one you have — and in a panel half a screen
tall, a second row of fixed chrome is 48px the parameters need more.

**`sheetOpen` moved out of `MobileNav` and into `app/page.tsx`.** Opening the
controls scales the canvas, and the canvas is the page's. The bar renders the
button that sets the flag and the panel that reads it, but it is not where the
flag can live.

## Smaller things worth keeping

**`bg-background` on the page root, below `md`.** Once the canvas scales down it
stops covering its own box and the gutters fall through to `<body>`, which is
painted from the *page* theme. Measured: body resolves to white while the mobile
subtree is pinned dark, so without this a phone on a light system theme frames
the artwork in white.

**`hide()` gained a one-directional return delay.** Leaving is immediate; coming
back waits 60ms. The rule is about the bar rather than about the reason — the bar
is the destination, so it arrives last. Concretely it stops the controls fading
up underneath a panel still fading down. It also applies when a recording ends,
which is a behaviour change on that path, and there it reads as the clip
resolving rather than as lag.

**The scrim is a gradient, not a mask.** 56px of `--background` → transparent over
the top of the scroll region, opacity ramped to full over the first 24px of
scroll and written straight to the element rather than through state — this fires
every scroll frame, and a `setState` would re-render every slider in the panel to
change one number on one div. A `mask-image` on the scroller would have been a
truer fade but would clip the colour picker's popover, which opens out of that
box; `parameter-group.tsx` already documents what a stray clip does to a slider's
tooltip.

**The scrim overlaps 4px up, behind the header.** The scroll region and the scrim
otherwise share one edge — the header's bottom — and a shared edge is a rounding
decision each box makes on its own. The scroller is composited on its own layer,
so its clip and the scrim's paint land on device pixels independently: wherever
that edge falls on a fraction, one rounds up and a hairline of unveiled content
survives between them. It is invisible at DPR 2 on an even viewport, where the
edge is a whole device pixel; a phone at DPR 3 with an odd height puts it on a
half, and the first row of a group header shows through as a bright sliver.

The fix removes the shared edge rather than trying to align it. The scrim starts
4px higher and its gradient's first stop is pushed down by the same 4px, so the
overlap is solid, hidden behind a header that is now explicitly `bg-background`
and `z-10`, and the *visible* fade still begins exactly on the header's edge and
is still 56px tall. Measured at a deliberately fractional panel offset: overlap
4.000, visible fade 56.000.

Worth recording what this was **not**, because the first attempt chased the wrong
thing: the gradient's own shape. A straight `--background → transparent` ramp is
weak in its middle, and it is tempting to read a sliver of legible text as the
ramp being too gentle. It was not — the ramp is fine, and the two boxes simply
did not meet.

**Tap the canvas to dismiss.** Free — Radix's `DismissableLayer` already treats it
as outside, and modal mode puts `pointer-events: none` on the body so the tap
lands on `<html>`. Only the click sound had to be added, so the canvas, the X and
Escape all give the same receipt.

**`touch-action: pan-y` on the scroller.** `html, body { touch-action: none }`
below 768px kills the page bounce, so a scroller has to name the axis it wants
back — the same move `.gallery-carousel` makes for `pan-x`.

## Not done

The shader still renders at full resolution while displayed at ~62%, which is
about 2.6× the pixels needed. It is not a regression — that is the same load the
canvas carries when the panel is closed — but it is the obvious follow-up if
slider drags ever feel heavy on a low-end phone.
