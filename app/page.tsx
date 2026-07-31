"use client"

import { useState, useRef, type CSSProperties } from "react"
import { AnimatePresence } from "framer-motion"
import { ShaderCanvas, type ShaderCanvasRef } from "@/components/shader-canvas"
import { ControlsSidebar } from "@/components/controls-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { FloatingToolbar } from "@/components/floating-toolbar"
import { WallpaperGallery } from "@/components/wallpaper-gallery"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { CapturedImage } from "@/lib/types"
import { captureCanvas } from "@/lib/canvas-capture"
import { CaptureAnimationOverlay } from "@/components/capture-animation-overlay"
import { calculateAnimationPositions } from "@/lib/animation-utils"
import type { Rect } from "@/lib/animation-utils"
import { measureDesktopSlotRect } from "@/lib/toolbar-geometry"
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
  // The desktop toolbar's thumbnail slot is closed until the first capture, and
  // opens as the frame flies into it. Once open it stays until the last image is
  // deleted, at which point it closes again.
  const [slotReserved, setSlotReserved] = useState(false)
  const shaderCanvasRef = useRef<ShaderCanvasRef>(null)

  const [captureAnimation, setCaptureAnimation] = useState<{
    imageDataUrl: string
    sourceRect: Rect
    targetRect: Rect
    pendingImage: CapturedImage
  } | null>(null)

  const handleShaderChange = (newShaderId: string) => {
    console.log("[v0] Changing shader to:", newShaderId)
    setShaderId(newShaderId)
    const newConfig = getShaderConfig(newShaderId)
    setParams(newConfig.defaultParams)
  }

  const handleCapture = () => {
    const canvas = shaderCanvasRef.current?.getCanvas()
    if (!canvas) return

    const isMobile = window.innerWidth < 768
    const captured = captureCanvas({ canvas, params, isMobile })

    // Measure before opening the slot, not after. The desktop slot takes the
    // whole flight to widen, so from here until the frame lands its live rect is
    // mid-animation; measureDesktopSlotRect derives where it will come to rest
    // instead. Ordering matters — this has to read the layout that setSlotReserved
    // is about to change.
    const slotRect = isMobile ? null : measureDesktopSlotRect()
    const positions = calculateAnimationPositions(canvas, 0, isMobile, slotRect)
    setSlotReserved(true)

    const newImage: CapturedImage = {
      id: `${Date.now()}-${Math.random()}`,
      dataUrl: captured.dataUrl,
      timestamp: captured.timestamp,
      width: captured.width,
      height: captured.height,
      params: captured.params,
      shaderId: shaderId,
    }

    setCaptureAnimation({
      imageDataUrl: captured.dataUrl,
      sourceRect: positions.source,
      targetRect: positions.target,
      pendingImage: newImage,
    })
  }

  const handleDeleteStart = (id: string) => {
    setDeletingImageId(id)
  }

  const handleDeleteImage = (id: string) => {
    const remaining = capturedImages.filter((img) => img.id !== id)
    setCapturedImages(remaining)
    // Nothing left to show: let the toolbar shrink back to its resting width.
    if (remaining.length === 0) setSlotReserved(false)
    setDeletingImageId(null)
  }

  const handleGalleryClose = () => {
    setIsGalleryOpen(false)
    setDeletingImageId(null)
  }

  const handleThumbnailClick = (imageIndex: number) => {
    const clickedImage = capturedImages[imageIndex]
    if (!clickedImage) return
    setClickedImageId(clickedImage.id)
    const reversedIndex = capturedImages.length - 1 - imageIndex
    setSelectedImageIndex(reversedIndex)
    setIsGalleryOpen(true)
  }

  const handleAnimationComplete = () => {
    if (captureAnimation) {
      setCapturedImages((prev) => [...prev, captureAnimation.pendingImage])
    }
    setCaptureAnimation(null)
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
        isCapturing={!!captureAnimation}
        hiddenImageId={deletingImageId}
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
        isCapturing={!!captureAnimation}
        hiddenImageId={deletingImageId}
        hasSlot={slotReserved || capturedImages.length > 0}
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

      {captureAnimation && (
        <CaptureAnimationOverlay
          imageDataUrl={captureAnimation.imageDataUrl}
          sourceRect={captureAnimation.sourceRect}
          targetRect={captureAnimation.targetRect}
          onComplete={handleAnimationComplete}
        />
      )}
    </div>
  )
}
