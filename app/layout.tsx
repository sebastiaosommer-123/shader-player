import type React from "react"
import type { Viewport } from "next"
import { Space_Mono } from "next/font/google"
import "./globals.css"
// Blossom only enhances the gallery's scroller on pointer devices, but its
// stylesheet is what the scroller itself is built on — Next wants it from the
// root entry point, not from the client component that renders the carousel.
import "@blossom-carousel/react/style.css"
import { AudioInitializer } from "@/components/audio-initializer"
import { ThemeProvider } from "@/components/theme-provider"
import { SIDEBAR_WIDTH_BOOT_SCRIPT } from "@/lib/sidebar-width"

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
        {/* First thing in the body so it executes before the markup below is
            parsed, which is what lets the stored sidebar width be in place for
            the very first paint instead of one paint late. */}
        <script dangerouslySetInnerHTML={{ __html: SIDEBAR_WIDTH_BOOT_SCRIPT }} />
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <AudioInitializer />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
