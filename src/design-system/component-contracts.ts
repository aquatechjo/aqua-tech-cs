export const aquaButtonVariants = [
  "primary",
  "secondary",
  "ghost",
  "danger",
] as const

export const aquaButtonSizes = ["sm", "md", "lg"] as const

export const aquaFieldSizes = ["sm", "md", "lg"] as const

export const aquaCardVariants = ["surface", "soft", "outlined"] as const
export const aquaCardPaddings = ["none", "sm", "md", "lg"] as const

export const aquaBadgeVariants = [
  "aqua",
  "blue",
  "success",
  "warning",
  "danger",
  "muted",
] as const

export const aquaBadgeSizes = ["sm", "md"] as const

export const aquaAlertVariants = [
  "info",
  "success",
  "warning",
  "danger",
  "neutral",
] as const

export const aquaSpinnerSizes = ["sm", "md", "lg"] as const
export const aquaSkeletonShapes = ["text", "circle", "card"] as const

export type AquaButtonVariant = (typeof aquaButtonVariants)[number]
export type AquaButtonSize = (typeof aquaButtonSizes)[number]
export type AquaFieldSize = (typeof aquaFieldSizes)[number]
export type AquaCardVariant = (typeof aquaCardVariants)[number]
export type AquaCardPadding = (typeof aquaCardPaddings)[number]
export type AquaBadgeVariant = (typeof aquaBadgeVariants)[number]
export type AquaBadgeSize = (typeof aquaBadgeSizes)[number]
export type AquaAlertVariant = (typeof aquaAlertVariants)[number]
export type AquaSpinnerSize = (typeof aquaSpinnerSizes)[number]
export type AquaSkeletonShape = (typeof aquaSkeletonShapes)[number]
