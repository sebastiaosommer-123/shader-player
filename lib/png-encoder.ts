/**
 * PNG encoding, kept off the main thread.
 *
 * A full-resolution capture is around four megapixels, and encoding one costs
 * ~145ms of CPU. Chrome already does that work on a background thread, so on a
 * desktop it never shows; a phone has fewer cores to hide it behind, and the
 * shader is animating the whole time — any main-thread stall lands as a visible
 * hitch a beat after the shutter.
 *
 * So the pixels are handed to a worker as an ImageBitmap, which transfers rather
 * than copies, and the encode happens somewhere it cannot stutter anything.
 *
 * Everything here degrades to the old behaviour rather than failing: a browser
 * without OffscreenCanvas, a worker that will not start, an encode that throws —
 * each falls through to canvas.toBlob on the main thread, which is exactly what
 * this module replaced.
 */

/**
 * Built from a blob rather than a separate module file on purpose: it keeps the
 * worker out of the bundler's hands entirely, so there is no build
 * configuration that can be right in development and wrong in production.
 */
const WORKER_SOURCE = `
self.onmessage = async (event) => {
  const { id, bitmap } = event.data
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    context.drawImage(bitmap, 0, 0)
    bitmap.close()
    const blob = await canvas.convertToBlob({ type: 'image/png' })
    self.postMessage({ id, blob })
  } catch (error) {
    self.postMessage({ id, blob: null })
  }
}
`

/** undefined until first asked for; null once known to be unavailable. */
let encoder: Worker | null | undefined
let nextRequestId = 1
const pending = new Map<number, (blob: Blob | null) => void>()

function isSupported() {
  return (
    typeof Worker !== "undefined" &&
    typeof OffscreenCanvas !== "undefined" &&
    typeof createImageBitmap === "function" &&
    typeof OffscreenCanvas.prototype.convertToBlob === "function"
  )
}

function getEncoder(): Worker | null {
  if (encoder !== undefined) return encoder
  encoder = null
  if (!isSupported()) return encoder
  try {
    // The URL is deliberately not revoked. It is one object URL for the life of
    // the page, and revoking it immediately after construction is the kind of
    // thing that works in every browser until it doesn't.
    const worker = new Worker(URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" })))
    worker.onmessage = (event: MessageEvent<{ id: number; blob: Blob | null }>) => {
      const { id, blob } = event.data
      pending.get(id)?.(blob ?? null)
      pending.delete(id)
    }
    // A worker that dies takes its outstanding encodes with it; resolving them
    // null puts every caller on the main-thread path rather than leaving them
    // awaiting a promise that will never settle.
    worker.onerror = () => {
      pending.forEach((resolve) => resolve(null))
      pending.clear()
      encoder = null
    }
    encoder = worker
  } catch {
    encoder = null
  }
  return encoder
}

/** The main-thread encode this module exists to avoid. Also the safety net. */
function encodeHere(source: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => source.toBlob((blob) => resolve(blob), "image/png"))
}

/**
 * Starts the worker before anything needs it.
 *
 * Spawning the thread and building its JS context costs a tenth of a second of
 * system work that contends with the main thread — measured as a 140ms hitch on
 * the *first* capture of a session, which is the worst possible place for it.
 * Paid at idle instead, it lands while the page is settling and no one has asked
 * for anything.
 *
 * The one-pixel encode is the point of it: constructing the worker is
 * sub-millisecond, and it is walking the encode path for the first time that
 * costs.
 */
export function warmPngEncoder() {
  if (!getEncoder()) return
  const canvas = document.createElement("canvas")
  canvas.width = 1
  canvas.height = 1
  void encodePng(canvas)
}

export async function encodePng(source: HTMLCanvasElement): Promise<Blob | null> {
  const worker = getEncoder()
  if (!worker) return encodeHere(source)

  try {
    const bitmap = await createImageBitmap(source)
    const id = nextRequestId++
    const blob = await new Promise<Blob | null>((resolve) => {
      pending.set(id, resolve)
      worker.postMessage({ id, bitmap }, [bitmap])
    })
    if (blob) return blob
  } catch {
    // Falls through — a capture that cannot be encoded off-thread is still
    // better encoded than lost.
  }
  return encodeHere(source)
}
