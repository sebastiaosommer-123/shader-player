"use client"

import { SegmentedTabs } from "./segmented-tabs"

export type CaptureMode = "image" | "video"

/**
 * "Image", not "Photo".
 *
 * A photo is *of* something — the word points at a subject that existed in front
 * of a lens. Nothing here has one: the shader generates rather than records, so
 * "Photo" would be claiming a provenance the artwork does not have. "Image" is
 * also already this app's own noun, in the type, the PNG and the gallery.
 */
const MODES = [
  { id: "image", label: "Image" },
  { id: "video", label: "Video" },
] as const

interface ModeTabsProps {
  mode: CaptureMode
  onModeChange: (mode: CaptureMode) => void
  layoutIdPrefix: string
  size?: "desktop" | "mobile"
  /** Inert mid-recording: switching to Image would freeze the canvas mid-clip. */
  disabled?: boolean
}

/**
 * What the shutter produces, and — as a consequence rather than a side effect —
 * whether the shader is running.
 *
 * Image mode drops the frame rate to zero. That is the feature: a frozen canvas
 * is a composable one, so you can tune the sliders against a fixed frame instead
 * of a moving target. Flipping Video → Image is therefore also how you choose
 * your moment — watch it move, hold it when you like the frame.
 *
 * Sits next to the shutter in both bars, because it is the shutter's meaning
 * that it changes. The shader picker sits next to the artwork, for the same
 * reason in reverse.
 */
export function ModeTabs({
  mode,
  onModeChange,
  layoutIdPrefix,
  size = "desktop",
  disabled = false,
}: ModeTabsProps) {
  return (
    <SegmentedTabs
      options={MODES.map((m) => ({ ...m }))}
      value={mode}
      onChange={(id) => onModeChange(id as CaptureMode)}
      ariaLabel="Capture mode"
      layoutIdPrefix={layoutIdPrefix}
      layoutIdSuffix="mode-tab"
      size={size}
      disabled={disabled}
    />
  )
}
