export const aquaShellDensities = ["compact", "comfortable"] as const

export type AquaShellDensity = (typeof aquaShellDensities)[number]

export type AquaNavigationItem = {
  label: string
  href: string
  enabled: boolean
}

export type AquaNavigationSection = {
  label: string
  items: AquaNavigationItem[]
}
