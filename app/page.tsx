"use client"

import { useState, useRef, type CSSProperties } from "react"
import { AnimatePresence } from "framer-motion"
import { ShaderCanvas, type ShaderCanvasRef } from "@/components/shader-canvas"
import { ControlsSidebar } from "@/components/controls-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { FloatingToolbar } from "@/components/floating-toolbar"
import { WallpaperGallery } from "@/components/wallpaper-gallery"
import { GalleryCloseFlight, type CloseFlight } from "@/components/gallery-close-flight"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { CapturedImage } from "@/lib/types"
import { encodeFullResolution, freezeFrame, previewDataUrl } from "@/lib/canvas-capture"
import { CaptureFlash } from "@/components/capture-flash"
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
  const { isResizing, startResize } = useResizableSidebar()
  const [params, setParams] = useState<ShaderParams>(getShaderConfig("terracotta").defaultParams)

  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [clickedImageId, setClickedImageId] = useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
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
    setCapturedImages((prev) => [
      ...prev,
      {
        id,
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
      setCapturedImages((prev) => prev.map((img) => (img.id === id ? { ...img, dataUrl: full } : img)))
    }, captureFlash.durationMs + 60)
  }

  const handleDeleteStart = (id: string) => {
    setDeletingImageId(id)
  }

  const handleDeleteImage = (id: string) => {
    // Nothing left to show closes the desktop slot again, which falls out of
    // hasSlot below rather than needing its own flag.
    const doomed = capturedImages.find((img) => img.id === id)
    setCapturedImages(capturedImages.filter((img) => img.id !== id))
    setDeletingImageId(null)

    // The full-resolution capture is a blob the browser keeps alive until its
    // URL is revoked. On a delay because this fires from the burn's completion,
    // and the burning <img> is still holding the src for the frame in which it
    // unmounts — revoking underneath it would break the last frame of the burn.
    if (doomed?.dataUrl.startsWith("blob:")) {
      const url = doomed.dataUrl
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }

  const handleGalleryClose = (flight?: CloseFlight) => {
    setIsGalleryOpen(false)
    setDeletingImageId(null)
    // One commit: the gallery's shared element goes out with its subtree and the
    // thumbnail leaves the layoutId stack at the same time, so the stack empties
    // rather than leaving a member behind to fly home on its own.
    if (flight) setCloseFlight(flight)
  }

  // The galleries lay their captures out in the order they were taken, so the
  // index the toolbar hands us is already the one they want — no flip on the
  // way in. See the ordering note in either gallery for why that direction.
  const handleThumbnailClick = (imageIndex: number) => {
    const clickedImage = capturedImages[imageIndex]
    if (!clickedImage) return
    // Opening again before the last close has landed: drop the flight so the
    // thumbnail is back in the layoutId stack for the morph it is about to lead.
    setCloseFlight(null)
    setClickedImageId(clickedImage.id)
    setSelectedImageIndex(imageIndex)
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
          <ShaderCanvas ref={shaderCanvasRef} params={params} shaderId={shaderId} isPaused={isGalleryOpen} />
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
        images={capturedImages}
        onThumbnailClick={handleThumbnailClick}
        hiddenImageId={deletingImageId}
        suppressMorph={!!closeFlight}
      />

      {/* Desktop's floating control bar. A sibling of the canvas, never a child:
          the canvas wrapper above is scoped `dark`, and this bar follows the
          page theme. */}
      <FloatingToolbar
        shaderId={shaderId}
        onShaderChange={handleShaderChange}
        onCapture={handleCapture}
        images={capturedImages}
        onThumbnailClick={handleThumbnailClick}
        hiddenImageId={deletingImageId}
        hasSlot={capturedImages.length > 0}
        suppressMorph={!!closeFlight}
      />

      <AnimatePresence>
        {isGalleryOpen && clickedImageId && (
          <WallpaperGallery
            key="gallery"
            images={capturedImages}
            onClose={handleGalleryClose}
            onDelete={handleDeleteImage}
            onDeleteStart={handleDeleteStart}
            initialIndex={selectedImageIndex}
            openedImageId={clickedImageId}
            isMobile={isMobile}
          />
        )}
      </AnimatePresence>

      {/* Outside the AnimatePresence above on purpose: the gallery is unmounted
          as soon as its backdrop has finished fading, a good 200ms before this
          lands, and its root drops below the control bars on the close frame. */}
      {closeFlight && (
        <GalleryCloseFlight
          key={closeFlight.image.id}
          flight={closeFlight}
          onComplete={() => setCloseFlight(null)}
        />
      )}
    </div>
  )
}
