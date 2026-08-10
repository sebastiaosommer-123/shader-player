export type CaptureKind = "image" | "video"

/**
 * One thing the shutter produced.
 *
 * Called `Capture` and not `CapturedImage` because it is no longer always an
 * image: in Video mode the shutter records the canvas and `dataUrl` is a WebM or
 * MP4 object URL instead of a PNG one. The fields below that are marked "videos
 * only" are the ones that arrangement needs.
 */
export interface Capture {
  id: string
  kind: CaptureKind
  /**
   * The artefact itself.
   *
   * For an image: the 128px preview data URL at first, swapped for a
   * full-resolution PNG object URL once the encoder has caught up — see
   * handleShutterPress in app/page.tsx.
   *
   * For a video: the recording's object URL, in whichever container the browser
   * agreed to (see `mimeType`).
   */
  dataUrl: string
  /**
   * Frame 0 as a still. **Videos only** — an image capture has no separate
   * poster because its `dataUrl` already is one, which is what `stillUrl` below
   * exists to paper over.
   *
   * Upgraded from a 128px preview to a full-resolution PNG on the same delay the
   * image path uses, because this is the picture the gallery morph carries to
   * full screen before the video fades in over it.
   */
  posterUrl?: string
  /** The container the browser negotiated. Videos only; drives the download's extension. */
  mimeType?: string
  /** Wall-clock length of the recording. Videos only. */
  durationMs?: number
  timestamp: number
  width: number
  height: number
  shaderId?: string
  params?: Record<string, number | string>
}

/**
 * What an `<img>` should show for this capture, whichever kind it is.
 *
 * Every still in the app — the toolbar thumbnail, the filmstrip frames, the
 * outgoing slot layer, the dismissal exit, the gallery's morph target — reads
 * the capture through here, so none of them has to know that videos exist.
 *
 * A derived accessor rather than a `posterUrl` populated for both kinds, and the
 * difference matters: `dataUrl` is swapped from the 128px preview to the
 * full-resolution encode after the fact, and a mirrored field would eventually
 * be left behind by an edit that forgot it — leaving the gallery showing a 128px
 * picture at full screen, which looks like a rendering bug rather than the state
 * bug it would be. One source of truth, and the call sites read no worse.
 */
export function stillUrl(capture: Capture): string {
  return capture.kind === "video" ? capture.posterUrl ?? "" : capture.dataUrl
}
