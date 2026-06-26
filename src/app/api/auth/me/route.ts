import { err, ok } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()

  if (!user) {
    return err("غير مصرح", 401)
  }

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      company: {
        id: user.company.id,
        name: user.company.name,
        slug: user.company.slug,
        email: user.company.email,
        website: user.company.website,
      },
    },
  })
}