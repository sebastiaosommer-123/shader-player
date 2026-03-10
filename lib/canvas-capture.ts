import type { ShaderParams } from "./shader-uniforms"

export interface CaptureOptions {
  canvas: HTMLCanvasElement
  params: ShaderParams
  isMobile: boolean
}

export function captureCanvas({ canvas, params, isMobile }: CaptureOptions) {
  // Capture the current canvas frame
  const dataUrl = canvas.toDataURL("image/png", 1.0)

  return {
    dataUrl,
    width: canvas.width,
    height: canvas.height,
    params: { ...params },
    timestamp: Date.now(),
  }
}

export function downloadImage(dataUrl: string, params: ShaderParams, timestamp: number, shaderId?: string) {
  const link = document.createElement("a")
  const date = new Date(timestamp)

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  let hours = date.getHours()
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  const ampm = hours >= 12 ? "PM" : "AM"
  hours = hours % 12
  hours = hours ? hours : 12 // 0 should be 12
  const dateString = `${year}-${month}-${day}-${hours}-${minutes}-${seconds}${ampm}`

  link.href = dataUrl
  link.download = `shader-capture-${dateString}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
