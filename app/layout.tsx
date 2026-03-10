import type React from "react"
import { Space_Mono } from "next/font/google"
import "./globals.css"
import { AudioInitializer } from "@/components/audio-initializer"

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Shader Customizer",
  description: "Interactive GLSL shader playground",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={spaceMono.variable}>
        <AudioInitializer />
        {children}
      </body>
    </html>
  )
}
