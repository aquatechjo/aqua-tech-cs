export const aquaDataDensities = ["comfortable", "compact"] as const

export const aquaTableMobileStrategies = ["scroll", "stack"] as const

export const aquaModalSizes = ["sm", "md", "lg", "xl"] as const

export const aquaTabVariants = ["line", "pill"] as const

export const aquaPageStateVariants = [
  "loading",
  "empty",
  "error",
  "success",
  "permission",
] as const

export const aquaDetailColumns = [1, 2, 3] as const

export type AquaDataDensity = (typeof aquaDataDensities)[number]
export type AquaTableMobileStrategy =
  (typeof aquaTableMobileStrategies)[number]
export type AquaModalSize = (typeof aquaModalSizes)[number]
export type AquaTabVariant = (typeof aquaTabVariants)[number]
export type AquaPageStateVariant = (typeof aquaPageStateVariants)[number]
export type AquaDetailColumns = (typeof aquaDetailColumns)[number]
