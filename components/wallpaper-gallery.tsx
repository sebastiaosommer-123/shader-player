"use client"

import { useState } from "react"
import type { CapturedImage } from "@/lib/types"
import type { CloseFlight } from "@/components/gallery-close-flight"
import { WallpaperGalleryDesktop } from "@/components/wallpaper-gallery-desktop"
import { WallpaperGalleryMobile } from "@/components/wallpaper-gallery-mobile"

interface WallpaperGalleryProps {
  images: CapturedImage[]
  /**
   * The flight is only handed over when the capture on screen is not the one the
   * shared element is bound to — see GalleryCloseFlight. Every other way out
   * (deleting the last capture, the list emptying) closes bare and keeps the
   * morph.
   */
  onClose: (flight?: CloseFlight) => void
  onDelete: (id: string) => void
  initialIndex?: number
  openedImageId: string
  isMobile: boolean
}

/**
 * Two galleries, picked once.
 *
 * Touch gets the snapped carousel with the scroll-driven parallax, which only
 * pays off when a finger is dragging the scroller directly. Pointer devices keep
 * the arrow-stepped viewer they always had — a trackpad has nothing to give the
 * view timeline, so the parallax there was motion nobody asked for.
 *
 * `isMobile` is a prop rather than a hook call because useIsMobile resolves to
 * false on its first render and only corrects itself in an effect. This
 * component mounts at the moment the gallery opens, so reading it here would
 * mount the desktop viewer on a phone and then swap implementations a frame
 * later — remounting the shared element mid-morph. The page has had the real
 * answer since load; it just has to hand it down.
 */
export function WallpaperGallery({ isMobile, ...props }: WallpaperGalleryProps) {
  // Frozen for the life of the gallery. Rotating a phone or dragging a window
  // across the breakpoint mid-session would otherwise tear down the open
  // gallery and rebuild it as the other one, losing the scroll position and the
  // morph along with it.
  const [useMobileGallery] = useState(isMobile)

  return useMobileGallery ? <WallpaperGalleryMobile {...props} /> : <WallpaperGalleryDesktop {...props} />
}
