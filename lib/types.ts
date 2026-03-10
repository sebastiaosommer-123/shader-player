export interface CapturedImage {
  id: string
  dataUrl: string
  timestamp: number
  width: number
  height: number
  shaderId?: string
  params?: Record<string, number | string>
}
