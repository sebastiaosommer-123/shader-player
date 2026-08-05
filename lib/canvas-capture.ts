import { encodePng } from "./png-encoder"
import { SHADER_CONFIGS } from "./shader-configs"

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
 */
export function downloadImage(dataUrl: string, timestamp: number, shaderId?: string) {
  const date = new Date(timestamp)
  const pad = (value: number) => String(value).padStart(2, "0")
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`

  const shaderName = shaderId ? SHADER_CONFIGS[shaderId]?.name : undefined
  const parts = ["shader", shaderName ? slugify(shaderName) : "", stamp].filter(Boolean)

  const link = document.createElement("a")
  link.href = dataUrl
  link.download = `${parts.join("-")}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
