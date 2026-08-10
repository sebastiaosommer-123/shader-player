/**
 * Recording the canvas, as far as it can be taken without React.
 *
 * The stateful half — the recorder's lifetime, the clock, the auto-stops — is
 * hooks/use-video-recorder.ts. This file is the part with no lifetime: what the
 * browser can encode, how fast, at what bitrate, and under what extension. Same
 * split as lib/canvas-capture.ts against hooks/use-capture-slide-in.ts.
 */

/**
 * Frames per second handed to captureStream.
 *
 * These shaders are slow-moving gradients with no high-frequency motion, so 60
 * would double the file to encode information that isn't there. 30 is also what
 * every phone's video mode defaults to, which is the point of comparison anyone
 * will actually make.
 */
export const RECORD_FPS = 30

/**
 * The cap, after which recording stops itself.
 *
 * Fifteen seconds is long enough for a shader to complete most of a cycle and
 * short enough that the shutter ring can carry the whole of it as a progress
 * track — which is the real argument for having a cap at all. It also bounds the
 * blob: at the ceiling bitrate below, fifteen seconds is about 45MB, and an
 * uncapped recording forgotten in a background tab is not.
 */
export const MAX_RECORDING_MS = 15_000

export interface VideoFormat {
  mimeType: string
  extension: "mp4" | "webm"
}

/**
 * Probed in order, and **mp4 first on purpose.**
 *
 * The deliverable is a file the user keeps and sets as a wallpaper, and a .webm
 * will not open in QuickTime, will not import into Photos, and is not playable
 * on iOS at all. A browser that can *record* a format can always play it, so the
 * in-app <video> is self-consistent whichever branch wins — the only thing that
 * differs is whether the exported file is any use outside the browser, and there
 * mp4 wins outright.
 *
 * Safari only ever offers mp4/avc1. Chrome has offered it since ~126 wherever a
 * platform H.264 encoder exists and falls back to VP9 otherwise. Firefox takes
 * the WebM branch.
 */
const CANDIDATES: VideoFormat[] = [
  { mimeType: "video/mp4;codecs=avc1.42E01E", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
  { mimeType: "video/mp4", extension: "mp4" },
]

/** undefined until first asked for; null once known to be unavailable. */
let format: VideoFormat | null | undefined

export function pickVideoFormat(): VideoFormat | null {
  if (format !== undefined) return format
  format = null
  // isTypeSupported is guarded separately from MediaRecorder itself: some Safari
  // 14 builds shipped the constructor without it.
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return format
  }
  format = CANDIDATES.find((candidate) => MediaRecorder.isTypeSupported(candidate.mimeType)) ?? null
  return format
}

/**
 * Whether this browser can record the canvas at all.
 *
 * Touches `MediaRecorder`, which does not exist on the server — only ever call
 * this from an effect, or the markup will not match on hydration.
 */
export function isVideoCaptureSupported(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    typeof HTMLCanvasElement.prototype.captureStream === "function" &&
    pickVideoFormat() !== null
  )
}

/**
 * Bits per second for a canvas of this size, and deliberately generous.
 *
 * These shaders are smooth gradients, which is the one kind of material modern
 * codecs handle badly: starve them and you get banding and blocking in exactly
 * the flat regions that the whole image consists of. 0.12 bits per pixel per
 * frame is roughly twice what a codec would want for ordinary footage, and it is
 * the right trade here because the artefact is the point.
 *
 * The ceiling stops a 2×-DPR desktop canvas from producing something absurd; the
 * floor keeps a small window from looking worse than the preview it came from.
 */
export function videoBitsPerSecond(width: number, height: number): number {
  const wanted = Math.round(width * height * RECORD_FPS * 0.12)
  return Math.min(Math.max(wanted, 6_000_000), 24_000_000)
}

/** The extension a recording of this type should land under. */
export function extensionFor(mimeType: string | undefined): "mp4" | "webm" {
  return mimeType?.startsWith("video/mp4") ? "mp4" : "webm"
}

/**
 * `0:07`. The viewfinder's timecode and the thumbnails' badge read the same way,
 * because they are the same number at different moments of its life.
 *
 * Rounded down, like every clock: a recording is "0:07" for the whole of its
 * eighth second, and rounding to nearest would have it claim 0:08 halfway
 * through.
 */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}
