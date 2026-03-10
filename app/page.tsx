"use client"

import { useState, useRef } from "react"
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

export default function Home() {
  const [shaderId, setShaderId] = useState<string>('terracotta')
  const [params, setParams] = useState<ShaderParams>(getShaderConfig('terracotta').defaultParams)

  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([])
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [selectedImageIndex, setSelectedImageIndex] = useState(0)
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
    setDeletingImageId(null) // Reset optimistic delete if cancelled/closed
  }

  const handleThumbnailClick = (imageIndex: number) => {
    // Gallery reverses images to show newest first, so we need to convert the index
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
    <div className="h-screen w-screen flex flex-col md:flex-row overflow-hidden">
      {/* Shader Canvas */}
      <div className="flex-1 relative">
        <ShaderCanvas ref={shaderCanvasRef} params={params} shaderId={shaderId} />
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ControlsSidebar 
          params={params} 
          setParams={setParams} 
          shaderId={shaderId}
          onShaderChange={handleShaderChange}
        />
      </div>

      <MobileNav 
        onCapture={handleCapture} 
        params={params} 
        setParams={setParams}
        shaderId={shaderId}
        onShaderChange={handleShaderChange}
      />

      <CaptureButton onCapture={handleCapture} />

      <CaptureThumbnails 
        images={capturedImages} 
        onClick={handleThumbnailClick} 
        isCapturing={!!captureAnimation}
        hiddenImageId={deletingImageId}
      />
      <WallpaperGallery
        images={capturedImages}
        isOpen={isGalleryOpen}
        onClose={handleGalleryClose}
        onDelete={handleDeleteImage}
        onDeleteStart={handleDeleteStart}
        initialIndex={selectedImageIndex}
      />

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
