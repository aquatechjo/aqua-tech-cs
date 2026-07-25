export const aquaPublicSurfaceKinds = [
  "auth",
  "public",
  "system-document",
] as const

export const aquaAuthJourneyStates = [
  "idle",
  "submitting",
  "success",
  "error",
  "invalid-link",
] as const

export const aquaCommunicationKinds = [
  "transactional-email",
  "system-document",
] as const

export const aquaDocumentDensities = ["comfortable", "compact"] as const

export type AquaPublicSurfaceKind = (typeof aquaPublicSurfaceKinds)[number]
export type AquaAuthJourneyState = (typeof aquaAuthJourneyStates)[number]
export type AquaCommunicationKind = (typeof aquaCommunicationKinds)[number]
export type AquaDocumentDensity = (typeof aquaDocumentDensities)[number]
