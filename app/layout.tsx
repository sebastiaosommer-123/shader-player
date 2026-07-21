import type React from "react"
import type { Viewport } from "next"
import { Space_Mono } from "next/font/google"
import "./globals.css"
import { AudioInitializer } from "@/components/audio-initializer"
import { ThemeProvider } from "@/components/theme-provider"

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Shader Playground",
  description: "Interactive GLSL shader playground",
  icons: {
    icon: [
      { url: "/icon-light.png", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark.png", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
  },
}

// viewport-fit=cover is what makes env(safe-area-inset-*) resolve to anything
// other than 0 — the mobile control bar sits against the home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={spaceMono.variable}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AudioInitializer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
