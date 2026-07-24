import type { Metadata } from "next"
import "bootstrap/dist/css/bootstrap.min.css"
import "./globals.css"
import "@/styles/aqua-tokens.css"
import "@/styles/aqua-bootstrap.css"
import "@/styles/aqua-primitives.css"
import "flatpickr/dist/flatpickr.min.css"

import AquaToastViewport from "@/components/aqua/AquaToast"

export const metadata: Metadata = {
  title: {
    default: "AquaFlow | Aqua.Tech OS",
    template: "%s | AquaFlow",
  },
  description:
    "AquaFlow is the internal operations system for Aqua.Tech — Growth, Software, and AI.",
  applicationName: "AquaFlow",
  authors: [{ name: "Aqua.Tech" }],
  creator: "Aqua.Tech",
  publisher: "Aqua.Tech",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      data-aqua-brand="aqua-tech"
      data-aqua-product="aquaflow"
    >
      <body>
        {children}
        <AquaToastViewport />
      </body>
    </html>
  )
}