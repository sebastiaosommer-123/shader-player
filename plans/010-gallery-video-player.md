# 010 — Give recordings a transport in the gallery

Stamped against commit `2497b36`.

## Why

Opening a recording in the gallery ran it muted on a loop and offered nothing
else. There was no way to pause it, no way to see how far through it was, and no
way to go back to a frame worth looking at. The filmstrip already advertised the
length — `CaptureBadge` puts `0:12` on every recording's frame — so the viewer
was withholding a number the rail had already told you.

The design is ported from the video player in the author's portfolio
(`temporary-portfolio/components/ui/video-player.tsx`): a scrim at the foot of
the frame carrying a thin scrubber, a play/pause, and `current / duration`,
auto-hiding after idle. Its close, mute and fullscreen controls are not carried
across — the gallery has its own close, and a canvas recording has no audio
track (`lib/video-capture.ts` records `canvas.captureStream()` and nothing
else).

## What changed

**New — `hooks/use-recording-playback.ts`.** Playback state for the capture on
screen. It does not start playback; `GalleryVideo` still does that on its own
`ready` gate and still owns the iOS blocked-autoplay fallback.

**New — `components/gallery-video-controls.tsx`.** The bar. Two placements,
`over-capture` (pointer gallery) and `above-strip` (touch gallery).

**Changed** — `gallery-video.tsx` takes an `attachVideo` callback ref alongside
its own; both galleries call the hook, pass the ref down, and render the bar.

## Decisions worth keeping

**The bar is in the chrome layer, not in the morph card.** The card is a
projection node — Framer owns its transform for the length of the morph, and a
plain child of one is scaled with it. The chrome layer also already fades in on
`{ delay: 0.3, duration: 0.18 }`, which is the portfolio's `controlsDelay`
to within a frame, so the whole of the gallery's chrome arrives on one curve
instead of two. The cost is a box in the pointer gallery that mirrors the
capture's `inset-y-0 left-0 right-28` wrapper and its `fitBox`; those are
duplicated and commented at both ends.

**Duration comes from `capture.durationMs`, not `video.duration`.** Three
reasons, and the third is the one that decided it:

1. A MediaRecorder WebM reports `Infinity` until seeked — the Firefox branch of
   `pickVideoFormat` and older Chrome. A scrubber divided by that is `NaN`.
2. The element's number is *frames encoded*, which is not how long the shutter
   was held. Starve the canvas mid-recording and the blob is a fraction of the
   take. Reproduced while verifying this plan: a fifteen-second recording made in
   a backgrounded tab came back as a 55ms, 118KB mp4, and `video.duration` said
   `0.055` — truthfully.
3. `durationMs` is what `CaptureBadge` already shows. A player reading `0:00`
   under a frame labelled `0:12` is the gallery contradicting itself. Same
   argument `stillUrl` makes for deriving rather than mirroring.

Seeks are separately clamped to `video.seekable`, so a clip genuinely shorter
than its wall-clock length is never asked for a position it does not have.

**The fill is driven by rAF, not `timeupdate`.** `timeupdate` fires about four
times a second, which at scrubber width is a fill that jumps rather than sweeps.
The loop writes one custom property, `--played`, to the track; the fill reads it
as `scaleX()` and the thumb's layer as `translateX(calc(… * 100%))`, so both are
transforms and neither costs layout. React re-renders only when the whole second
turns over. Same shape as the magnification field in
`gallery-thumbnail-strip.tsx`.

**The scrubber is hand-rolled, not `components/ui/slider.tsx`.** That Slider is a
parameter control with pips, tooltips and click-to-edit, and a 20px thumb against
this one's 10px. This one carries `touch-action: none` and takes pointer capture
on the press, which is what stops a horizontal drag being read as a page of the
touch gallery's carousel (`.gallery-carousel` is `touch-action: pan-x`).

**Recordings still loop**, and the transport does not change that. The clip is a
wallpaper preview; it runs continuously and the scrubber sweeps and resets.

## Verified

Driven through the Browser pane at 1280×720 and at 375×812.

- Bar arrives with the rest of the chrome; readout agrees with the rail badge
  (`0:00 / 0:12`, `0:00 / 0:15`).
- Press/drag/release on the track writes `--played` 0.4 → 0.75 and stops
  tracking after release; fill and thumb both render at the position.
- Auto-hide: visible while playing, `opacity: 0` after 2.5s idle, back to 1 on a
  pointer move over the viewer; held up indefinitely while paused.
- `Space` toggles playback from the body and correctly declines when the event
  target is a focused button.
- A still capture renders no bar; stepping still → recording brings it back
  reset to zero.
- Touch: bar stacks clear of the filmstrip (bar bottom 695px, strip top 732px),
  a tap on the capture toggles it without closing the gallery, scrubber resolves
  `touch-action: none` inside a `pan-x` carousel.
- Portrait recording in the pointer gallery: the bar is the width of the
  letterboxed picture, not the viewport.
- `npx tsc --noEmit` and `npm run build` clean; no console errors.

**Not verified end-to-end: playback of a full-length recording.** The Browser
pane runs `document.hidden` with rAF suspended, so the shader canvas never
renders and every recording made there encodes ~2 frames. The transport's
mechanics were verified against that degenerate blob and by driving the media
element's own events; a real clip playing through to its loop point needs a
foreground browser.
