"use client"

interface ColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
}

export function ColorPicker({ label, value, onChange }: ColorPickerProps) {
  return (
    <div className="flex items-center gap-4 py-1">
      <div className="shrink-0 text-white text-white text-sm w-[106px]">{label}</div>
      <div className="flex-1 flex items-center gap-2 justify-end">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="rounded-full cursor-pointer border border-border bg-transparent overflow-hidden [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-full [&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-full h-7 w-7"
        />
        <div className="font-medium w-16 tabular-nums text-sm text-muted-foreground">{value.toUpperCase()}</div>
      </div>
    </div>
  )
}
