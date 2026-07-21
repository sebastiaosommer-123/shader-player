"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import type { Rect } from "@/lib/animation-utils"
import { useReducedMotion } from "framer-motion"

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
  const prefersReducedMotion = useReducedMotion()

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
    }, prefersReducedMotion ? 180 : 550)

    return () => clearTimeout(timeout)
  }, [mounted, onComplete, prefersReducedMotion])

  if (!mounted) return null

  const scaleX = targetRect.width / sourceRect.width
  const scaleY = targetRect.height / sourceRect.height
  const translateX = targetRect.left - sourceRect.left + (targetRect.width - sourceRect.width) / 2
  const translateY = targetRect.top - sourceRect.top + (targetRect.height - sourceRect.height) / 2

  const shouldTravel = isAnimating && !prefersReducedMotion
  // Whatever the thumbnail actually is — a rounded rect on desktop, a circle in
  // the mobile bar — so the frame settles into its final shape rather than
  // popping at the end.
  const targetRadius = targetRect.radius ?? 8

  // The image scales UNIFORMLY and the crop is done by an animated clip-path.
  //
  // Scaling non-uniformly to fit the target rect directly would squash a
  // portrait canvas into a square thumbnail. Counter-scaling a nested element
  // fixes the endpoints but not the middle: two linearly-interpolated scales
  // multiply to a quadratic, so the aspect ratio still visibly wobbles in
  // flight. A single uniform scale can't distort at any frame, so the crop has
  // to come from somewhere else — clip-path, which also rounds the corners.
  const coverScale = Math.max(scaleX, scaleY)
  const insetX = Math.max(0, (sourceRect.width - targetRect.width / coverScale) / 2)
  const insetY = Math.max(0, (sourceRect.height - targetRect.height / coverScale) / 2)

  const animatedClip = shouldTravel
    ? `inset(${insetY}px ${insetX}px round ${targetRadius / coverScale}px)`
    : "inset(0px 0px round 0px)"
  const animatedTransform = shouldTravel
    ? `translate3d(${translateX}px, ${translateY}px, 0) scale(${coverScale})`
    : "translate3d(0, 0, 0) scale(1)"
  let transition = "none"
  if (isAnimating) {
    transition = prefersReducedMotion
      ? "opacity 150ms cubic-bezier(0.23, 1, 0.32, 1)"
      : "transform 500ms cubic-bezier(0.32, 0.72, 0, 1), opacity 500ms cubic-bezier(0.32, 0.72, 0, 1), clip-path 500ms cubic-bezier(0.32, 0.72, 0, 1)"
  }
  let animatedOpacity = 1
  if (isAnimating) animatedOpacity = prefersReducedMotion ? 0 : 0.98

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
          transform: animatedTransform,
          clipPath: animatedClip,
          WebkitClipPath: animatedClip,
          opacity: animatedOpacity,
          transition,
          boxShadow: isAnimating ? "0 10px 40px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)" : "none",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
          WebkitTransform: animatedTransform,
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
          }}
        />
      </div>
    </div>,
    document.body,
  )
}
