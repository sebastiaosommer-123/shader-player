"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type AnimationPlaybackControls,
  type MotionValue,
  type Transition,
} from "framer-motion"
import type { CapturedImage } from "@/lib/types"
import { cn } from "@/lib/utils"

interface GalleryThumbnailStripProps {
  images: CapturedImage[]
  currentIndex: number
  onSelect: (index: number) => void
  orientation: "horizontal" | "vertical"
}

/**
 * Peak magnification.
 *
 * Not a taste number, a fit. The rail is 128px wide and the frame's right edge
 * sits 16px inside it, so an 80px thumbnail growing leftward out of
 * `origin-right` has 112px before it reaches the rail's own left edge — and the
 * rail scrolls vertically, which forces the cross axis to clip rather than
 * overflow. 80 × 1.34 = 107.2, which still leaves room for the 2px focus ring
 * to land inside. The 1.48 this used to be put the left edge at −6px: the
 * biggest frame was always sliced off, so 1.48 was never the size on screen.
 */
const DESKTOP_MAX_SCALE = 1.34

/** How far the field reaches on either side of the cursor, in thumbnail pitches. */
const DESKTOP_SPREAD = 2.5

const DESKTOP_FALLBACK_HEIGHT = 56
const DESKTOP_FALLBACK_GAP = 8

const SELECTION_SPRING = { type: "spring", duration: 0.28, bounce: 0 } as const
/** The mobile strip's press. Unchanged from what it was. */
const PRESS_SPRING = { type: "spring", duration: 0.22, bounce: 0 } as const
/**
 * Carries the field in and out on enter/leave.
 *
 * The only thing here that springs. The cursor is already a continuous input, so
 * tracking is written straight through — springing the pointer would only put
 * the frames behind it. What does need easing is the field switching on and off,
 * which the cursor position cannot express.
 *
 * Driven imperatively rather than through `useSpring` so leaving mid-bloom can
 * stop the inbound animation and hand its velocity to the outbound one.
 */
const FIELD_SPRING = { type: "spring", duration: 0.22, bounce: 0 } as const

/**
 * Raised cosine, on normalised distance from the cursor.
 *
 * Both the value *and* the slope are zero at the far edge, which is the whole
 * reason to prefer it over the three-step lookup this replaced (or over a plain
 * cosine, whose slope at the edge is not zero). A frame entering the field
 * starts moving from a standstill, so there is no line down the rail where the
 * effect visibly switches on.
 */
const falloff = (distance: number) => (distance >= 1 ? 0 : (1 + Math.cos(Math.PI * distance)) / 2)

interface FrameValues {
  scale: MotionValue<number>
  y: MotionValue<number>
}

/**
 * The gallery's filmstrip.
 *
 * Desktop gets a restrained Dock magnification. The frame under the cursor
 * stays anchored while its neighbours move away by exactly the extra height the
 * scaled cards need, so the effect reads as a stack making room rather than as
 * thumbnails overlapping one another. Mobile is deliberately plain: there are no
 * hover handlers, transforms, or hover-only styles in that branch.
 *
 * The magnification is a continuous function of *where the cursor is*, not a
 * reaction to which thumbnail it entered, and that distinction is the entire
 * fix. Driving it from per-item `mouseenter` closed a loop: hit testing uses the
 * transformed box, so scaling and displacing the frames slid new elements under
 * a cursor that had not moved, which fired fresh enter events, which changed the
 * geometry again. The strip oscillated while standing still. Here the field is
 * computed from `offsetTop`/`offsetHeight` — layout values that our own
 * transforms cannot perturb, the same reason `use-proximity-hover` measures that
 * way — so there is no feedback path left to close.
 *
 * It also never re-renders while you track across it. The pointer position and
 * one 0→1 strength live in motion values; a single subscriber recomputes the
 * whole field in one O(n) pass and writes two motion values per frame, and React
 * sits it out entirely.
 */
export function GalleryThumbnailStrip({
  images,
  currentIndex,
  onSelect,
  orientation,
}: GalleryThumbnailStripProps) {
  const prefersReducedMotion = useReducedMotion()
  const scrollRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const valueRefs = useRef<(FrameValues | null)[]>([])
  const selectionTransition = prefersReducedMotion ? { duration: 0 } : SELECTION_SPRING
  const isVertical = orientation === "vertical"
  const displayedImages = isVertical ? [...images].reverse() : images

  // Refs are keyed by *display* index — the rail's own top-to-bottom order,
  // which is reversed on desktop so the newest capture sits at the top.
  const displayIndexOf = (imageIndex: number) =>
    isVertical ? images.length - 1 - imageIndex : imageIndex

  // Item centres in the scroller's content space, plus the frame height and the
  // centre-to-centre pitch, all measured rather than assumed.
  const geometryRef = useRef({
    centers: [] as number[],
    height: DESKTOP_FALLBACK_HEIGHT,
    pitch: DESKTOP_FALLBACK_HEIGHT + DESKTOP_FALLBACK_GAP,
  })
  const pointerRef = useRef(0)
  const clientYRef = useRef<number | null>(null)
  const activeRef = useRef(false)
  const scaleScratch = useRef<number[]>([])
  const spreadScratch = useRef<number[]>([])

  const strength = useMotionValue(0)
  const strengthAnimation = useRef<AnimationPlaybackControls | null>(null)

  const driveStrength = useCallback(
    (target: number) => {
      strengthAnimation.current?.stop()
      strengthAnimation.current = animate(strength, target, FIELD_SPRING)
    },
    [strength],
  )

  useEffect(() => () => strengthAnimation.current?.stop(), [])

  const registerNode = useCallback((displayIndex: number, node: HTMLButtonElement | null) => {
    itemRefs.current[displayIndex] = node
  }, [])

  const registerValues = useCallback((displayIndex: number, values: FrameValues | null) => {
    valueRefs.current[displayIndex] = values
  }, [])

  const measure = useCallback(() => {
    if (!isVertical) return
    const centers: number[] = []
    let height = DESKTOP_FALLBACK_HEIGHT

    for (let index = 0; index < itemRefs.current.length; index += 1) {
      const node = itemRefs.current[index]
      if (!node) continue
      // offsetTop, not getBoundingClientRect: these are layout values, immune to
      // the transforms this component is in the middle of applying.
      centers[index] = node.offsetTop + node.offsetHeight / 2
      height = node.offsetHeight
    }

    const pitch =
      centers.length > 1 && centers[0] !== undefined && centers[1] !== undefined
        ? centers[1] - centers[0]
        : height + DESKTOP_FALLBACK_GAP

    geometryRef.current = { centers, height, pitch }
  }, [isVertical])

  /**
   * One pass: scale every frame from its distance to the cursor, then place it.
   *
   * Placement is a prefix sum. Between neighbours i and i+1 the scaled cards need
   * `height × (scaleᵢ + scaleᵢ₊₁ − 2) / 2` of extra separation to keep the gap
   * they had, so the running total of that is where each frame's centre has to
   * end up. Subtracting the total *at the cursor* — interpolated across the pair
   * the cursor falls between, which is what keeps this continuous instead of
   * snapping at frame boundaries — pins the point under the cursor and lets the
   * strip open away from it in both directions.
   */
  const applyField = useCallback(() => {
    const { centers, height, pitch } = geometryRef.current
    const count = centers.length
    if (count === 0) return

    const amount = strength.get()
    const pointer = pointerRef.current
    const reach = pitch * DESKTOP_SPREAD

    const scales = scaleScratch.current
    scales.length = count
    for (let index = 0; index < count; index += 1) {
      const center = centers[index]
      scales[index] =
        center === undefined
          ? 1
          : 1 + (DESKTOP_MAX_SCALE - 1) * falloff(Math.abs(pointer - center) / reach) * amount
    }

    const spread = spreadScratch.current
    spread.length = count
    spread[0] = 0
    for (let index = 0; index < count - 1; index += 1) {
      spread[index + 1] =
        spread[index] + (height * (scales[index] + scales[index + 1] - 2)) / 2
    }

    const first = centers[0] ?? 0
    const position = Math.min(Math.max((pointer - first) / pitch, 0), count - 1)
    const pair = Math.min(Math.floor(position), Math.max(count - 2, 0))
    const within = position - pair
    const anchor =
      count > 1 ? spread[pair] + within * (spread[pair + 1] - spread[pair]) : 0

    for (let index = 0; index < count; index += 1) {
      const values = valueRefs.current[index]
      if (!values) continue
      values.scale.set(scales[index])
      values.y.set(spread[index] - anchor)
    }
  }, [strength])

  // The strength spring is what carries the field in and out; every frame of it
  // needs the whole field recomputed, since the scales it multiplies also drive
  // the displacement.
  useMotionValueEvent(strength, "change", applyField)

  const trackPointer = useCallback((clientY: number) => {
    const nav = scrollRef.current
    if (!nav) return
    const rect = nav.getBoundingClientRect()
    // Item centres are layout values while the cursor is in viewport space. If an
    // ancestor is scaled, the two spaces differ by exactly this ratio.
    const viewportScale = nav.offsetHeight > 0 ? rect.height / nav.offsetHeight : 1
    clientYRef.current = clientY
    pointerRef.current = (clientY - rect.top) / (viewportScale || 1) + nav.scrollTop
  }, [])

  const handlePointerMove = (event: React.PointerEvent) => {
    // The desktop/mobile split is a 768px width check, so a touchscreen laptop
    // lands on this rail. A tap should not magnify anything.
    if (event.pointerType !== "mouse") return
    trackPointer(event.clientY)
    if (!activeRef.current) {
      activeRef.current = true
      driveStrength(1)
    }
    applyField()
  }

  const releaseField = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    clientYRef.current = null
    driveStrength(0)
  }, [driveStrength])

  // Keyboard parity: focusing a frame puts the cursor at its centre.
  const focusField = (displayIndex: number) => {
    const center = geometryRef.current.centers[displayIndex]
    if (center === undefined) return
    pointerRef.current = center
    clientYRef.current = null
    if (!activeRef.current) {
      activeRef.current = true
      driveStrength(1)
    }
    applyField()
  }

  useEffect(() => {
    if (!isVertical || prefersReducedMotion) return
    // A delete leaves the registries longer than the strip. Positions are keyed
    // by display index, so trimming is all the compaction they need.
    itemRefs.current.length = images.length
    valueRefs.current.length = images.length
    measure()
    applyField()
  }, [applyField, images.length, isVertical, measure, prefersReducedMotion])

  useEffect(() => {
    const nav = scrollRef.current
    if (!nav || !isVertical || prefersReducedMotion) return

    // Selecting a frame smooth-scrolls the rail, which moves the frames past a
    // stationary cursor. That is a real change in proximity, so the field should
    // follow it rather than be suppressed — recompute from the last cursor
    // position on every scroll frame.
    const handleScroll = () => {
      if (!activeRef.current || clientYRef.current === null) return
      trackPointer(clientYRef.current)
      applyField()
    }
    nav.addEventListener("scroll", handleScroll, { passive: true })

    if (typeof ResizeObserver === "undefined") {
      return () => nav.removeEventListener("scroll", handleScroll)
    }

    let frame: number | null = null
    const observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        frame = null
        measure()
        applyField()
      })
    })
    observer.observe(nav)

    return () => {
      nav.removeEventListener("scroll", handleScroll)
      observer.disconnect()
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [applyField, isVertical, measure, prefersReducedMotion, trackPointer])

  useEffect(() => {
    const scroller = scrollRef.current
    const item = itemRefs.current[displayIndexOf(currentIndex)]
    if (!scroller || !item) return

    const itemCenter =
      orientation === "vertical"
        ? item.offsetTop + item.offsetHeight / 2
        : item.offsetLeft + item.offsetWidth / 2
    const viewportSize = orientation === "vertical" ? scroller.clientHeight : scroller.clientWidth
    const maxScroll =
      orientation === "vertical"
        ? scroller.scrollHeight - scroller.clientHeight
        : scroller.scrollWidth - scroller.clientWidth

    scroller.scrollTo({
      [orientation === "vertical" ? "top" : "left"]: Math.max(
        0,
        Math.min(itemCenter - viewportSize / 2, maxScroll),
      ),
      behavior: prefersReducedMotion ? "instant" : "smooth",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, images.length, orientation, prefersReducedMotion])

  return (
    <nav
      ref={scrollRef}
      aria-label="Captured images"
      className={cn(
        "pointer-events-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isVertical
          // `relative` makes the rail the offsetParent for every frame, so the
          // measured centres and the mapped cursor share one coordinate space
          // whatever the gallery wraps this in.
          ? "relative h-full w-32 overflow-x-hidden overflow-y-auto"
          : "w-full overflow-x-auto overflow-y-hidden px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2",
      )}
      onClick={(event) => event.stopPropagation()}
      onPointerMove={isVertical && !prefersReducedMotion ? handlePointerMove : undefined}
      onPointerLeave={isVertical && !prefersReducedMotion ? releaseField : undefined}
    >
      <div
        className={cn(
          "flex",
          isVertical
            // py-16 rather than py-10: the frames at the ends of a long strip are
            // pushed ~35px outward by the displacement, and a transform does not
            // extend scrollHeight, so anything past the padding is simply clipped.
            ? "min-h-full flex-col items-end justify-center gap-2 py-16 pl-12 pr-4"
            : "w-max min-w-full items-center justify-center gap-2 px-1",
        )}
      >
        {displayedImages.map((image, displayIndex) => {
          const imageIndex = isVertical ? images.length - 1 - displayIndex : displayIndex

          return (
            <GalleryThumbnailFrame
              key={image.id}
              image={image}
              displayIndex={displayIndex}
              label={`Show captured image ${imageIndex + 1} of ${images.length}`}
              selected={imageIndex === currentIndex}
              isVertical={isVertical}
              orientation={orientation}
              prefersReducedMotion={Boolean(prefersReducedMotion)}
              selectionTransition={selectionTransition}
              registerNode={registerNode}
              registerValues={registerValues}
              onSelect={() => onSelect(imageIndex)}
              onFocusFrame={focusField}
              onBlurFrame={releaseField}
            />
          )
        })}
      </div>
    </nav>
  )
}

interface GalleryThumbnailFrameProps {
  image: CapturedImage
  displayIndex: number
  label: string
  selected: boolean
  isVertical: boolean
  orientation: "horizontal" | "vertical"
  prefersReducedMotion: boolean
  selectionTransition: Transition
  registerNode: (displayIndex: number, node: HTMLButtonElement | null) => void
  registerValues: (displayIndex: number, values: FrameValues | null) => void
  onSelect: () => void
  onFocusFrame: (displayIndex: number) => void
  onBlurFrame: () => void
}

/**
 * One frame.
 *
 * It owns its two motion values rather than the strip owning an array of them,
 * because the count changes as captures come and go and `useMotionValue` cannot
 * be called a variable number of times. The strip writes to them through the
 * registry, which costs nothing and keeps the frame a real motion component — so
 * Framer's projection still knows about the scale when the selection ring morphs
 * from one frame to the next across it.
 */
function GalleryThumbnailFrame({
  image,
  displayIndex,
  label,
  selected,
  isVertical,
  orientation,
  prefersReducedMotion,
  selectionTransition,
  registerNode,
  registerValues,
  onSelect,
  onFocusFrame,
  onBlurFrame,
}: GalleryThumbnailFrameProps) {
  const scale = useMotionValue(1)
  const y = useMotionValue(0)

  useEffect(() => {
    if (!isVertical) return
    const values = { scale, y }
    registerValues(displayIndex, values)
    return () => registerValues(displayIndex, null)
  }, [displayIndex, isVertical, registerValues, scale, y])

  useEffect(() => {
    if (isVertical) return
    scale.set(1)
    y.set(0)
  }, [isVertical, scale, y])

  return (
    <motion.button
      ref={(node) => {
        registerNode(displayIndex, node)
        return () => registerNode(displayIndex, null)
      }}
      type="button"
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "group relative shrink-0 cursor-pointer border-2 p-0.5 outline-none",
        "focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50",
        "border-transparent",
        isVertical ? "h-14 w-20 origin-right" : "h-16 w-[5.75rem] rounded-[5px]",
      )}
      style={isVertical ? { scale, y } : undefined}
      // The press affordance stays on the horizontal strip's `scale` only
      // because nothing else is writing to it there. On the rail it lives on the
      // inner wrapper below instead: `whileTap` and the magnification both own
      // `scale`, and whichever landed last used to win.
      transition={prefersReducedMotion ? { duration: 0 } : PRESS_SPRING}
      whileTap={prefersReducedMotion || isVertical ? undefined : { scale: 0.97 }}
      onFocus={isVertical ? () => onFocusFrame(displayIndex) : undefined}
      onBlur={isVertical ? onBlurFrame : undefined}
      onClick={onSelect}
    >
      {selected && (
        <motion.div
          layoutId={`gallery-thumbnail-selection-${orientation}`}
          data-gallery-thumbnail-selection
          className="pointer-events-none absolute inset-0 z-10 border-2 border-foreground"
          style={{ borderRadius: isVertical ? 0 : 5 }}
          transition={selectionTransition}
        />
      )}
      <div
        className={cn(
          "size-full",
          isVertical &&
            "transition-transform duration-100 ease-out motion-safe:group-active:scale-[0.97]",
        )}
      >
        <img
          src={image.dataUrl || "/placeholder.svg"}
          alt=""
          className="block size-full rounded-[2px] object-cover"
          draggable={false}
        />
      </div>
    </motion.button>
  )
}
