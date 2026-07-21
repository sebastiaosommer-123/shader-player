import type React from "react"
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
