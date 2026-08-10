# 009 — Record the canvas as video

Stamped against commit `35a253a`. Status: DONE.

## What changed

The shutter became mode-dependent. An **Image/Video** segmented control decides
what it produces, and Image mode drops the shader to frame rate zero — not as a
side effect but as the feature: a frozen canvas is a composable one, so the
parameters can be tuned against a fixed frame, and flipping Video → Image is how
a moment gets chosen.

Video mode records the canvas through `MediaRecorder` over
`canvas.captureStream`, capped at fifteen seconds, and the result lands in the
gallery beside the stills as a real file the user can download.

## Supersedes part of plan 001

Plan 001 froze the shader loop for reduced-motion users *inside*
`components/shader-canvas.tsx`, OR-ing `prefersReducedMotion` with `isPaused`
where no caller could see it. Three reasons to stop the canvas now converge — the
gallery is open, the mode is Image, and a recording is running (which overrides
both) — so the predicate moved up to `app/page.tsx` as a single `isFrozen`, and
the canvas became a pure function of one flag.

Reduced motion is no longer a runtime term at all. It **picks the initial capture
mode** and nothing else: a reduced-motion user boots into Image mode with a still
canvas, and selecting a mode named *Video* is itself the consent for motion. A
runtime term would have silently re-frozen the canvas every time the gallery
closed, undoing a choice the user had deliberately made.

Plan 001's intent is intact — reduced motion still means a still canvas by
default, and the canvas is still never hidden, faded or replaced.

## A correction to plan 001's verification steps

Plan 001 describes `useReducedMotion` as reactive and its checks assume toggling
the OS preference takes effect live. It does not. In the installed version
(`node_modules/framer-motion/dist/es/utils/reduced-motion/use-reduced-motion.mjs`)
the hook is `useState(prefersReducedMotion.current)` with no subscription: the
module-level listener updates a ref and never re-renders. It also returns `null`
on the server, so it cannot seed `useState` without a hydration mismatch.

**Every reduced-motion check in this repo requires a reload, not a live toggle.**

## Decisions worth keeping

**mp4 first.** Format negotiation tries `video/mp4;codecs=avc1` ahead of VP9/VP8.
The deliverable is a file the user keeps and sets as a wallpaper, and a `.webm`
will not open in QuickTime, will not import into Photos, and is not playable on
iOS at all. A browser that can record a format can always play it, so the in-app
`<video>` is self-consistent either way — only the exported file's usefulness
differs.

**Generous bitrate.** 0.12 bits per pixel per frame, floor 6 Mbps, ceiling 24.
These shaders are smooth gradients, which is the one thing modern codecs handle
badly; starved, they band in exactly the flat regions the whole image consists
of.

**MotionValues, not state.** Progress and elapsed time never enter React state.
A `setState` per frame would re-render the page and both control bars thirty
times a second, which is the cost plans 002, 006 and 007 exist to keep out.

**Achromatic recording.** Every camera makes this red; this app has no other hue
for one to be coherent with, so a red would instantly be the loudest thing in it.
Instead the shutter ring — already present, already the camera body — empties and
refills as a progress track, the fill becomes the stop glyph, and the timecode
sits inside the canvas where a viewfinder puts it. (It is not burnt into the
recording: `captureStream` reads the canvas's own output, so DOM siblings are
invisible to the encoder.)

**The video is never the shared element.** The poster `<img>` keeps the
`layoutId` and performs the whole gallery morph; the `<video>` fades in over it
once the flight lands and the poster stays mounted underneath. A `<video>` whose
blob has not decoded paints as nothing, so making it the morph target means
watching a black rectangle grow out of the thumbnail. Leaving the poster in place
also keeps the close morph and `GalleryCloseFlight` unchanged.

## Hazards handled

- **Two object URLs per video capture** — the recording and the full-resolution
  poster. `handleDeleteCapture` revokes both; revoking only `dataUrl`, which was
  all there was when every capture was a PNG, leaks a poster per recording.
- **Tracks must be stopped** on `onstop`, or the canvas keeps feeding a dead
  stream for the rest of the session.
- **The clock starts in `onstart`**, not on the click: `MediaRecorder.start()`
  returns before the first frame is encoded.
- **Backgrounding ends the recording** rather than pausing it. `requestAnimationFrame`
  stops in a hidden tab but `captureStream` does not, so the encoder keeps taking
  frames of a canvas that is no longer being drawn — you would return to a clip of
  the right wall-clock length with a frozen stretch through the middle.
- **A mid-stream canvas resize ends it too.** VP8/VP9 tolerate a resolution
  change; `mp4/avc1` produces a file QuickTime refuses.
- **Opening the gallery mid-recording is blocked in the handler**, not only with
  `pointer-events: none`, which a keyboard activation walks straight past.

## Known limitations

- **Session memory has no ceiling.** Ten fifteen-second clips at the ceiling
  bitrate is on the order of 340MB of blobs held in React state alongside their
  full-resolution posters. No eviction exists for images either, but images are
  ~7MB — videos change the order of magnitude.
- **iOS Safari may open a downloaded video in a new tab** rather than saving it.
  Not fixable from here.
- If a mid-recording resize ever becomes a complaint, the fix is to record from a
  fixed-size intermediate 2D canvas that the hook blits the WebGL canvas into each
  frame: about 1–3ms per frame, immune to resize, and free resolution control.
  Deliberately not built.
