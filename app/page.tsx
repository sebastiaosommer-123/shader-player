"use client"

import { useState, useRef, type CSSProperties } from "react"
import { AnimatePresence } from "framer-motion"
import { ShaderCanvas, type ShaderCanvasRef } from "@/components/shader-canvas"
import { ControlsSidebar } from "@/components/controls-sidebar"
import { MobileNav } from "@/components/mobile-nav"
import { CaptureButton } from "@/components/capture-button"
import { CaptureThumbnails } from "@/components/capture-thumbnails"
import { WallpaperGallery } from "@/components/wallpaper-gallery"
import type { ShaderParams } from "@/lib/shader-uniforms"
import type { CapturedImage } from "@/lib/types"
import { captureCanvas } from "@/lib/canvas-capture"
import { CaptureAnimationOverlay } from "@/components/capture-animation-overlay"
import { calculateAnimationPositions } from "@/lib/animation-utils"
import type { Rect } from "@/lib/animation-utils"
import { getShaderConfig } from "@/lib/shader-configs"
import { useResizableSidebar } from "@/hooks/use-resizable-sidebar"

export default function Home() {
  const [shaderId, setShaderId] = useState<string>("terracotta")
  const { width: sidebarWidth, isResizing, startResize } = useResizableSidebar()
  const [params, setParams] = useState<ShaderParams>(getShaderConfig("terracotta").defaultParams)

  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
  const [clickedImageId, setClickedImageId] = useState<string | null>(null)
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null)
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
    const positions = calculateAnimationPositions(canvas, 0, isMobile)

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
    setCapturedImages((prev) => prev.filter((img) => img.id !== id))
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
    // --sidebar-width is published here so the sidebar and anything that has to
    // line up with it (the capture button) read one value; the canvas just takes
    // whatever flex-1 leaves over.
    <div
      className="h-screen w-screen flex flex-col md:flex-row overflow-hidden"
      style={{ height: "100dvh", "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
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
          onShaderChange={handleShaderChange}
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

      <CaptureButton onCapture={handleCapture} />

      <CaptureThumbnails
        images={capturedImages}
        onClick={handleThumbnailClick}
        isCapturing={!!captureAnimation}
        hiddenImageId={deletingImageId}
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
