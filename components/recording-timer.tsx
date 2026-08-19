"use client"

import { useEffect, useRef } from "react"
import { motion, useMotionValueEvent, useReducedMotion, type MotionValue } from "framer-motion"
import { spring } from "@/lib/springs"
import { formatDuration } from "@/lib/video-capture"

interface RecordingTimerProps {
  elapsedMs: MotionValue<number>
}

/**
 * The timecode, inside the viewfinder.
 *
 * Rendered as a sibling of CaptureFlash, inside the canvas wrapper rather than
 * over the page, because that is where this app puts capture feedback: the
 * chrome is the camera body and stays put; the frame is where things happen. It
 * is also simply where a camera puts a timecode.
 *
 * **It is not in the recording.** captureStream reads the canvas's own output
 * buffer, so DOM siblings — this, and the shutter flash — are invisible to the
 * encoder. Worth stating, because it looks like something that would be burnt
 * in, and the fix for that non-problem would be to move it out of the one place
 * it belongs.
 *
 * Space Mono comes from `*` in app/globals.css, and being monospaced the digits
 * already hold their column without tabular-nums.
 *
 * Centred on the window, not on the canvas — the same frame of reference
 * FloatingToolbar settled on, and for the same reason. The two are the only
 * floating chrome on screen for the whole of a recording, and centring this one
 * on the artwork left the timecode and the bar below it half a sidebar apart.
 */
export function RecordingTimer({ elapsedMs }: RecordingTimerProps) {
  const prefersReducedMotion = useReducedMotion()
  const readoutRef = useRef<HTMLSpanElement>(null)
  const secondsRef = useRef(-1)

  // One DOM write per second, and no re-renders at all: the value arrives as a
  // MotionValue precisely so that thirty updates a second do not become thirty
  // renders of the page and both control bars.
  useMotionValueEvent(elapsedMs, "change", (value) => {
    const seconds = Math.floor(value / 1000)
    if (seconds === secondsRef.current) return
    secondsRef.current = seconds
    if (readoutRef.current) readoutRef.current.textContent = formatDuration(value)
  })

  useEffect(() => {
    secondsRef.current = 0
    if (readoutRef.current) readoutRef.current.textContent = formatDuration(0)
  }, [])

  return (
    <motion.div
      role="timer"
      aria-live="off"
      className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-full bg-black/40 px-2.5 py-1.5 text-[13px] leading-none text-white backdrop-blur-sm"
      style={{
        top: "max(12px, env(safe-area-inset-top, 0px))",
        // Window centre, expressed from inside the canvas: this element's
        // containing block starts at the window's left edge in both layouts,
        // so 50vw lands on the middle of the window whatever the sidebar is
        // doing — no --sidebar-width to read, and it tracks a drag for free.
        // On mobile there is no sidebar, the canvas is the window, and this is
        // simply 50% again.
        //
        // The min() is the one case where the window's middle is not over the
        // artwork: a narrow desktop window with the sidebar dragged out wide
        // (below ~850px at the 400px maximum). The timecode stops at the
        // canvas's right edge rather than sliding under the clip — off the
        // window's centre, but a visible timecode beats an aligned half of one.
        // 36px is half the pill plus a margin; the pill's width is fixed,
        // since MAX_RECORDING_MS caps the readout at four characters. It moves
        // with the horizontal padding above — 26px of half-pill at px-2.5.
        left: "min(50vw, 100% - 36px)",
      }}
      initial={prefersReducedMotion ? false : { opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -2 }}
      transition={prefersReducedMotion ? { duration: 0 } : spring.moderate}
    >
      <span ref={readoutRef}>0:00</span>
    </motion.div>
  )
}
