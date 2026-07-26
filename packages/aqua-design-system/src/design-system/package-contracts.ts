export const aquaDesignSystemPackageName = "@aqua-tech/design-system" as const
export const aquaDesignSystemVersion = "0.7.0" as const
export const aquaDesignSystemSchemaVersion = 1 as const

export const aquaDesignSystemCssLayers = [
  "tokens",
  "bootstrap",
  "primitives",
  "shell",
  "patterns",
  "public",
] as const

export const aquaDesignSystemComponentGroups = {
  primitives: [
    "AquaAlert",
    "AquaBadge",
    "AquaButton",
    "AquaCard",
    "AquaInput",
    "AquaLinkButton",
    "AquaMark",
    "AquaSelect",
    "AquaSkeleton",
    "AquaSpinner",
    "AquaTextarea",
    "AquaToastViewport",
  ],
  workflows: [
    "AquaConfirmDialog",
    "AquaDataPanel",
    "AquaDetailList",
    "AquaEmptyState",
    "AquaFilterBar",
    "AquaFormSection",
    "AquaModal",
    "AquaPageState",
    "AquaPagination",
    "AquaTable",
    "AquaTableStateRow",
    "AquaTabs",
  ],
  public: [
    "AquaBackground",
    "AquaSystemDocument",
    "AquaTechPattern",
  ],
  utilities: ["AquaDatePicker"],
} as const

export const aquaDesignSystemReleaseLevels = [
  "patch",
  "minor",
  "major",
] as const

export const aquaDesignSystemReleaseChannels = [
  "internal",
  "candidate",
  "stable",
] as const

export const aquaStarterSurfaceModes = ["light", "dark", "adaptive"] as const
export const aquaStarterDensities = [
  "compact",
  "comfortable",
  "spacious",
] as const

export const aquaStarterRequiredFiles = [
  "package.json",
  "next.config.ts",
  "tsconfig.json",
  "src/app/layout.tsx",
  "src/app/page.tsx",
  "src/app/product-theme.css",
  "README.md",
] as const

export type AquaDesignSystemCssLayer =
  (typeof aquaDesignSystemCssLayers)[number]
export type AquaDesignSystemReleaseLevel =
  (typeof aquaDesignSystemReleaseLevels)[number]
export type AquaDesignSystemReleaseChannel =
  (typeof aquaDesignSystemReleaseChannels)[number]
export type AquaStarterSurfaceMode = (typeof aquaStarterSurfaceModes)[number]
export type AquaStarterDensity = (typeof aquaStarterDensities)[number]
