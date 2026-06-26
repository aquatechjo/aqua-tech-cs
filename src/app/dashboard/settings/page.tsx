import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import SettingsClient from "./SettingsClient"

export default async function SettingsPage() {
  const user = await requireAuth()

  const company = await prisma.company.findUnique({
    where: {
      id: user.companyId,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      email: true,
      phone: true,
      website: true,
      address: true,
      country: true,
      currency: true,
      timezone: true,
      language: true,
      updatedAt: true,
    },
  })

  if (!company) {
    throw new Error("Company not found")
  }

  return (
    <SettingsClient
      company={company}
      currentUser={{
        role: user.role,
      }}
    />
  )
}