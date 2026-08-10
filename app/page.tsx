"use client"

import { useState, useRef, useEffect, type CSSProperties } from "react"
import { AnimatePresence, useReducedMotion } from "framer-motion"
import { ShaderCanvas, type ShaderCanvasRef } from "@/components/shader-canvas"
import { ControlsSidebar } from "@/components/controls-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { FloatingToolbar } from "@/components/floating-toolbar"
import { WallpaperGallery } from "@/components/wallpaper-gallery"
import { GalleryCloseFlight, type CloseFlight } from "@/components/gallery-close-flight"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { Capture } from "@/lib/types"
import { encodeFullResolution, freezeFrame, previewDataUrl } from "@/lib/canvas-capture"
import { warmPngEncoder } from "@/lib/png-encoder"
import { CaptureDismissal } from "@/components/capture-dismissal"
import { CaptureFlash } from "@/components/capture-flash"
import { Toaster } from "@/components/ui/sonner"
import { captureFlash } from "@/lib/springs"
import { getShaderConfig } from "@/lib/shader-configs"
import { useResizableSidebar } from "@/hooks/use-resizable-sidebar"
import { useIsMobile } from "@/hooks/use-mobile"
import { cn } from "@/lib/utils"

export default function Home() {
  const [shaderId, setShaderId] = useState<string>("terracotta")
  // Mobile is dark-only, so the palette is pinned at the root rather than
  // scoped piecemeal below it. See the note on the container's className.
  const isMobile = useIsMobile()
  const prefersReducedMotion = useReducedMotion()
  const { isResizing, startResize } = useResizableSidebar()
  const [params, setParams] = useState<ShaderParams>(getShaderConfig("terracotta").defaultParams)

  const [captures, setCaptures] = useState<Capture[]>([])
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [clickedCaptureId, setClickedCaptureId] = useState<string | null>(null)
  // Set when the gallery is dismissed from a capture other than the one it was
  // opened on, which is the one the thumbnail is showing. The shared-element
  // morph cannot draw that — see GalleryCloseFlight — so it is stood down for as
  // long as this is here, and the flight collapses the capture instead.
  const [closeFlight, setCloseFlight] = useState<CloseFlight | null>(null)
  const shaderCanvasRef = useRef<ShaderCanvasRef>(null)

  // Bumped on every capture. The flash element is keyed off this, so each press
  // remounts it and gets its own animation from the start — a counter rather
  // than a boolean because two captures in quick succession must not collapse
  // into one blink.
  const [flashKey, setFlashKey] = useState(0)

  // The encoder's thread costs about a tenth of a second to start, and it is
  // started by whatever asks it for the first PNG — which, left alone, is the
  // first capture of the session. Paid here instead, while the page is settling.
  useEffect(() => {
    if (typeof window.requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(() => warmPngEncoder(), { timeout: 2000 })
      return () => window.cancelIdleCallback(handle)
    }
    const timer = window.setTimeout(warmPngEncoder, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  // Every reason the canvas stops, in one place. The canvas itself used to OR
  // reduced motion in privately, which meant no caller could see the whole
  // answer; it is derived here now because this is the only component that knows
  // all the terms.
  const isFrozen = isGalleryOpen || Boolean(prefersReducedMotion)

  const handleShaderChange = (newShaderId: string) => {
    console.log("[v0] Changing shader to:", newShaderId)
    setShaderId(newShaderId)
    const newConfig = getShaderConfig(newShaderId)
    setParams(newConfig.defaultParams)
  }

  const handleCapture = () => {
    const canvas = shaderCanvasRef.current?.getCanvas()
    if (!canvas) return

    // Nothing on the click path may encode.
    //
    // The full-resolution PNG costs 70–94ms of main-thread work, and every
    // arrangement of *when* to pay it is wrong: before the flash it delays the
    // response past the point where it reads as instant; during the flash it
    // freezes the animation mid-blink; and gating the toolbar on it is what made
    // the slot start widening after the flash had already finished.
    //
    // So the click path does two cheap things — a GPU blit to freeze the frame,
    // and a 128px JPEG of it — and the capture enters state immediately. The
    // flash, the slot and the thumbnail all begin on the same frame off the same
    // commit, which is the choreography this wants. Nothing at 48px can tell the
    // difference between the preview and the real thing.
    const frozen = freezeFrame(canvas)
    if (!frozen) return

    const id = `${Date.now()}-${Math.random()}`
    setCaptures((prev) => [
      ...prev,
      {
        id,
        kind: "image",
        dataUrl: previewDataUrl(frozen),
        timestamp: Date.now(),
        // The frozen frame's real dimensions, not the preview's. The thumbnail's
        // cover box and the gallery's letterboxing are both computed from these,
        // and the preview shares the aspect ratio, so neither has to wait.
        width: frozen.width,
        height: frozen.height,
        params: { ...params },
        shaderId: shaderId,
      },
    ])
    setFlashKey((k) => k + 1)

    // The real capture, once everything has stopped moving. Held rather than
    // fired immediately because toBlob still has to hand the result back to this
    // thread, and the flash is the last thing that should be interrupted.
    window.setTimeout(async () => {
      const full = await encodeFullResolution(frozen)
      if (!full) return
      // Decode before swapping the src, or the <img> goes blank for a frame
      // while the browser reads a 7MB PNG. A failed decode just means we keep
      // the preview, which is still a correct picture.
      try {
        const probe = new Image()
        probe.src = full
        await probe.decode()
      } catch {
        return
      }
      setCaptures((prev) => prev.map((c) => (c.id === id ? { ...c, dataUrl: full } : c)))
    }, captureFlash.durationMs + 60)
  }

  const handleDeleteCapture = (id: string) => {
    // Nothing left to show closes the desktop slot again, which falls out of
    // hasSlot below rather than needing its own flag.
    const doomed = captures.find((c) => c.id === id)
    setCaptures(captures.filter((c) => c.id !== id))

    // The full-resolution capture is a blob the browser keeps alive until its
    // URL is revoked. On a delay because this now fires on the press frame,
    // with the evaporation of this very capture about to start — the effect
    // already holds its pixels as a texture, but a still-unfinished prepare
    // would be reading from this URL, and the outgoing <img> holds it for the
    // frame in which it unmounts.
    if (doomed?.dataUrl.startsWith("blob:")) {
      const url = doomed.dataUrl
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  const handleGalleryClose = (flight?: CloseFlight) => {
    setIsGalleryOpen(false)
    // One commit: the gallery's shared element goes out with its subtree and the
    // thumbnail leaves the layoutId stack at the same time, so the stack empties
    // rather than leaving a member behind to fly home on its own.
    if (flight) setCloseFlight(flight)
  }

  // The galleries lay their captures out in the order they were taken, so the
  // index the toolbar hands us is already the one they want — no flip on the
  // way in. See the ordering note in either gallery for why that direction.
  const handleThumbnailClick = (captureIndex: number) => {
    const clicked = captures[captureIndex]
    if (!clicked) return
    // Opening again before the last close has landed: drop the flight so the
    // thumbnail is back in the layoutId stack for the morph it is about to lead.
    setCloseFlight(null)
    setClickedCaptureId(clicked.id)
    setSelectedIndex(captureIndex)
    setIsGalleryOpen(true)
  }

  return (
    // h-screen (100vh) is the *large* viewport on iOS: it ignores Safari's
    // toolbar, so the control bar ends up underneath it. 100dvh tracks the
    // viewport that is actually visible. Kept as an inline override rather than
    // a class swap so browsers without dvh drop the declaration and fall back
    // to h-screen instead of collapsing.
    //
    // --sidebar-width is deliberately not set here. The server cannot know the
    // stored width, so emitting it would paint the default and then correct
    // itself — and an inline value on this element would also outrank the one
    // the boot script has already put on the document. It lives on the document
    // element instead, seeded pre-paint and maintained by useResizableSidebar;
    // the canvas just takes whatever flex-1 leaves over.
    <div
      // `dark` on the root below md, which is the one place it can go and cover
      // everything: mobile has no light mode at all. The bar, the sheet and the
      // canvas already pinned themselves dark individually, but that left every
      // root-level sibling following the page theme — the wallpaper gallery
      // most visibly, since it is `fixed inset-0 bg-background` and opens from
      // the capture thumbnail. Pinning here catches those, and catches anything
      // added at this level later.
      //
      // The objection that once kept `dark` off this container — that it would
      // drag the desktop sidebar in with it — doesn't apply, because the class
      // is only ever present at widths where the sidebar is display:none.
      //
      // This overrides the rendered palette, not the stored preference: a theme
      // chosen on desktop is still there on return.
      className={cn("h-screen w-screen flex flex-col md:flex-row overflow-hidden", isMobile && "dark")}
      style={{ height: "100dvh" } as CSSProperties}
    >
      {/* Shader Canvas.
          Two elements on purpose: the rounded corners reveal whatever is painted
          *behind* the clipped wrapper, so the surround carries the colour. `dark`
          scopes the dark palette here alone — it cannot go on the outer flex
          container without dragging the desktop sidebar into it too. Transparent
          from md up, where the canvas is square and fills its box. */}
      <div className="dark flex-1 min-h-0 bg-background md:bg-transparent">
        {/* overflow-hidden is what actually clips the canvas: the radius sits on
            this wrapper, not on the <canvas> itself. */}
        <div className="relative h-full w-full overflow-hidden rounded-[12px] md:rounded-none">
          <ShaderCanvas ref={shaderCanvasRef} params={params} shaderId={shaderId} isFrozen={isFrozen} />
          {/* In here rather than over the whole page, so the blink is the
              viewfinder's and not the app's: the chrome is the camera body and
              stays put. Being inside the clip also gets it the artwork's exact
              rounded corners for free. */}
          {flashKey > 0 && <CaptureFlash key={flashKey} isMobile={isMobile} />}
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ControlsSidebar
          params={params}
          setParams={setParams}
          shaderId={shaderId}
          onResizeStart={startResize}
          isResizing={isResizing}
        />
      </div>

      <MobileNav
        onCapture={handleCapture}
        params={params}
        setParams={setParams}
        shaderId={shaderId}
        onShaderChange={handleShaderChange}
        captures={captures}
        onThumbnailClick={handleThumbnailClick}
        suppressMorph={!!closeFlight}
      />

      {/* Desktop's floating control bar. A sibling of the canvas, never a child:
          the canvas wrapper above is scoped `dark`, and this bar follows the
          page theme. */}
      <FloatingToolbar
        shaderId={shaderId}
        onShaderChange={handleShaderChange}
        onCapture={handleCapture}
        captures={captures}
        onThumbnailClick={handleThumbnailClick}
        hasSlot={captures.length > 0}
        suppressMorph={!!closeFlight}
      />

      <AnimatePresence>
        {isGalleryOpen && clickedCaptureId && (
          <WallpaperGallery
            key="gallery"
            captures={captures}
            onClose={handleGalleryClose}
            onDelete={handleDeleteCapture}
            initialIndex={selectedIndex}
            openedCaptureId={clickedCaptureId}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>

      {/* Where a deleted capture's exit draws. At the root rather than inside
          the gallery because deleting the last capture closes the gallery on the
          press frame, and the outgoing frame has to outlive that unmount. */}
      <CaptureDismissal />

      {/* Bottom-centre, where this app's chrome lives — the toolbar and the
          mobile bar are both down there, so a message arriving at the bottom
          reads as part of the same furniture rather than as something the
          browser did. The toolbar is not a conflict in practice: the only thing
          that raises a toast is the download, and the gallery is over the top of
          the toolbar whenever that is reachable. The offset clears the home
          indicator, since the gallery is edge to edge.

          Inside this container rather than in the layout, and that is the whole
          reason it moved here. Sonner renders where it is placed, and at the
          layout it landed as a sibling of this div — outside the `dark` pinned
          on it above. Mobile is dark whatever the page theme says, so a phone on
          a light system theme resolved --surface-3 to #252525 for every other
          surface and #fff for the toast. Same subtree, same tokens. */}
      <Toaster
        position="bottom-center"
        duration={2500}
        offset="max(1.25rem, calc(env(safe-area-inset-bottom) + 0.75rem))"
      />

      {/* Outside the AnimatePresence above on purpose: the gallery is unmounted
          as soon as its backdrop has finished fading, a good 200ms before this
          lands, and its root drops below the control bars on the close frame. */}
      {closeFlight && (
        <GalleryCloseFlight
          key={closeFlight.capture.id}
          flight={closeFlight}
          onComplete={() => setCloseFlight(null)}
        />
      )}
    </div>
  )
}
