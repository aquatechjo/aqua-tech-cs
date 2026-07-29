export const AQUA_TECH_CS_TECHNICAL_ID = "aqua-tech-cs" as const
export const LEGACY_AQUAFLOW_TECHNICAL_ID = "aquaflow" as const

export const WEBSITE_INTAKE_HEADER_NAME =
  `x-${AQUA_TECH_CS_TECHNICAL_ID}-intake-secret` as const
export const LEGACY_WEBSITE_INTAKE_HEADER_NAME =
  `x-${LEGACY_AQUAFLOW_TECHNICAL_ID}-intake-secret` as const

export function readWebsiteIntakeSecret(headers: Headers) {
  const authorization = headers.get("authorization")

  if (authorization?.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim()
  }

  return (
    headers.get(WEBSITE_INTAKE_HEADER_NAME)?.trim() ||
    headers.get(LEGACY_WEBSITE_INTAKE_HEADER_NAME)?.trim() ||
    ""
  )
}
