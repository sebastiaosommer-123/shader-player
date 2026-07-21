"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

const themeOptions = ["system", "light", "dark"] as const

export function AppearanceControl() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => setMounted(true), [])

  return (
    <div>
      <div className="h-px bg-border -mx-4 mb-4" />
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">Appearance</div>
        <div
          className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/40 p-1"
          role="radiogroup"
          aria-label="Appearance"
        >
          {themeOptions.map((option) => {
            const isSelected = mounted && theme === option

            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setTheme(option)}
                className={cn(
                  "h-8 rounded-md px-2 text-xs capitalize text-muted-foreground transition-[background-color,color,box-shadow,transform] duration-150 ease-out hoverFine:text-foreground active:scale-[0.98] motion-reduce:transition-none",
                  isSelected && "bg-background text-foreground shadow-sm",
                )}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
