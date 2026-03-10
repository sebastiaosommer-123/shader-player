"use client"

import { Slider } from "@/components/ui/slider"
import { useState, useEffect, useRef } from "react"
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
  const [isDragging, setIsDragging] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleValueChange = (values: number[]) => {
    const newValue = values[0]
    onChange(newValue)

    if (isDragging) {
      const normalizedValue = (newValue - min) / (max - min)
      updateSliderSound(normalizedValue)
    }
  }

  const handlePointerDown = () => {
    setIsDragging(true)
    const normalizedValue = (value - min) / (max - min)
    startSliderSound(normalizedValue)

    timeoutRef.current = setTimeout(() => {
      if (isDragging) {
        setIsDragging(false)
        stopSliderSound()
      }
    }, 10000)
  }

  const handlePointerUp = () => {
    if (isDragging) {
      setIsDragging(false)
      stopSliderSound()

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }

  const handlePointerLeave = () => {
    if (isDragging) {
      setIsDragging(false)
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
      if (isDragging) {
        stopSliderSound()
      }
    }
  }, [isDragging])

  return (
    <div className="py-2 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-foreground text-sm">{label}</div>
        <div className="font-medium tabular-nums text-muted-foreground text-sm">{value.toFixed(3)}</div>
      </div>
      <Slider
        value={[value]}
        onValueChange={handleValueChange}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  )
}
