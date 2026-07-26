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
import "@/styles/aqua-showcase.css"
import "@/styles/aqua-dashboard.css"
import "@/styles/aqua-my-day.css"
import "flatpickr/dist/flatpickr.min.css"

import AquaToastViewport from "@/components/aqua/AquaToast"
import { aquaFlowTheme } from "@/design-system"

export const metadata: Metadata = {
  title: {
    default: `${aquaFlowTheme.productName} | Aqua.Tech`,
    template: `%s | ${aquaFlowTheme.productName}`,
  },
  description:
    `${aquaFlowTheme.productName} is the core operating system for Aqua.Tech — Growth, Software, and AI.`,
  applicationName: aquaFlowTheme.productName,
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
