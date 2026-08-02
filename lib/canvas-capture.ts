import type { ShaderParams } from "./shader-uniforms"

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
 * toBlob rather than toDataURL on purpose. toDataURL is synchronous and pins the
 * main thread for the whole encode, so a rapid second capture's flash would
 * stall on the first one's PNG whenever the two overlapped. It also hands back
 * base64 — a third larger than the bytes, held in React state as a string, for
 * every capture in the session. A blob keeps the binary once.
 *
 * The URL has to be revoked when its image is deleted; see handleDeleteImage.
 */
export function encodeFullResolution(frozen: HTMLCanvasElement): Promise<string | null> {
  return new Promise((resolve) => {
    frozen.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null), "image/png")
  })
}

export function downloadImage(dataUrl: string, params: ShaderParams, timestamp: number, shaderId?: string) {
  const link = document.createElement("a")
  const date = new Date(timestamp)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12 // 0 should be 12
  const dateString = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}${ampm}`

  link.href = dataUrl
  link.download = `shader-capture-${dateString}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
