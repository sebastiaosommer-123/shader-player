"use client"

import { SliderComfortable } from "@/components/ui/slider"
import { useEffect, useRef } from "react"
import { startSliderSound, updateSliderSound, stopSliderSound } from "@/lib/slider-audio"

interface ParameterSliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}

export function ParameterSlider({ label, value, min, max, step, onChange }: ParameterSliderProps) {
  const isDraggingRef = useRef(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleValueChange = (newValue: number) => {
    onChange(newValue)

    if (isDraggingRef.current) {
      const normalizedValue = (newValue - min) / (max - min)
      updateSliderSound(normalizedValue)
    }
  }

  const handlePointerDown = () => {
    isDraggingRef.current = true
    const normalizedValue = (value - min) / (max - min)
    startSliderSound(normalizedValue)

    timeoutRef.current = setTimeout(() => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false
        stopSliderSound()
      }
    }, 10000)
  }

  const handlePointerUp = () => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false
      stopSliderSound()

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (isDraggingRef.current) {
        stopSliderSound()
      }
    }
  }, [])

  return (
    <div
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
      onPointerCancelCapture={handlePointerUp}
    >
      <SliderComfortable
        value={value}
        onChange={handleValueChange}
        min={min}
        max={max}
        step={step}
        variant="scrubber"
        label={label}
        formatValue={(currentValue) => currentValue.toFixed(3)}
        className="w-full rounded-[8px]"
      />
    </div>
  )
}
