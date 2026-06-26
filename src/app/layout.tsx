import type { Metadata } from "next"
import "bootstrap/dist/css/bootstrap.min.css"
import "./globals.css"
import "@/styles/aqua-bootstrap.css"

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
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}