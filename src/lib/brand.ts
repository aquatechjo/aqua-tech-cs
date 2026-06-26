export const aquaBrand = {
  name: "Aqua.Tech",
  product: "AquaFlow",

  colors: {
    background: "#020617",
    surface: "#0F172A",
    surfaceSoft: "#111827",

    aqua: "#06B6D4",
    sky: "#38BDF8",
    blue: "#2563EB",

    text: "#F8FAFC",
    muted: "#94A3B8",
    soft: "#64748B",

    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
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
    tagline: "Growth • Software • AI",
    systemLine: "Build. Launch. Grow.",
    arabicLine: "حلول رقمية ونمو فعلي — من الانطلاقة إلى التوسع",
  },

  symbols: ["</>", "{ }", "API", "SQL", "UI/UX", "DEV", "0101"],
} as const