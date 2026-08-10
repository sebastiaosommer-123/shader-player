import { encodePng } from "./png-encoder"
import { SHADER_CONFIGS } from "./shader-configs"
import type { Capture } from "./types"
import { extensionFor } from "./video-capture"

/**
 * Long edge of the instant preview.
 *
 * The thumbnail is 48px on desktop and 44px on mobile, so 128 covers both at 2x
 * with room over. This costs about a millisecond to produce, against 70–94ms for
 * the full-resolution PNG — which is the entire point: the thumbnail and the
 * toolbar slot can start moving on the same frame as the shutter flash, instead
 * of waiting on an encode nothing at 48px needs.
 */
const PREVIEW_LONG_EDGE = 128

/**
 * A still copy of the live WebGL canvas.
 *
 * Sub-millisecond — it is a GPU blit, not an encode. Everything downstream reads
 * from this rather than from the canvas, which has moved on by the next frame.
 * (Only possible because shader-canvas.tsx sets preserveDrawingBuffer.)
 */
export function freezeFrame(canvas: HTMLCanvasElement): HTMLCanvasElement | null {
  const frozen = document.createElement("canvas")
  frozen.width = canvas.width
  frozen.height = canvas.height
  const ctx = frozen.getContext("2d")
  if (!ctx) return null
  ctx.drawImage(canvas, 0, 0)
  return frozen
}

/** A thumbnail-sized JPEG of a frozen frame, cheap enough for the click path. */
export function previewDataUrl(frozen: HTMLCanvasElement): string {
  const scale = PREVIEW_LONG_EDGE / Math.max(frozen.width, frozen.height, 1)
  const small = document.createElement("canvas")
  small.width = Math.max(1, Math.round(frozen.width * scale))
  small.height = Math.max(1, Math.round(frozen.height * scale))
  const ctx = small.getContext("2d")
  if (!ctx) return ""
  ctx.drawImage(frozen, 0, 0, small.width, small.height)
  return small.toDataURL("image/jpeg", 0.9)
}

/**
 * The real capture, as an object URL.
 *
 * A blob rather than toDataURL on purpose. toDataURL is synchronous and pins the
 * main thread for the whole encode, so a rapid second capture's flash would
 * stall on the first one's PNG whenever the two overlapped. It also hands back
 * base64 — a third larger than the bytes, held in React state as a string, for
 * every capture in the session. A blob keeps the binary once.
 *
 * The encode itself happens in a worker; see lib/png-encoder.ts for why, and for
 * what happens on a browser that cannot.
 *
 * The URL has to be revoked when its image is deleted; see handleDeleteImage.
 */
export async function encodeFullResolution(frozen: HTMLCanvasElement): Promise<string | null> {
  const blob = await encodePng(frozen)
  return blob ? URL.createObjectURL(blob) : null
}

/**
 * The full-resolution encode, plus the decode that has to happen before anything
 * swaps its `src` to the result.
 *
 * Without it the `<img>` goes blank for a frame while the browser reads a 7MB
 * PNG — a hole where the picture was, a beat after the shutter. A failed decode
 * resolves null, which leaves the caller on the preview it already had: still a
 * correct picture, just a soft one.
 *
 * Both callers need this exact pair — the image capture upgrading its own
 * artefact, and a recording upgrading its poster frame — so it lives here rather
 * than twice in app/page.tsx.
 */
export async function encodeFullResolutionDecoded(
  frozen: HTMLCanvasElement,
): Promise<string | null> {
  const full = await encodeFullResolution(frozen)
  if (!full) return null
  try {
    const probe = new Image()
    probe.src = full
    await probe.decode()
  } catch {
    URL.revokeObjectURL(full)
    return null
  }
  return full
}

/** Lowercase and hyphenated, so a display name is safe to put in a filename. */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * The name a downloaded capture lands under: `shader-haze-2026-08-04-211822.png`.
 *
 * **24-hour and zero-padded, which is the whole point of the format.** The
 * previous one wrote a 12-hour clock with an unpadded hour and AM/PM on the end
 * — `9-18-22PM` — and that does not sort. A file browser ordering by name puts
 * `10-…AM` above `9-…AM`, because it compares "1" against "9", and puts every
 * afternoon shot among the mornings because the meridiem is the last thing it
 * reads. A folder of these came out in an order with no meaning. Padded 24-hour
 * makes filename order and chronological order the same thing, permanently.
 *
 * The shader is in there because the alternative was throwing it away: this
 * function already took a `shaderId` that no caller passed and the body never
 * read. Naming it means a folder of wallpapers says what made each one, and
 * putting it ahead of the timestamp groups the collection by shader with each
 * group in order inside itself.
 *
 * Looked up against SHADER_CONFIGS rather than through getShaderConfig, which
 * falls back to terracotta for an id it does not know — a sensible default when
 * you need a shader to render, and the wrong one here, where it would quietly
 * label the file "haze". An unrecognised id drops the segment instead.
 *
 * The extension is now negotiated rather than assumed. A still is always a PNG;
 * a recording lands in whichever container the browser agreed to encode, so it
 * comes off the capture's own mimeType. Everything above is unchanged by that —
 * the sortable stamp is as load-bearing for a folder of clips as for a folder of
 * stills.
 *
 * On iOS Safari a blob URL for a video may open in a new tab rather than saving.
 * Nothing here can prevent that; it is worth knowing before it is filed as a
 * bug.
 */
export function downloadCapture(capture: Capture) {
  const date = new Date(capture.timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

  const shaderName = capture.shaderId ? SHADER_CONFIGS[capture.shaderId]?.name : undefined
  const parts = ["shader", shaderName ? slugify(shaderName) : "", stamp].filter(Boolean)
  const extension = capture.kind === "video" ? extensionFor(capture.mimeType) : "png"

  const link = document.createElement("a")
  link.href = capture.dataUrl
  link.download = `${parts.join("-")}.${extension}`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
