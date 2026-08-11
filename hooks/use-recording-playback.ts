"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { Capture } from "@/lib/types"

/**
 * How long the bar waits after the last sign of life before it goes.
 *
 * Carried across from the portfolio player this design comes from. Only ever
 * armed while the recording is actually playing — see `scheduleHide`.
 */
const HIDE_DELAY_MS = 2500

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

export interface RecordingPlayback {
  /** Callback ref for the `<video>`. See below for why it is not a RefObject. */
  attachVideo: (node: HTMLVideoElement | null) => void
  /** Callback ref for the element carrying `--played`. */
  attachProgress: (node: HTMLElement | null) => void
  playing: boolean
  toggle: () => void
  /** 0 → 1 along the clip. */
  seek: (fraction: number) => void
  currentSeconds: number
  durationSeconds: number
  controlsVisible: boolean
  registerActivity: () => void
  hideControls: () => void
  toggleControls: () => void
}

/**
 * Everything the controls bar needs to know about the recording it is sitting
 * under.
 *
 * The state is up here rather than inside either of them because the two are no
 * longer in the same subtree: the `<video>` lives inside the gallery's morph
 * card (see GalleryVideo for why it has to), and the bar lives in the chrome
 * layer alongside the close and delete buttons. The gallery owns this hook and
 * hands each half what it needs.
 *
 * It does not start playback. GalleryVideo still does that, on its own `ready`
 * gate, and still owns the fallback for an iOS device that refuses the autoplay
 * — that arrangement is load-bearing and has nothing to gain from moving. This
 * only ever reads the element's state and asks it for things.
 */
export function useRecordingPlayback(capture: Capture | undefined): RecordingPlayback {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const progressRef = useRef<HTMLElement | null>(null)
  const frameRef = useRef(0)
  const hideTimerRef = useRef<number | undefined>(undefined)
  // Read inside a timeout that fires long after the render that armed it, so it
  // has to be a ref rather than the state below.
  const playingRef = useRef(false)

  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentSeconds, setCurrentSeconds] = useState(0)
  const [metadataDuration, setMetadataDuration] = useState(0)
  const [controlsVisible, setControlsVisible] = useState(true)

  /**
   * The clip's length, and where it comes from is the one number worth writing
   * down.
   *
   * `capture.durationMs` first, and `video.duration` only when a capture arrives
   * without one. That ordering looks backwards — the element is holding the
   * actual media, after all — and it is not:
   *
   * 1. A MediaRecorder WebM reports `Infinity` until it has been seeked, which
   *    is the Firefox branch of `pickVideoFormat` and older Chrome. A scrubber
   *    divided by that is `NaN` for the whole clip.
   * 2. The element's number describes *frames that were encoded*, which is not
   *    the same thing as how long the shutter was held. Anything that starves
   *    the canvas of frames mid-recording — a backgrounded tab is the easy one
   *    to reproduce — leaves a blob whose duration is a fraction of the
   *    recording it came from.
   * 3. And `durationMs` is the number the filmstrip's CaptureBadge already
   *    shows. A player reading `0:00` under a thumbnail labelled `0:12` is the
   *    gallery contradicting itself about the same recording; whichever is
   *    closer to the media, they have to be one number. Same argument
   *    `stillUrl` makes for deriving rather than mirroring.
   *
   * Seeks are separately clamped to what the element says it can actually reach
   * — see `seek` — so a clip that really is short of its wall-clock length is
   * never asked for a position it does not have.
   */
  const durationSeconds = (capture?.durationMs ?? 0) / 1000 || metadataDuration

  /**
   * The fill and the thumb, written straight to the DOM.
   *
   * One custom property on the track, read by both — `scaleX(var(--played))` on
   * the fill and `translateX(calc(var(--played) * 100%))` on the layer carrying
   * the thumb. Transforms rather than a width and a `left`, for the reason plans
   * 002, 006 and 007 give: this is written on every animation frame, and a
   * property that costs layout is the wrong one to put on that path.
   *
   * Every frame, and not on `timeupdate`, because `timeupdate` fires about four
   * times a second — at scrubber width over a clip this short that is a fill
   * that visibly jumps rather than sweeps. React never sees any of it; only the
   * timecode is state, and only when the whole second turns over.
   */
  const writeProgress = useCallback((fraction: number) => {
    progressRef.current?.style.setProperty("--played", String(clamp01(fraction)))
  }, [])

  /**
   * A callback ref rather than a RefObject handed down, because the hook has to
   * know the *moment* the element arrives to wire its listeners to it. The video
   * is not mounted with the gallery — GalleryVideo returns null until the morph
   * has landed, and on the touch gallery it moves from slide to slide as you
   * swipe — so there is no single commit at which a ref object could be assumed
   * populated.
   */
  const attachVideo = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    setVideoElement(node)
  }, [])

  const attachProgress = useCallback(
    (node: HTMLElement | null) => {
      progressRef.current = node
      if (!node) return
      // The bar can mount into a clip that is already part-way through — a
      // capture stepped to while the previous one's controls were up. Seeding it
      // here saves a frame of a scrubber sitting at zero under a video that is
      // not.
      const video = videoRef.current
      writeProgress(video && durationSeconds > 0 ? video.currentTime / durationSeconds : 0)
    },
    [durationSeconds, writeProgress],
  )

  const scheduleHide = useCallback(() => {
    window.clearTimeout(hideTimerRef.current)
    hideTimerRef.current = window.setTimeout(() => {
      // A paused clip keeps its controls indefinitely. Nothing is moving, so
      // there is nothing for the bar to be in the way of, and the one thing you
      // are certainly about to do is press play again.
      if (playingRef.current) setControlsVisible(false)
    }, HIDE_DELAY_MS)
  }, [])

  const registerActivity = useCallback(() => {
    setControlsVisible(true)
    scheduleHide()
  }, [scheduleHide])

  const hideControls = useCallback(() => {
    if (!playingRef.current) return
    window.clearTimeout(hideTimerRef.current)
    setControlsVisible(false)
  }, [])

  const toggleControls = useCallback(() => {
    setControlsVisible((visible) => {
      if (visible) {
        window.clearTimeout(hideTimerRef.current)
        return false
      }
      scheduleHide()
      return true
    })
  }, [scheduleHide])

  useEffect(() => () => window.clearTimeout(hideTimerRef.current), [])

  const toggle = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    // `playing` is never set from here — it comes off the element's own events
    // below, so a refused `play()` leaves the button showing the truth rather
    // than the intention.
    if (video.paused) void video.play().catch(() => {})
    else video.pause()
  }, [])

  const seek = useCallback(
    (fraction: number) => {
      const clamped = clamp01(fraction)
      // Written before the element is touched so the fill tracks the finger even
      // if the seek itself takes a moment to land.
      writeProgress(clamped)
      registerActivity()

      const video = videoRef.current
      if (!video || durationSeconds <= 0) return
      // What the element will actually accept, which is not always the length
      // the recorder measured — see `durationSeconds` above. Asking for a
      // position past this is silently clamped by the browser anyway; asking
      // within it means `currentSeconds` below is the truth rather than the
      // request.
      const reach =
        video.seekable.length > 0
          ? video.seekable.end(video.seekable.length - 1)
          : durationSeconds
      // Held a hair short of the end: the clip loops, and a drag to the far
      // right that lands exactly on the duration restarts it from zero, which
      // reads as the scrubber refusing to go where it was put.
      const seconds = Math.min(clamped * durationSeconds, reach - 0.05)
      video.currentTime = Math.max(0, seconds)
      setCurrentSeconds(Math.floor(video.currentTime))
    },
    [durationSeconds, registerActivity, writeProgress],
  )

  /**
   * A different recording is a different clip, and none of the above is true of
   * it any more.
   *
   * The bar itself stays mounted across the step — it belongs to the gallery,
   * not to the capture — so without this the incoming recording arrives under a
   * scrubber left part-full by the one before it. The measured duration goes
   * too: it is read off the element, and the element is about to be replaced.
   *
   * Declared *above* the listener effect, and the order is load-bearing rather
   * than tidy. React runs a commit's effects in declaration order, so on the
   * mount where both run this has to clear the duration before the listeners
   * are wired and read the new one — the other way round, it wiped the value it
   * had just been given and the fallback never survived its first frame.
   */
  useEffect(() => {
    setCurrentSeconds(0)
    setMetadataDuration(0)
    writeProgress(0)
    setControlsVisible(true)
  }, [capture?.id, writeProgress])

  // Everything the element has to say. Re-wired whenever it is swapped, which on
  // the touch gallery is every swipe onto another recording.
  useEffect(() => {
    if (!videoElement) return

    const handlePlay = () => {
      playingRef.current = true
      setPlaying(true)
      registerActivity()
    }
    const handlePause = () => {
      playingRef.current = false
      setPlaying(false)
      setControlsVisible(true)
      window.clearTimeout(hideTimerRef.current)
    }
    const handleDuration = () => {
      const reported = videoElement.duration
      if (Number.isFinite(reported) && reported > 0) setMetadataDuration(reported)
    }

    videoElement.addEventListener("play", handlePlay)
    videoElement.addEventListener("pause", handlePause)
    videoElement.addEventListener("loadedmetadata", handleDuration)
    videoElement.addEventListener("durationchange", handleDuration)

    // The element may already be past any of these by the time we get here.
    handleDuration()
    if (!videoElement.paused) handlePlay()

    return () => {
      videoElement.removeEventListener("play", handlePlay)
      videoElement.removeEventListener("pause", handlePause)
      videoElement.removeEventListener("loadedmetadata", handleDuration)
      videoElement.removeEventListener("durationchange", handleDuration)
    }
  }, [registerActivity, videoElement])

  useEffect(() => {
    if (!playing) return

    const tick = () => {
      const video = videoRef.current
      if (video) {
        const seconds = video.currentTime
        writeProgress(durationSeconds > 0 ? seconds / durationSeconds : 0)
        const whole = Math.floor(seconds)
        setCurrentSeconds((previous) => (previous === whole ? previous : whole))
      }
      frameRef.current = requestAnimationFrame(tick)
    }

    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [durationSeconds, playing, writeProgress])

  return {
    attachVideo,
    attachProgress,
    playing,
    toggle,
    seek,
    currentSeconds,
    durationSeconds,
    controlsVisible,
    registerActivity,
    hideControls,
    toggleControls,
  }
}
