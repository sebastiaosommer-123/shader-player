/**
 * The desktop floating toolbar's layout, in one place.
 *
 * These mirror Tailwind classes in components/floating-toolbar.tsx and are
 * lifted out of it because the slot's width is animated from JS rather than set
 * by a class — keep the two in step.
 */

/** Matches the capture ring, so the two ends of the bar balance. */
export const SLOT_SIZE = 48
/**
 * Half the box — a true circle, written as the real radius rather than a large
 * sentinel. The browser clamps an oversized value at paint, but Framer's layout
 * projection interpolates whatever number it is given: from 9999 the corner
 * stays an ellipse for almost the entire gallery morph.
 */
export const SLOT_RADIUS = SLOT_SIZE / 2
/** The bar's `gap-2`. */
export const BAR_GAP = 8
