import { aquaTechCsTheme, aquaTechDesignTokens } from "@/design-system"

export const aquaBrand = {
  name: aquaTechCsTheme.companyName,
  product: aquaTechCsTheme.productName,

  colors: {
    background: aquaTechCsTheme.surface.background,
    surface: aquaTechCsTheme.surface.card,
    surfaceSoft: aquaTechCsTheme.surface.cardSoft,

    aqua: aquaTechCsTheme.accent.primary,
    sky: aquaTechDesignTokens.color.brand.aqua,
    blue: aquaTechCsTheme.accent.secondary,

    text: aquaTechCsTheme.surface.text,
    muted: aquaTechCsTheme.surface.muted,
    soft: aquaTechCsTheme.surface.softText,

    success: aquaTechDesignTokens.color.semantic.success,
    warning: aquaTechDesignTokens.color.semantic.warning,
    danger: aquaTechDesignTokens.color.semantic.danger,
  },

  gradients: {
    primary: "from-cyan-400 to-blue-600",
    softGlow:
      "bg-[radial-gradient(circle_at_top_left,rgba(6,182,212,0.20),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(37,99,235,0.18),transparent_34%)]",
  },

  radius: {
    card: "rounded-[2rem]",
    input: "rounded-2xl",
    button: "rounded-2xl",
  },

  language: {
    tagline: aquaTechCsTheme.tagline,
    systemLine: aquaTechCsTheme.systemLine,
    arabicLine: "حلول رقمية ونمو فعلي — من الانطلاقة إلى التوسع",
  },

  symbols: ["</>", "{ }", "API", "SQL", "UI/UX", "DEV", "0101"],
} as const
