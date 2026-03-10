"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Rect } from "@/lib/animation-utils"

interface CaptureAnimationOverlayProps {
  imageDataUrl: string
  sourceRect: Rect
  targetRect: Rect
  onComplete: () => void
}

export function CaptureAnimationOverlay({
  imageDataUrl,
  sourceRect,
  targetRect,
  onComplete,
}: CaptureAnimationOverlayProps) {
  const [mounted, setMounted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const element = animationRef.current
    if (!element) return

    element.getBoundingClientRect()
    
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setIsAnimating(true)
      })
    })

    const timeout = setTimeout(() => {
      onComplete()
    }, 550)

    return () => clearTimeout(timeout)
  }, [mounted, onComplete])

  if (!mounted) return null

  const scaleX = targetRect.width / sourceRect.width
  const scaleY = targetRect.height / sourceRect.height
  const translateX = targetRect.left - sourceRect.left + (targetRect.width - sourceRect.width) / 2
  const translateY = targetRect.top - sourceRect.top + (targetRect.height - sourceRect.height) / 2

  // When scaled down, we need a larger radius so it appears as 8px after scaling
  const targetRadius = 8
  const compensatedRadius = isAnimating ? targetRadius / Math.min(scaleX, scaleY) : 0

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        perspective: "1000px",
        pointerEvents: "none",
        zIndex: 9999,
        transformStyle: "preserve-3d",
        WebkitTransformStyle: "preserve-3d",
      }}
    >
      <div
        ref={animationRef}
        className="absolute overflow-hidden"
        style={{
          top: Math.round(sourceRect.top),
          left: Math.round(sourceRect.left),
          width: Math.round(sourceRect.width),
          height: Math.round(sourceRect.height),
          transform: isAnimating 
            ? `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})` 
            : "translate3d(0, 0, 0) scale(1)",
          borderRadius: `${compensatedRadius}px`,
          opacity: isAnimating ? 0.98 : 1,
          transition: isAnimating
            ? "transform 500ms cubic-bezier(0.32, 0.72, 0, 1), opacity 500ms cubic-bezier(0.32, 0.72, 0, 1), border-radius 500ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "none",
          boxShadow: isAnimating ? "0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)" : "none",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          WebkitTransform: isAnimating 
            ? `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})` 
            : "translate3d(0, 0, 0) scale(1)",
          transformStyle: "preserve-3d",
          WebkitTransformStyle: "preserve-3d",
          willChange: "transform",
        }}
      >
        <img
          src={imageDataUrl || "/placeholder.svg"}
          alt="Captured frame"
          className="w-full h-full object-cover"
          style={{
            display: "block",
            userSelect: "none",
            pointerEvents: "none",
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
            borderRadius: `${compensatedRadius}px`,
            transition: isAnimating
              ? "border-radius 500ms cubic-bezier(0.32, 0.72, 0, 1)"
              : "none",
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
