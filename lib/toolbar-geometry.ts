/**
 * The desktop floating toolbar's layout, in one place.
 *
 * These mirror Tailwind classes in components/floating-toolbar.tsx and are
 * lifted out of it because the slot's width is animated from JS rather than set
 * by a class — keep the two in step.
 */

/**
 * Matches the capture ring, so the two ends of the bar balance — and the tab
 * tracks between them, which are 44 for the same reason. This is the bar's one
 * unit; the bar is content-sized, so whichever of the three is tallest sets its
 * height and the others float. See SIZES in components/segmented-tabs.tsx.
 */
export const SLOT_SIZE = 44
/**
 * Half the box — a true circle, written as the real radius rather than a large
 * sentinel. The browser clamps an oversized value at paint, but Framer's layout
 * projection interpolates whatever number it is given: from 9999 the corner
 * stays an ellipse for almost the entire gallery morph.
 */
export const SLOT_RADIUS = SLOT_SIZE / 2
/** The bar's `gap-2`. */
export const BAR_GAP = 8
