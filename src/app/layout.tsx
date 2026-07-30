import type { Metadata } from "next"
import "bootstrap/dist/css/bootstrap.min.css"
import "./globals.css"
import "@/styles/aqua-tokens.css"
import "@/styles/aqua-bootstrap.css"
import "@/styles/aqua-primitives.css"
import "@/styles/aqua-shell.css"
import "@/styles/aqua-operational-shell.css"
import "@/styles/aqua-patterns.css"
import "@/styles/aqua-public.css"
import "@/styles/aqua-discovery-public.css"
import "@/styles/aqua-proposal-public.css"
import "@/styles/aqua-showcase.css"
import "@/styles/aqua-dashboard.css"
import "@/styles/aqua-my-day.css"
import "flatpickr/dist/flatpickr.min.css"

import AquaToastViewport from "@/components/aqua/AquaToast"
import { aquaTechCsTheme } from "@/design-system"

export const metadata: Metadata = {
  title: {
    default: `${aquaTechCsTheme.productName} | Aqua.Tech`,
    template: `%s | ${aquaTechCsTheme.productName}`,
  },
  description:
    `${aquaTechCsTheme.productName} is the core operating system for Aqua.Tech — Growth, Software, and AI.`,
  applicationName: aquaTechCsTheme.productName,
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
      data-aqua-product="aqua-tech-cs"
    >
      <body>
        {children}
        <AquaToastViewport />
      </body>
    </html>
  )
}
