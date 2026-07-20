"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () => (Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min, max]),
    [value, defaultValue, min, max],
  )

  const [isHovered, setIsHovered] = React.useState(false)
  const [activeThumbIndex, setActiveThumbIndex] = React.useState<number | null>(null)

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      data-hovered={isHovered}
      className="relative w-full cursor-grab active:cursor-grabbing"
    >
      <SliderPrimitive.Root
        data-slot="slider"
        defaultValue={defaultValue}
        value={value}
        min={min}
        max={max}
        className={cn(
          "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
          className,
        )}
        {...props}
      >
        <SliderPrimitive.Track
          data-slot="slider-track"
          className={
            "relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5 bg-primary-foreground"
          }
        >
          <SliderPrimitive.Range
            data-slot="slider-range"
            className={cn(
              "absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full bg-zinc-700 transition-colors duration-150",
              isHovered && "bg-zinc-500"
            )}
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            key={index}
            className="block shrink-0 disabled:pointer-events-none disabled:opacity-50 outline-none relative before:absolute before:inset-[-10px] before:content-['']"
            onPointerDown={() => setActiveThumbIndex(index)}
            onPointerUp={() => setActiveThumbIndex(null)}
            onPointerCancel={() => setActiveThumbIndex(null)}
          >
            <span
              style={{
                transform: activeThumbIndex === index ? 'scale(0.97)' : 'scale(1)'
              }}
              className={cn(
                "block h-4 w-2 rounded-full border-0 shadow-sm transition-[transform,background-color] duration-150 ease-out motion-reduce:transition-none",
                "bg-ring",
                isHovered && "bg-zinc-400"
              )}
            />
          </SliderPrimitive.Thumb>
        ))}
      </SliderPrimitive.Root>
    </div>
  )
}

export { Slider }
