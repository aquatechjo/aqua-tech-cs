export type AquaProductDensity = "compact" | "comfortable" | "spacious"
export type AquaProductPersonality =
  | "operational"
  | "professional"
  | "intelligent"
  | "expressive"
export type AquaProductSurfaceMode = "light" | "dark" | "adaptive"

export type AquaProductTheme = {
  id: string
  productName: string
  companyName: "Aqua.Tech"
  shortMark: string
  accent: {
    primary: string
    primaryRgb: string
    secondary: string
    secondaryRgb: string
    soft: string
    contrast: string
  }
  surface: {
    mode: AquaProductSurfaceMode
    background: string
    backgroundSoft: string
    card: string
    cardSoft: string
    border: string
    text: string
    muted: string
    softText: string
  }
  density: AquaProductDensity
  personality: AquaProductPersonality
  tagline: string
  systemLine: string
}

export const aquaFlowTheme = {
  id: "aquaflow",
  productName: "AquaFlow",
  companyName: "Aqua.Tech",
  shortMark: "AF",
  accent: {
    primary: "#06B6D4",
    primaryRgb: "6, 182, 212",
    secondary: "#2563EB",
    secondaryRgb: "37, 99, 235",
    soft: "#BFF7FF",
    contrast: "#FFFFFF",
  },
  surface: {
    mode: "dark",
    background: "#020617",
    backgroundSoft: "#07111F",
    card: "#0F172A",
    cardSoft: "#111827",
    border: "rgba(255, 255, 255, 0.10)",
    text: "#F8FAFC",
    muted: "#94A3B8",
    softText: "#64748B",
  },
  density: "comfortable",
  personality: "operational",
  tagline: "Growth • Software • AI",
  systemLine: "Build. Launch. Grow.",
} as const satisfies AquaProductTheme

export const allowedProductThemeKeys = [
  "id",
  "productName",
  "companyName",
  "shortMark",
  "accent",
  "surface",
  "density",
  "personality",
  "tagline",
  "systemLine",
] as const
